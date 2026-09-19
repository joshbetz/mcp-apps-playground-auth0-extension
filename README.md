# MCP Gateway Playground

Auth0 research spike: what does "we handle identity automatically" actually mean for an MCP gateway product? This playground implements the full surface area in the simplest possible form to surface the patterns that need to be abstracted.

## What this is

A Fastify-based MCP server (StreamableHTTP, 2026-07-28 protocol) that models the core gateway abstractions:

- **Toolkit** — a named group of tools sharing one upstream API and one auth strategy; implemented as a `registerXxxTools(server)` function per domain
- **`withRequiredAuth`** — declares a tool's auth requirements (scopes) and wraps the handler; backed by `InsufficientScopeError` → HTTP 403 + `WWW-Authenticate`
- **Two-layer auth** — gateway scopes (user's token) and upstream scopes (downstream API token) are independent concerns; see [ADR-0001](docs/adr/0001-two-layer-auth-model.md)

See [CONTEXT.md](CONTEXT.md) for the domain vocabulary.

## Auth model

```
User → Gateway     Bearer token validated against AUTH0_AUDIENCE
                   tool.scopes checked against user's token claims (TODO: enforce)
```

No upstream auth is implemented. Tool handlers access the gateway token via `getCallerToken()` and user identity via `getCallerUser()` from AsyncLocalStorage context. All toolkits call mock endpoints directly.

## Toolkits

| Toolkit | Tools | Notes |
|---------|-------|-------|
| `market` | `get_exchange_rate` | Open — no user auth required |
| `crm` | `create_lead` | Calls mock CRM endpoint |
| `profile` | `get`, `update` | `update` renders an MCP App iframe |
| `payments` | `initiate_transfer`, `get_transactions`, `execute_transfer` | `get_transactions` renders a transactions app; `execute_transfer` is app-only (`visibility: ['app']`) |

## Running

```bash
cp .env.example .env
# fill in AUTH0_DOMAIN, AUTH0_AUDIENCE, SESSION_SECRET
npm install
npm run build:apps    # builds MCP App HTML bundles
npm run dev
```

Test with MCP Inspector: `npx @modelcontextprotocol/inspector http://localhost:3001/mcp`

## Spec compliance

| Item | Status |
|------|--------|
| `/.well-known/oauth-protected-resource` (RFC 9728) | ✅ implemented |
| `WWW-Authenticate` header on 401 | ✅ implemented |
| Per-tool auth enforcement at HTTP boundary | ✅ implemented — `withRequiredAuth({ scopes })` throws `InsufficientScopeError` → 403 + `WWW-Authenticate` |
| Gateway scope enforcement (`tool.scopes`) | ✅ implemented — see `src/server/scopes.ts`, `src/plugins/auth.ts` |
| Token vault for stateless caching | ⏳ deferred — see `.scratch/challenge-token-vault.md` |
| `ext-apps` client-side typed bridge | ⏳ deferred — see `.scratch/challenge-ext-apps-wrapper.md` |

## Key files

```
src/server/          getCallerToken, getCallerUser, withRequiredAuth, InsufficientScopeError, AuthenticationError
src/plugins/auth.ts  requireAuth preHandler, setErrorHandler (403/401 + WWW-Authenticate)
src/plugins/mcp.ts   StreamableHTTP handler; bridges Fastify auth to MCP AuthInfo + ALS
src/plugins/protected-resource-metadata.ts  /.well-known/oauth-protected-resource
src/toolkits/        one directory per domain; each exports registerXxxTools(server, appsDir?)
src/apps/            MCP App React bundles (built to dist/index.html per app)
src/mock/            mock downstream APIs — logs Bearer token, returns fixtures; 401 on missing auth
```

## Architecture decisions

- [ADR-0001](docs/adr/0001-two-layer-auth-model.md) — why gateway scopes and upstream scopes are separate, why policy-based approaches (Pomerium PPL, agentgateway CEL) were rejected

## Auth0 Custom Extension deployment

This repository keeps the original Fastify playground and packages it for Auth0 Custom Extensions. The Webtask wrapper creates a request-scoped Fastify instance; it does not replace the MCP server, its auth plugin, mock travel routes, tool schemas, scope enforcement, responses, or MCP App behavior.

The extension runs on Node 22 and requires these settings:

| Setting | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | At least 32 characters; signs the existing short-lived Auth0 Forms context JWTs. |
| `PUBLIC_BASE_URL` | No | Explicit external proxy/custom-domain origin. Leave blank to use the installed Webtask URL. |

`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `EXTENSION_SECRET` are supplied by Auth0 at runtime. Do not add, expose, or log them as settings.

Auth0 Forms are discovered from the installed tenant at MCP request time. The extension's managed Management API client requests only `read:forms` for this, and a caller must hold the existing `read:account` MCP scope before Form tools are exposed. Each available Form becomes an `open_auth0_form_*` MCP App tool. Form IDs do not belong in extension settings.

### Build and publish

```bash
npm install
npm test
```

The build generates and validates the files required by the legacy importer: `index.js`, `build/bundle.js`, `dist/extension.js`, `dist/package.json`, and `dist/package.zip`. Commit them with `webtask.json` and keep the repository public. The importer reads the `master` branch, so publish the same release to both `main` and `master`.

### Import and provision

1. In Auth0 Dashboard → Extensions, import this public repository and enter `SESSION_SECRET`. When updating from an older release, perform a full update/reinstall so Auth0 grants the extension's new `read:forms` Management API permission.
2. Open the installed extension and select **Sign in and provision**. Its dashboard-admin-only setup routes create or reuse the RS256 API with the exact displayed `/mcp` URL as its audience; they also create the third-party client grant and expose connection/DCR setup.
3. Install `https://github.com/mustafadeel/auth0-ext-wellknown` in the same tenant as a separate Custom Extension with name `.well-known` and `useHashName: false`.
4. Promote a domain-level connection if needed, then connect an OAuth-capable client to the displayed `/mcp` URL.

The new API declares the source tool scopes: `read:destinations`, `read:bookings`, `bookings:write`, and `read:account`. Existing resource servers with the same audience are intentionally not modified.

### Troubleshooting logs

The server writes structured JSON logs that can be correlated by `requestId`.
They intentionally omit Authorization headers, bearer tokens, cookies, client
secrets, session secrets, Forms context JWTs, and all MCP tool arguments.

| Event | Meaning |
| --- | --- |
| `extension.initialized` | Runtime version, Auth0 domain, exact API audience, and Forms SDK URL. |
| `mcp.request.received` | MCP protocol method and tool name only. |
| `mcp.authentication.*` | Missing, verified, or rejected bearer token. Failed-token events contain only a SHA-256 fingerprint prefix, length, and JWT shape. |
| `mcp.tool.scope_denied` | The required and missing scopes. |
| `mcp.tool.completed` / `mcp.tool.failed` | The server-side tool outcome; error logs contain structural error fields only. |
| `forms.discovery.completed` / `forms.discovery.failed` | Tenant Form discovery count or a token-safe failure diagnostic. |
| `mcp.response.completed` | Final HTTP response status for the MCP request. |

If `mcp.tool.completed` appears for an Auth0 Forms tool but its MCP App still
shows an error, the server has completed successfully; check the browser's
developer console/network panel for the Forms SDK or whether the Form remains
available in the installed tenant.
