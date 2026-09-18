# Challenge: gateway scope enforcement

## What it is

`ToolDefinition.scopes?: string[]` exists but is never checked. Any authenticated user can call
any tool regardless of what scopes their token carries.

## What's missing

1. **HTTP boundary check** — before routing a `tools/call` request, verify the user's decoded
   JWT contains every scope listed in `tool.scopes`. If not, respond with:
   ```
   HTTP 403 Forbidden
   WWW-Authenticate: Bearer error="insufficient_scope",
                            scope="payments:write",
                            resource_metadata="https://server/.well-known/oauth-protected-resource"
   ```
2. **`scopes_supported` in resource metadata** — aggregate all unique `tool.scopes` values across
   all toolkits and advertise them in `/.well-known/oauth-protected-resource` so MCP clients know
   what scopes to request during the step-up authorization flow.
3. **`tools/list` visibility** — spec says: show all tools, enforce on call (not at discovery).
   Filtering tools from `tools/list` breaks the step-up flow because the client needs to see the
   tool to know to request the scope.

## Why deferred

No tool currently declares scopes. Wiring enforcement with zero declarations produces no observable
behavior — it would only add noise during development.

## When to act

When the first tool declares `scopes: [...]`, scope enforcement must be wired before that tool
ships. The implementation is straightforward once `tool.scopes` is populated.

## Implementation sketch

In `mcp-server.ts` or `mcpPlugin`:
1. After JWT validation, decode the token claims (already available via `req.user`).
2. For each tool being called, check `tool.scopes.every(s => userScopes.includes(s))`.
3. On failure, return 403 with the `WWW-Authenticate` header above (not an MCP-level error).
4. On success, proceed to the handler.

The user's decoded scopes are typically in `req.user.scope` as a space-separated string or
`req.user.permissions` as an array, depending on the Auth0 API configuration.
