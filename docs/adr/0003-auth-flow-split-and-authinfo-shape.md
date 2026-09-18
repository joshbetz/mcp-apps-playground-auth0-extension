# Auth flow: two-step split between Fastify JWT verification and MCP AuthInfo construction

The auth flow from HTTP request to tool handler is intentionally split across two Fastify
plugins. This is not incidental — it follows the contract the MCP TypeScript SDK imposes.

## Why the split exists

The MCP SDK's `toNodeHandler` reads `req.raw.auth` and surfaces it to tool handlers as
`ctx.http.authInfo`. That property must be an `AuthInfo` object (SDK type). The SDK does not
perform verification — it only forwards whatever is already attached to the raw request.

This creates a natural two-step boundary:

1. **`plugins/auth.ts`** — verifies the Bearer token using `ApiClient.verifyAccessToken` and
   sets `req.user` (Fastify decorator). This is the gateway boundary check. It runs as a
   `requireAuth` preHandler and is reusable across any Fastify route, not just MCP.

2. **`plugins/mcp.ts` → `server/context.ts`** — translates the verified Fastify `RequestUser`
   into the SDK-shaped `AuthInfo` and attaches it to `req.raw.auth`. This is MCP-specific
   plumbing; it must happen inside the MCP route handler, after verification.

Consolidating both steps into a single plugin would mix the gateway boundary concern (auth
validity) with the SDK adapter concern (type shaping), and would prevent `requireAuth` from
being reused on non-MCP routes.

## The `extra: { user }` extension

`AuthInfo` in the SDK has four standard fields: `token`, `clientId`, `scopes`, `expiresAt`.
The `extra` field is an SDK-provided escape hatch for arbitrary caller metadata.

This codebase uses `extra: { user }` to carry the full `RequestUser` payload (all JWT claims)
into tool handlers. **This is a project extension, not part of the MCP spec.** Tool handlers
reading `ctx.http.authInfo.extra?.user` are consuming a local convention. If the MCP SDK ever
defines a standard field for user claims, this extension would migrate to that field.

## Decision

- Keep the two-step split. Do not consolidate JWT verification and `AuthInfo` construction into
  a single module.
- `buildAuthInfo` in `server/context.ts` is the authoritative seam between Fastify's JWT layer
  and the MCP SDK's auth contract. All JWT claim extraction and scope parsing belong there.
- `extra: { user }` is the approved pattern for surfacing full JWT claims to tool handlers.
  Do not read raw JWT fields from other sources inside tool handlers.

## Considered options

- **Single auth module**: consolidate verification + `AuthInfo` construction into one function.
  Rejected — verification must run as a Fastify preHandler (to guard the route), while
  `AuthInfo` construction must run inside the route handler (to attach to `req.raw`). The
  execution model prevents full consolidation.
- **Pass `RequestUser` directly to tool handlers** (skip `AuthInfo`): rejected — the SDK
  contract requires `AuthInfo` on `req.raw.auth`; bypassing it would break `ctx.http.authInfo`
  and diverge from the spec.
- **Use `requireBearerAuth` from the SDK** instead of a custom Fastify preHandler: not adopted
  because `requireBearerAuth` is framework-agnostic middleware and does not integrate with
  Fastify's decorator system (`req.user`, `req.getToken()`). Our `requireAuth` decorator
  provides tighter Fastify integration and feeds the existing `buildAuthInfo` seam cleanly.
- **Drop `req.raw.auth` in favour of ALS-only**: rejected. `req.raw.auth` is the official MCP
  TypeScript SDK convention for Fastify auth wiring — documented at
  https://ts.sdk.modelcontextprotocol.io/v2/serving/fastify.html. `toNodeHandler` reads
  `req.raw.auth` and forwards it as `ctx.http.authInfo` in every tool handler context.
  Removing it would silently break any tool or middleware that reads `ctx.http.authInfo`, even
  if no current tool does so. The ALS layer (`getCallerToken()`, `getCallerUser()`) is an
  ergonomic addition on top — not a replacement.
