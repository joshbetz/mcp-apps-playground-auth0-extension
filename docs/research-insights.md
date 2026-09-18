# Research Insights — MCP Gateway Auth & Architecture

Compiled from research conducted during the MCP Gateway Playground design sessions.
Covers: MCP gateway auth patterns, OAuth scope layering, stateless token caching, MCP Apps catalog, and DX patterns from existing frameworks.

---

## 1. Two-layer auth model

The most important finding of the session. Every production-grade OAuth-centric API gateway (Pomerium, agentgateway, decocms/studio) separates two concerns that developers initially conflate:

```
Layer 1 — User → Gateway
  Bearer token validated against the gateway's own audience (AUTH0_AUDIENCE)
  Scopes on the user's token control which tools they may call
  Standard OAuth 2.1 Bearer + RFC 9728 Protected Resource Metadata

Layer 2 — Gateway → Upstream API
  Gateway uses its own credential strategy to call downstream services
  Audience is the upstream API's resource server identifier (BANKING_AUDIENCE, CRM_AUDIENCE)
  User never interacts with these audiences
  Three strategies: none, client_credentials, token_exchange (RFC 8693)
```

These are **different OAuth audiences** managed by **different credential flows**. `tool.scopes` belongs to the gateway's scope namespace; `tool.upstreamScopes` belongs to the upstream API's scope namespace. They do not map to each other — the gateway bridges the two trust boundaries silently.

**Why this matters for product design**: When building an MCP Gateway SDK, the API must make this boundary explicit. Our `upstream_auth` rename (from `auth`) and the `scopes` / `upstreamScopes` split on `ToolDefinition` directly encode this model.

**ADR**: `docs/adr/0001-two-layer-auth-model.md`

---

## 2. MCP gateway survey findings

### Pomerium
**Strongest implementation studied.** Cleanest separation between user-facing auth and upstream credentials.

- User → Gateway: OAuth 2.1 + PKCE via any OIDC IdP. Issues short-lived gateway JWTs per-request, never forwards IdP tokens.
- Per-tool access: `mcp_tool` policy criterion in PPL (Policy Permission Language). Fires only on `tools/call`, not `initialize` / `tools/list`. Declared under `deny` (not `allow`) because omitting it from `allow` would block MCP handshake methods.
- Gateway → Upstream: `upstream_oauth2` config block, completely separate from user policy. Three modes: static credentials, auto-discovery via RFC 9728, full self-registration via CIMD/RFC 7591.
- **Key insight**: upstream scopes are declared at the **route level**, not the tool level. No mechanism to vary upstream token scopes per tool call.
- Explicit design rationale: "We can't restrict access to the IdP if we forward it."

### agentgateway
- JWT validation via JWKS (`mcpAuthentication` section).
- Per-tool authorization via CEL expressions: `"write" in jwt.scopes && mcp.tool.name == "create_lead"`.
- Upstream auth via `backendAuth` — separate config section. Supports static key injection, passthrough, or RFC 8693 token exchange as first-class built-in.
- `scopesSupported` in resource metadata is **decorative** — not enforced natively. You must manually replicate scope checks as CEL rules.
- **Key insight**: scope-to-tool mapping is a CEL programming problem, not a declarative config problem.

### Jetski (archived April 2026)
- JWT validation on/off per route (`authentication.enabled: bool`). No scope model whatsoever.
- No upstream auth — upstream server receives requests with no credentials injected.
- **Key insight**: covers only the client-registration and JWT-validation side of "identity automatically." Does nothing about upstream credentials.

### decocms/studio (MCP Mesh)
- Every registered tool becomes an OAuth 2.1 scope with `self:` prefix (e.g. `self:connections_list`).
- Encrypted token vault (AES-256-GCM) stores upstream OAuth credentials separately from user JWTs.
- Three clearly separated planes: gateway scopes (JWT), connection delegation grants, upstream credentials (vault).
- `scopes_supported: ["*"]` — advertised but not enforced. Scope enforcement delegated to access control logic.
- **Key insight**: the vault architecture is production-hardened for credential storage. The OAuth enforcement layer is shallow but the credential isolation is solid.

### Universal finding
**No gateway enforces scopes declaratively at the tool level.** All advertise `scopes_supported` but require manual enforcement (CEL, code, access control logic). The `tool.scopes` field in this project is ahead of every implementation studied.

---

## 3. What the MCP spec says about authorization

Sources: `modelcontextprotocol.io/specification/2026-07-28/basic/authorization`, `apps.extensions.modelcontextprotocol.io/api/documents/authorization.html`

### Core spec (RFC 9728, RFC 8693, RFC 6750)
- MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC 9728) at `/.well-known/oauth-protected-resource`
- Clients MUST use this endpoint for authorization server discovery
- 401 responses MUST include `WWW-Authenticate: Bearer resource_metadata="<url>"`
- Insufficient scope: 403 with `WWW-Authenticate: Bearer error="insufficient_scope", scope="<required>"`
- `resource` parameter (RFC 8707) MUST be included in auth requests and token requests

### Per-tool authorization (ext-apps spec)
- **Per-server auth**: require token for every request (current playground behaviour before this session)
- **Per-tool auth**: maintain a set of "protected tool names"; inspect JSON-RPC body; return 401 at HTTP boundary (not as MCP error) if protected tool called without valid token
- Key rule: "authorization is enforced at the HTTP boundary, not as a tool-level error"
- Unprotected tools "pass through without any token check"

### Tool visibility (ext-apps spec, SEP-1865)
- `_meta.ui.visibility: ('model' | 'app')[]` — spec-defined field, default `['model', 'app']`
- `['app']` = tool hidden from LLM, callable only by UI via tools/call
- This is entirely distinct from auth protection — a tool can be app-only AND require auth, or app-only AND public

### What the spec does NOT define
- Per-tool scope declarations — left to server implementations
- How a tool's scope requirements relate to upstream API scopes
- `tools/list` filtering based on user scopes (spec intention: show all tools, enforce on call)

---

## 4. OAuth 2.1 client credentials scope dynamics

From draft-ietf-oauth-v2-1: scope IS dynamic per `client_credentials` token request. The AS may grant narrower scope than requested. This means `upstreamScopes` on `clientCredentials` tools is spec-valid — requesting minimal scope per tool operation aligns with the spec's "Access Token Privilege Restriction" guidance.

Practical implication: a `clientCredentials` toolkit tool can declare `upstreamScopes: ['crm:read']` for read operations and `upstreamScopes: ['crm:write']` for write operations. The gateway requests the minimal scope for each call rather than always requesting the maximum grant.

---

## 5. Stateless MCP vs token caching

MCP v2 (SEP-2575) removed `Mcp-Session-Id` — each request is self-contained. This creates a tension with token exchange:

| Strategy | Current state | Problem |
|----------|--------------|---------|
| `clientCredentials` | In-process cache by `audience` | Works single-instance, lost on restart, not shared |
| `tokenExchange` | No cache, fresh exchange per request | N×M Auth0 API calls per second at scale |

**How other gateways solve it**: Every production gateway that avoids per-request exchange maintains external token storage. Pomerium uses a Databroker (PostgreSQL-backed). decocms/studio uses an AES-256-GCM encrypted DB vault.

**The Auth0 solution**: Auth0 Token Vault — managed external cache for upstream OAuth credentials. Keyed by user identity + audience + scope set. Handles token refresh automatically. Works across stateless instances. Already part of the Auth0 product surface.

**Cache key design**:
```
clientCredentials:  audience + sorted(upstreamScopes).join(',')
tokenExchange:      sha256(userToken) + audience + sorted(upstreamScopes).join(',')
```

Detail: `.scratch/challenge-token-vault.md`

---

## 6. MCP Apps catalog and serving

Sources: ext-apps spec, mcp-use implementation, json-render, a2ui

### What the spec says
The spec (SEP-1865) defines **no catalog concept**. Tool-to-UI linkage is purely `_meta.ui.resourceUri: 'ui://foo'`. The server decides how to serve the HTML at that URI — disk, CDN, inline string, anything.

### mcp-use approach
No catalog. Runs Express alongside MCP. Serves widgets as HTTP routes (`http://localhost:3001/mcp-use/widgets/bank-history`). `view: { name: 'bank-history' }` reference is a magic string — no type safety. Build pipeline (esbuild) writes to `dist/resources/mcp-use/widgets/`. Disk scan at startup via `readdirSync`.

### json-render approach
Explicit typed catalog via `defineCatalog(schema, { components: {...} })`. The catalog is the source of truth for AI prompting, renderer binding, and validation. References are string names but the catalog is authored TypeScript — not generated. `catalog.prompt()` auto-generates system prompts.

### a2ui approach
No server-side catalog. Agent sends `{ type: 'custom', name: 'McpApp', properties: {...} }` as plain JSON. String name resolved at runtime against client-side registry.

### Our decision
`McpServer.create({ appsDir })` reads `appsDir/*/dist/index.html` at startup — a correct local simulation of what a remote component catalog/CDN would do in the real product. No generated catalog file needed. The disk-read approach is the right proxy because in the real product `appsDir` becomes `catalogEndpoint`.

---

## 7. Product direction insights

### The end-state architecture
From design session: the real product separates into two services:
1. **Component catalog**: users upload source, define dependencies, bundle → serve from CDN. MCP server fetches app HTML by component name from the catalog service.
2. **Toolkit API**: users define toolkits, tools, and handler source code via API. Code executed in sandboxed environment (e.g. Cloudflare Dynamic Workers).

The contracts being designed in this playground (`defineTool`, `Toolkit`, `AuthStrategies`, `ToolDefinition`) are what stays. File structure, local builds, and catalog mechanics are transient.

### The identity expert's principle
> "Auth to remote MCP servers should be treated identically to any other HTTP resource. Nothing being defined need be MCP specific, especially now that the protocol is moving to a stateless approach."

Applied to this project: the user-facing auth layer is standard Bearer + standard OAuth scopes — nothing MCP-specific. What happens after (upstream auth, token exchange) is the gateway's internal concern, invisible to the MCP client. `tool.scopes` is just the standard `required_scopes` pattern from any OAuth-protected API.

### MCP gateway as analogy to express-oauth2-dpop
The DX pattern maps cleanly:
```
authMiddleware({ audience: AUTH0_AUDIENCE })  ≡  HTTP-level Bearer validation (mcpPlugin)
protectRoute({ scope: ['payments:read'] })     ≡  tool.scopes: ['payments:read']
protectRoute()                                  ≡  tool with no scopes (authenticated, no specific scope)
app.get('/public', ...)                         ≡  AuthStrategies.none toolkit
```

Missing in express-oauth2-dpop (leaf API, no upstream): `upstreamScopes` — the gateway-specific addition.

---

## 8. DX design principles (from comparative analysis)

### What mcp-use gets right
- `server.tool()` fluent registration keeps tool definition co-located with the server
- Rich server-level metadata (`title`, `description`, `instructions`, `icons`)
- `view: { name }` is cleaner than a magic string

### What our approach gets right that mcp-use doesn't
- Modular `defineTool` + `Toolkit` factory — tools are testable/reusable independently
- Explicit auth strategy per toolkit — `upstream_auth` makes the credential flow obvious
- `outputSchema` enforced when `app` is set — iframe contract is checked at definition time
- Two-scope model — `scopes` + `upstreamScopes` maps cleanly to the two OAuth trust boundaries

### Design principle: boring = explicit
Clever inference (omitting `upstream_auth` implying open) is worse than explicit declaration (`upstream_auth: AuthStrategies.none`). Every toolkit must state its upstream auth contract. This is the lesson from studying gateways that silently allow all routes by default.

---

## 9. Spec compliance gaps (as of session end)

| Item | Status | Reference |
|------|--------|-----------|
| `/.well-known/oauth-protected-resource` | ✅ | `src/plugins/protected-resource-metadata.ts` |
| `WWW-Authenticate` on 401 | ✅ | `src/plugins/auth.ts` |
| Per-tool HTTP auth enforcement | ✅ | `src/plugins/mcp.ts` `preHandler` |
| `tool.scopes` gateway enforcement | ⏳ | `.scratch/challenge-scope-enforcement.md` |
| `scopes_supported` in resource metadata | ⏳ | Aggregate `tool.scopes` across all toolkits |
| 403 + `insufficient_scope` | ⏳ | Depends on scope enforcement |
| Token vault for stateless caching | ⏳ | `.scratch/challenge-token-vault.md` |
| ext-apps v2 typed client bridge | ⏳ | `.scratch/challenge-ext-apps-wrapper.md` |
