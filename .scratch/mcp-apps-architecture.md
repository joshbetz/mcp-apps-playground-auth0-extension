# MCP Apps — Architecture Summary

## What they are

MCP Apps are sandboxed React apps rendered in an iframe by the MCP host (Claude, Cursor, etc.). They sit alongside tool calls: when a tool declares `app: { name: 'foo' }`, the host fetches the `ui://foo` resource URI and renders the HTML bundle in a panel. The app communicates with the host via `postMessage` (the MCP App Bridge protocol).

**Key property:** the app is identity-agnostic. The MCP server handles all auth — token exchange, API token injection — before the handler runs. The app just calls tools and displays results.

---

## Folder structure

```
src/
  apps/                          ← browser-only code, excluded from root tsconfig
    profile-form/
      index.tsx                  ← only file per app; exports named `App` component
      dist/index.html            ← built single-file HTML (gitignored)
    transactions/
      index.tsx                  ← only file; split logic into hooks/ etc if needed
      dist/index.html
    build.ts                     ← discovers apps, builds each to <name>/dist/index.html
    dev.ts                       ← discovers apps, starts vite watch per app
    .gitignore                   ← ignores */index.html and */main.tsx (generated)
    package.json                 ← shared node_modules for all apps
    vite.config.base.ts          ← viteSingleFile + react plugin
    tsconfig.json                ← jsx: react-jsx, moduleResolution: Bundler

  server/
    mcp-server.ts                ← McpServer.create({ appsDir }) reads HTML from disk at startup
    apps.ts                      ← registerAppTool(), registerAppResource() (inlined from ext-apps)
    tool.ts                      ← ToolDefinition: app?: { name: string } with required outputSchema

  toolkits/
    payments/get-transactions.ts ← app: { name: 'transactions' }, outputSchema
    profile/update.ts            ← app: { name: 'profile-form' }, outputSchema

  server.ts                      ← await McpServer.create({ appsDir, toolkits })
```

---

## Build pipeline

```
npm run build:apps     (tsx build.ts)
  → scans src/apps/*/index.tsx for apps
  → per app: writes index.html + main.tsx, runs vite build, deletes them
  → output: src/apps/<name>/dist/index.html per app

npm run dev            (tsx dev.ts)
  → same discovery
  → writes index.html + main.tsx (kept for watch duration, cleaned on exit)
  → starts vite build --watch per app
```

Adding an app: create `src/apps/new-app/index.tsx` exporting `export const App: FC = () => ...`. Run `npm run build:apps`. Nothing else.

---

## Server-side registration

`McpServer.create()` reads built HTML from disk at startup:

```typescript
const appsDir = fileURLToPath(new URL('./apps', import.meta.url));
const mcpServer = await McpServer.create({ appsDir, toolkits: [...] });
```

`McpServer.create()` scans `appsDir/*/dist/index.html` and builds an internal map. Apps with no built output are silently skipped; if a tool references one, it throws at request time.

When a tool has `app: { name: 'profile-form' }`:
1. `registerAppTool()` registers the MCP tool with `_meta.ui.resourceUri: 'ui://profile-form'`
2. `registerAppResource()` registers a `text/html;profile=mcp-app` resource at `ui://profile-form`

Tools with `app` must also declare `outputSchema` — enforced at the type level in `ToolDefinition`.

---

## Client-side bridge

Apps use `@modelcontextprotocol/ext-apps` raw for the postMessage protocol:

- `useApp()` — sets up the App Bridge, provides `{ app, isConnected, error }`
- `app.ontoolresult` — receives `structuredContent` pushed by the host on `ui/initialize`
- `app.callServerTool()` — calls an MCP tool from inside the iframe, returns the result

**profile-form** uses `ontoolresult` to receive a JWT from `structuredContent.contextJwt`, decodes it to pre-fill the form. On submit, calls `app.updateModelContext()` + `app.sendMessage()`.

**transactions** uses `callServerTool('payments_get_transactions', {})` on connect to fetch data, renders a table.

---

## Tool annotations

All four fields are required in `ToolDefinition` to prevent relying on dangerous spec defaults:

| Field | Default (spec) | Risk if omitted |
|---|---|---|
| `readOnlyHint` | `false` | Fine (conservative) |
| `destructiveHint` | **`true`** | Client assumes destructive |
| `idempotentHint` | `false` | Fine (conservative) |
| `openWorldHint` | **`true`** | Client assumes external reach |

`ToolAnnotations` is imported from `@modelcontextprotocol/server` (not redefined locally). JSDoc on each field calls out the dangerous defaults and spec semantics.

---

## Type sharing between apps and server

Apps import types from `../../toolkits/*/types.ts` (e.g. `Transaction`, `ProfileContext`). This is a **build-time-only** dependency — Vite resolves the import during the build and `vite-plugin-singlefile` inlines everything into the HTML bundle. No server code reaches the browser at runtime.

When apps move to API-serving (bundles pulled from an API rather than compiled locally), this cross-boundary import breaks — apps won't have access to `src/toolkits/` at build time. At that point, options are:

- **`src/apps/shared/types/`** — manually maintained copies of the types apps need. Explicit isolation boundary; types diverge intentionally at the API boundary.
- **mcp-use module augmentation** — `mcp-env.d.ts` + `RegisteredTools` inference (requires building the framework inference machinery; not worth it here).

For now: keep the direct import, it's fine. The isolation concern is deferred until API-serving is real.

---

## Known challenges / deferred work

See `.scratch/challenge-ext-apps-wrapper.md` for the full write-up. Summary:

- **ext-apps SDK v1 peer dep** — `@modelcontextprotocol/ext-apps` v1.7.5 requires `@modelcontextprotocol/sdk` v1.x as a peer. Harmless (browser bundle, types only) but misaligned with server v2. Track: https://www.npmjs.com/package/@modelcontextprotocol/ext-apps
- **No typed API** — `app.ontoolresult` + manual `structuredContent` cast is raw. A `useToolResult<T>()` / `useCallTool()` wrapper (~60 lines) would type this, but deferred until a 3rd app makes the pattern painful
- **Inline option** — if ext-apps goes stale, the bridge is ~80 lines of postMessage code; server side already inlined in `src/server/apps.ts`

---

## What this is for

Research playground exploring what "we handle identity automatically" means for an MCP Gateway product. The MCP Apps layer shows how the gateway can render rich UIs that receive context from the server without the LLM ever seeing PII. The codebase is a pattern study, not production code.
