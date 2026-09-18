# Use Auth0 SDK primitives directly; cross-SDK coordination as evidence for auth0-mcp-js

This playground is the research base for a future `auth0-mcp-js` SDK. The rule here is:
use the highest-level Auth0 SDK primitive that exists for each operation. Where no suitable
primitive exists, keep the raw implementation and record the gap — the gaps are the spec
items for `auth0-mcp-js`.

## Package roles

Two Auth0 packages serve distinct trust boundaries and must not be collapsed:

| Package | Role in this codebase |
|---|---|
| `@auth0/auth0-api-js` (`ApiClient`) | Gateway boundary — verifies incoming user tokens via `verifyAccessToken`. This is the resource-server concern. |
| `@auth0/auth0-auth-js` (`AuthClient`) | Upstream auth — obtains tokens for calling upstream APIs (`getTokenByClientCredentials`, `exchangeToken`). This is the client concern. |

`auth0-auth-js` is the lower-level primitive; `auth0-api-js` builds on top of it and adds
`verifyAccessToken`. For gateway verification there is no equivalent in `auth0-auth-js`.

## Decision

1. **Replace raw OAuth fetches with SDK methods where a suitable primitive exists.**
   `AuthClient.getTokenByClientCredentials()` replaces the previous manual `POST /oauth/token`
   in `AuthStrategies.clientCredentials`. The SDK handles the HTTP plumbing and returns
   a typed `{ accessToken, expiresAt }` with expiry in epoch seconds.

2. **Do not abstract across SDKs yet.** The fact that achieving the MCP gateway's full auth
   model requires coordinating two separate packages (`api-js` for verification, `auth-js` for
   acquisition) is itself the primary evidence for `auth0-mcp-js`. Abstracting now would hide
   that signal.

3. **Record SDK gaps as spec items.** `AuthClient.getTokenByClientCredentials` does not accept
   a `scope` parameter, so per-tool upstream scopes in M2M flows are not supported. This is a
   concrete capability gap that `auth0-mcp-js` must address.

## Considered options

- **Abstract both clients behind a single `GatewayAuth` helper now**: rejected — premature
  abstraction hides the cross-SDK coordination friction that justifies the future SDK.
- **Keep raw fetch for client credentials**: rejected — the SDK primitive exists and the raw
  implementation was reimplementing what `AuthClient.getTokenByClientCredentials` already does.
- **Use `AuthClient.exchangeToken` directly instead of `ApiClient.getTokenOnBehalfOf`**:
  deferred — `getTokenOnBehalfOf` already uses the SDK and works correctly; switching to the
  lower-level primitive offers no current benefit.

## Reference: vercel/mcp-handler

`@vercel/mcp-handler` solves the HTTP/protocol layer for MCP (Streamable HTTP, spec version
negotiation, standard `Request`/`Response`) and aligns closely with the stateless design of
this playground. Relevant patterns:

- **`withMcpAuth` middleware** — framework-agnostic bearer token enforcement and RFC 9728
  `WWW-Authenticate` challenges. Equivalent to our `requireAuth`/`tryAuth` Fastify decorators,
  but not tied to Fastify. This is the right shape for `auth0-mcp-js`'s gateway boundary layer.
- **`createMcpHandler((server) => { ... })` entry point** — functional factory; the `server`
  object is provided to the callback rather than constructed by the caller. Preferable to the
  class instantiation pattern for a public SDK.
- **No toolkit grouping** — tools are registered individually. The upstream-auth-per-toolkit
  abstraction is specific to the gateway use case and is `auth0-mcp-js`'s differentiated feature.

## Target shape for auth0-mcp-js

**Note**: the shape below supersedes the earlier define-first draft (`tools: [...]` list).
The playground rearch (register-first builder API) settled the authoring pattern.

```ts
// Customer's route handler (framework-agnostic)
export default withAuth0(
  createMcpHandler((server) => {
    server.toolkit('payments', {
      upstreamAuth: server.auth.tokenExchange('https://api.banking.com'),
    }, (toolkit) => {
      toolkit.registerTool('initiate_transfer', { scopes: ['transfers:write'] }, handler);
      toolkit.registerAppTool('get_transactions', {
        scopes: ['transactions:read'],
        app: 'ui://transactions',
        outputSchema: z.object({ ... }),
      }, handler);
    });
    server.toolkit('crm', {
      upstreamAuth: server.auth.clientCredentials('https://api.crm.com'),
    }, (toolkit) => {
      toolkit.registerTool('create_lead', { scopes: ['leads:write'] }, handler);
    });
    server.toolkit('market', (toolkit) => {
      toolkit.registerTool('get_exchange_rate', { ... }, handler);
    });
  }),
  { domain, clientId, clientSecret, audience }
);
```

`withAuth0` wraps `withMcpAuth` using `ApiClient.verifyAccessToken` for the gateway boundary.
`server.auth.*` strategies are bound to a single `AuthClient` owned by `withAuth0` — the
customer provides the upstream audience; the SDK provides the credentials and plumbing.
`server.toolkit()` is the grouping abstraction absent from `mcp-handler`. The two-arg form
`(name, callback)` handles open toolkits; the three-arg form `(name, options, callback)`
adds `upstreamAuth` for authenticated toolkits.

## Known gaps (auth0-mcp-js spec items)

- Per-tool M2M upstream scopes (`upstreamScopes` on M2M flows) — `getTokenByClientCredentials`
  has no `scope` parameter in the current SDK.
- In-process token caching for `tokenExchange` — `getTokenOnBehalfOf` does not return
  `expiresAt`, so OBO tokens cannot be cached at the strategy layer today.
- Token vault for stateless, horizontally-scaled deployments — in-process caching in
  `clientCredentials` is insufficient. See also `challenge-token-vault.md`.
- `auth0-mcp-js` needs to wrap both `@auth0/auth0-auth-js` and `@auth0/auth0-api-js`; neither
  alone covers the full gateway auth model.
