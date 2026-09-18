# MCP Gateway

A research gateway that abstracts identity and authentication for MCP tools. The gateway sits between MCP clients and upstream APIs, handling auth at both boundaries so tool handlers never call auth themselves.

## Language

### Toolkit structure

**Toolkit**:
A named group of related tools that share a single upstream API and a single upstream auth strategy.
_Avoid_: Module, plugin, service

**Open toolkit**:
A toolkit whose tools require no user authentication at the HTTP boundary. Any caller may invoke them.
_Avoid_: Public toolkit, unauthenticated toolkit

**Authenticated toolkit**:
A toolkit that requires a valid user token at the HTTP boundary before any tool in it may be called. Covers both service-auth and user-delegated upstream strategies.
_Avoid_: Protected toolkit (collides with tool visibility), secured toolkit

### Auth layers

**Upstream auth**:
The strategy a toolkit uses to authenticate the gateway against its upstream API. Independent of whether the user is authenticated. Declared on the toolkit, not on individual tools.
_Avoid_: Toolkit auth, backend auth, downstream auth

**Service-auth upstream**:
An upstream auth strategy where the gateway obtains its own M2M token via client credentials. The user's identity never reaches the upstream API.
_Avoid_: Server-to-server auth, machine auth

**User-delegated upstream**:
An upstream auth strategy where the user's gateway token is exchanged for an upstream-specific token. The user's identity flows through to the upstream API.
_Avoid_: On-behalf-of, OBO, forwarded auth

### Scopes

**Gateway scope**:
An OAuth scope on the user's token, issued for the gateway's audience, required to call a specific tool. Enforced at the HTTP boundary. Declared on the tool, not the toolkit.
_Avoid_: User scope, MCP scope, route scope

**Upstream scope**:
An OAuth scope requested from the upstream API's authorization server on a per-tool basis. Optional — omitting it lets the AS grant its defaults. Only meaningful for tools in toolkits with an upstream auth strategy.
_Avoid_: Backend scope, downstream scope, service scope

### Caching

**Token vault**:
An external, shared store for gateway-to-upstream tokens (both M2M and exchanged). Required for stateless, horizontally-scaled deployments where in-process caching is insufficient.
_Avoid_: Token cache, credential store
