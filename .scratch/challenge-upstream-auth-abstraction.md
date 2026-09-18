# Challenge: upstream auth abstraction level

## The tension

Tools that call an upstream API need a token for that API. Today, `upstream_auth` is declared on the `Toolkit` — all tools in a toolkit share the same auth strategy and audience. This is convenient (declare once, all tools inherit) but it assumes homogeneity: every tool in the toolkit hits the same upstream API with the same token type.

In practice this holds: `payments` tools all call the banking API, `profile` tools all call the profile API. But the abstraction is silent about this assumption, and it breaks as soon as one toolkit needs to call two different upstream APIs.

## Current state (as of rearch)

`upstream_auth` has been **removed** from the playground. Toolkit factories are gone; toolkits are registered via a callback builder API. Tool handlers receive `accessToken` (the raw gateway token) directly. There is no upstream token exchange at the moment — this was dropped to simplify the authoring surface and focus the research on identity patterns.

```typescript
server.toolkit('payments', (toolkit) => {
  toolkit.registerTool('initiate_transfer', { scopes: ['transfers:write'], ... }, async ({ accessToken }) => {
    // accessToken is the raw gateway token — callers use it directly for now
  });
});
```

When upstream auth returns, the natural home is a `server.toolkit()` options object (second arg), with `upstreamScopes` as a per-tool registration field:

```typescript
server.toolkit('payments', { upstreamAuth: tokenExchange(apiClient, BANKING_AUDIENCE) }, (toolkit) => {
  toolkit.registerTool('initiate_transfer', { scopes: ['transfers:write'], upstreamScopes: ['banking:write'] }, handler);
});
```

The `server.toolkit(name, options, callback)` overload is already in place (options currently empty) — adding `upstreamAuth` to `ToolkitOptions` is additive, not breaking.

## Why this matters

The real auth0-mcp-js SDK will need to answer: at what level does upstream auth live? Options:

**Toolkit level (current)** — shared strategy, one audience per toolkit. Simple, matches the common case. Forces one-toolkit-per-upstream-API split. Does not compose when an agent needs to call two upstream APIs from the same logical domain.

**Tool level** — each `protectTool()` (or a new `withUpstreamAuth()` wrapper) declares the upstream strategy inline. Maximum flexibility. Repetitive when 5 tools share the same strategy. Makes the toolkit a pure naming primitive.

**Both (inheritance with override)** — toolkit declares a default upstream strategy; individual tools can override. Common in authorization libraries (e.g., route-level defaults with per-handler overrides). Adds API complexity.

## Related challenge

When `upstream_auth` moves to the tool level, the factory functions (`createPaymentsToolkit`) still need access to `config` and `apiClient` to construct the strategy. This is fine today because the factory captures them in scope. In the real SDK, the instantiation site needs to pass these through without coupling every `defineTool` call to runtime config.

A possible SDK primitive: `defineUpstreamAuth(strategy)` as a named constant defined once in the toolkit factory, referenced by each tool. Avoids per-tool repetition without forcing toolkit-level homogeneity.

## When to act

When a real use case requires a single toolkit to call multiple upstream APIs, or when per-tool upstream auth variation becomes a documented pattern. For the current playground (one upstream API per toolkit), the current model is sufficient.
