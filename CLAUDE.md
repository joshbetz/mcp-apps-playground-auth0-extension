# MCP Gateway playground

Auth0 exploring what to abstract into an MCP Gateway product. Core research question: what does "we handle identity automatically" actually mean in practice? All code is a study — the goal is surfacing patterns for the real SDK.

## Source layout

```
src/server/         auth context: context.ts (ALS, getCallerToken, getCallerUser, parseScopes, buildAuthInfo), scopes.ts (withRequiredAuth HOF), errors.ts (McpGatewayError, InsufficientScopeError, AuthenticationError)
src/plugins/        Fastify plugins: auth (requireAuth decorator, getToken), cors, mcp (StreamableHTTP handler + ALS population)
src/toolkits/       one directory per domain; index.ts exports registerXxxTools(server, appsDir?); one file per tool
src/apps/           MCP App bundles; each app is one index.tsx; HTML built to <name>/dist/index.html
src/mock/           mock downstream Fastify routes; log Bearer token to show auth flow, return minimal fixtures
src/config.ts       Zod-validated env; decorated onto fastify.config; add new vars here + .env.example
src/server.ts       Fastify app wiring; only changes when mounting a new toolkit or mock route
```

## Invariants

- Tool names are **unprefixed** short names (`create_lead`, `get_transactions`). Tools are registered directly on the SDK server — no toolkit prefix.
- Auth context lives in `AsyncLocalStorage` populated in `plugins/mcp.ts` before `nodeHandler`. Handlers call `getCallerToken()` / `getCallerUser()` — never touch `ctx.http.authInfo` directly.
- Scope enforcement is via `withRequiredAuth({ scopes }, handler)` HOF declared at the tool definition site. `InsufficientScopeError` propagates to the Fastify `setErrorHandler` → HTTP 403 + `WWW-Authenticate`. Never check scopes in a central registrar.
- `createMcpHandler(() => mcpServer)` is called once at startup in `server.ts`. `McpServer` is constructed synchronously — no async startup needed. The MCP handler is stateless StreamableHTTP per request.
- App tools use `registerAppTool()` + `registerAppResource()` from `@modelcontextprotocol/ext-apps/server`. The `_meta.ui.resourceUri` links the tool to its HTML resource. HTML is read on-demand from `appsDir` in the resource callback.
- App tools do **not** require `outputSchema` — `structuredContent` is returned as a plain untyped object.
- `req.raw.auth` is still set (via `buildAuthInfo`) so the MCP SDK has `ctx.http.authInfo`. The ALS context is set in parallel — both exist per request. **Do not remove `req.raw.auth`** — it is the official SDK-mandated Fastify auth wiring convention; `toNodeHandler` reads it to populate `ctx.http.authInfo` in tool handlers. See ADR-0003.

## Coding conventions

**IO in ESM** — `import { readFile } from 'node:fs/promises'`; never `readFileSync`. Top-level `await` is valid in every `.ts` file here; there is no sync-only constraint.

**Type imports** — `import type { X } from '...'` as a separate statement. Never `import { type X }` inline. Mixed packages need two lines: one for types, one for values.

**Exports** — named exports only (`export { configPlugin }`). No `export default` for plugins or utilities; no framework in this project requires it.

**Fetch error handling** — wrap `fetch()` in try/catch for network errors (thrown), separate from `if (!res.ok)` for HTTP errors (returned). Two distinct failure modes; handle both.

**Token logging** — `{ hasAuthorization: Boolean(req.headers.authorization) }`. Never log token values.

**URL constants** — base URLs for toolkit fetches live in `toolkits/<domain>/urls.ts` as named constants. Never inline the same URL string across files.

**Named constants** — extract repeated numbers, error codes, and TTL strings (`-32000`, `'5m'`, `'Stateless mode: ...'`) to module-level `const`. No magic literals.

**Error variable names** — `errorMessage`, not `msg` or `e`. Include context: which audience/endpoint/operation failed and why.

**Type truthfulness** — mutable request decorators use `fastify.decorateRequest<T | undefined>('name', undefined)`. `req.user` is `RequestUser | undefined`; the `requireAuth()` preHandler hook guarantees it is set before any MCP route handler runs.

## Adding things

**New tool** — create `toolkits/<domain>/<name>.ts` exporting `function registerXxx(server: McpServer)` → call it inside `registerXxxTools` in `toolkits/<domain>/index.ts`. Use `server.registerTool(name, config, handler)` directly. Wrap the handler with `withRequiredAuth({ scopes: ['...'] }, handler)` when scope enforcement is needed.

**New toolkit** — new directory + `registerXxxTools(server: McpServer, appsDir?: string)` function → call it in `server.ts`. `server.ts` is the only registration point.

**New MCP App** — create `src/apps/<name>/index.tsx` exporting `export const App: FC = () => ...` → run `npm run build:apps` → use `registerAppTool` + `registerAppResource` from `@modelcontextprotocol/ext-apps/server` with `_meta: { ui: { resourceUri: 'ui://<name>' } }`. Pass `appsDir` to the toolkit function and read HTML on-demand in the resource callback.

## Context pointers

**product goals or spec compliance** → read `README.md`

**domain vocabulary** → read `CONTEXT.md`

**architecture decisions** → `docs/adr/` — before structural changes; key: 0001 (two-layer auth), 0003 (AuthInfo shape), 0005 (outputSchema contract), 0006 (tool visibility)

**open challenges** → `.scratch/`:
- `challenge-scope-enforcement.md` — gateway scope enforcement not yet wired
- `challenge-token-vault.md` — stateless token caching gap
- `challenge-ext-apps-wrapper.md` — client-side typed bridge for ext-apps
- `challenge-tool-annotations.md` — ToolAnnotations removed; MCP spec unstable
- `challenge-capability-negotiation.md` — per-connection app tool capability negotiation
- `challenge-upstream-auth-abstraction.md` — upstream auth removed; abstraction level TBD
