# Challenge: ext-apps client-side wrapper

## What it is

The MCP App client components (`src/apps/profile-form/index.tsx`, `src/apps/transactions/index.tsx`)
use `@modelcontextprotocol/ext-apps` raw. This package provides the browser-side postMessage bridge
(`useApp`, `app.ontoolresult`, `app.callServerTool`) that connects the iframe to the MCP host.

`@modelcontextprotocol/ext-apps` v1.7.5 has `@modelcontextprotocol/sdk` v1.x as a peer dependency.
This is harmless — the peer dep is types-only in the browser bundle — but creates noise in the
dependency tree and diverges from the `@modelcontextprotocol/server` v2 the server side uses.

## Why deferred

1. **No v2 release yet.** Track: https://www.npmjs.com/package/@modelcontextprotocol/ext-apps
2. **Client and server are isolated.** The peer dep lives only in `src/apps/node_modules` and never
   reaches the server runtime. It's a cosmetic issue, not a functional one.
3. **The raw API is fine for two apps.** The pain of a wrapper shows up at app #3+.

## What a wrapper would look like

A thin `src/apps/shared/use-app.ts` (~60 lines) wrapping ext-apps with a typed API:

```typescript
// Typed alternative to app.ontoolresult + manual structuredContent cast
export function useToolResult<T>(app: App, onResult: (output: T) => void): void

// Typed alternative to app.callServerTool({ name, arguments })
export function useCallTool<TArgs, TResult>(name: string):
  (args: TArgs) => Promise<TResult>
```

The wrapper owns the typed contract; ext-apps owns the postMessage protocol underneath.
When ext-apps v2 ships, swap one import in `use-app.ts`.

## Inlining option (if ext-apps goes stale)

The core bridge is ~80 lines:
- `PostMessageTransport` — wraps `window.parent.postMessage` / `window.addEventListener('message')`
- A state machine for connected / pending / ready lifecycle
- `callServerTool` sends `tools/call` JSON-RPC over postMessage, awaits the response

The server-side counterpart is already inlined in `src/server/apps.ts`. The client side is symmetric.

## When to act

- ext-apps publishes a v2 compatible with `@modelcontextprotocol/server` v2 → update the dependency
- A third app is added and the raw `app.ontoolresult` + cast pattern becomes repetitive → add the wrapper
- ext-apps shows signs of abandonment (no releases for 6+ months) → inline the bridge
