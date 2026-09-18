# Challenge: stateless token caching and the token vault

## The tension

MCP v2 (SEP-2575) is stateless — no `Mcp-Session-Id`, each request is self-contained.
Token exchange (RFC 8693) produces user-specific, audience-specific tokens that should be
reused, not re-fetched on every tool call. These goals conflict.

## Current state

`AuthStrategy.clientCredentials` caches M2M tokens in-process keyed by `audience`. This
works for single-instance deployments but does not survive horizontal scaling.

`AuthStrategy.tokenExchange` has no cache — it performs a fresh exchange on every request.
At scale, this means N×M Auth0 API calls per second (N users × M toolkits per request).

## Why this matters

Exchanged tokens are user-specific and scope-specific. There is no shared state between
stateless MCP server instances where they could be cached. In-process caching only helps
within a single instance and is lost on restart.

Research across Pomerium, agentgateway, and decocms/studio confirms: every production
gateway that avoids per-request token exchange maintains some form of external token store
(Pomerium's Databroker, studio's encrypted DB vault).

## The solution: Auth0 Token Vault

Auth0's token vault is a managed external store for upstream OAuth credentials. It stores
exchanged and M2M tokens, keyed by user identity and audience, with automatic refresh.
This is the correct production solution:

- Works across stateless instances (external, shared store)
- Handles token refresh automatically
- Supports per-user, per-audience, per-scope-set keying
- Already part of the Auth0 product surface (`@auth0/auth0-api-js` integration)

## Cache key design (for any implementation)

```
clientCredentials:   audience + sortedScopes
tokenExchange:       sha256(userAccessToken) + audience + sortedScopes
```

The user token hash (not the token itself) as the cache key avoids storing sensitive
material as a key while still producing stable keys for the same user session.

## When to act

When the gateway moves beyond a single-instance deployment, or when exchange latency becomes
observable in production. For the playground (single instance, research purposes), per-request
exchange is acceptable.

## Scope elevation and caching

When a tool declares `upstreamScopes`, the exchange must request base scopes + tool-specific
scopes. The cache must key on the full scope set, not just the audience:

```
cache.get(`${userHash}:${audience}:${sortedScopes.join(',')}`)
```

Different tools in the same toolkit with different `upstreamScopes` produce separate cache
entries. This is correct: a token for `['transactions:read']` cannot satisfy
`['transactions:read', 'transfers:write']`.
