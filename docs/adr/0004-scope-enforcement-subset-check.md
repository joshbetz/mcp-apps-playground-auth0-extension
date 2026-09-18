# Scope enforcement: order-independent subset check against the access token

Gateway scope enforcement checks that every scope declared on a tool (`tool.scopes`) is present
in the caller's access token, regardless of order. A token granting `["leads:write", "read:profile"]`
satisfies a tool requiring `["read:profile"]`.

## Decision

`requireScopes` filters the required scopes against `authInfo.scopes` using `Array.includes`.
This is an order-independent subset check. No scope registry, no format validation, no ordering
constraint — the token either contains all required scopes or the call is rejected with
`insufficient_scope`.

Scope strings are space-delimited in the JWT (`scope` claim, RFC 6750). `buildAuthInfo` parses
them into an array once at the auth seam; all downstream code operates on arrays.

## Considered options

- **Scope registry**: a central const of known scopes; tool definitions reference keys. Rejected
  — adds maintenance overhead with no runtime benefit for this use case. Scope validity is
  enforced by the Auth0 tenant at token issuance, not by the gateway.
- **Format validation at `defineTool` time**: check that scope strings match a pattern. Rejected
  — the gateway does not own the scope namespace; Auth0 does. Validating format here would
  duplicate a constraint that belongs to the identity provider.
- **Order-sensitive matching**: rejected — OAuth scopes are a set, not a sequence. Order
  dependence would be incorrect per spec.
