# Two-layer auth model: gateway scopes and upstream scopes are separate concerns

The gateway operates two independent OAuth trust boundaries. User tokens are validated against
the gateway's own audience (`AUTH0_AUDIENCE`); upstream API calls are authenticated separately
via the toolkit's upstream auth strategy. These boundaries never collapse: gateway scopes
(`tool.scopes`) control whether a user may call a tool; upstream scopes (`tool.upstreamScopes`)
control what the gateway requests from the upstream API's authorization server. Declared at the
tool level, not the toolkit level, because a user may have permission to call some tools in a
toolkit but not others.

## Considered options

- **Single scope namespace**: use one set of scopes for both the gateway check and the upstream
  call. Rejected because gateway scopes and upstream scopes belong to different OAuth audiences
  and have different issuers — conflating them creates confused-deputy vulnerabilities.
- **Toolkit-level gateway scopes**: declare required scopes on the toolkit, not individual tools.
  Rejected because per-tool granularity is needed (e.g., `read:transactions` vs `write:transfers`
  within the same payments toolkit) and because this conflicts with the step-up auth flow, which
  operates at the tool level.
- **Policy-based access (Pomerium PPL / agentgateway CEL)**: declare access rules as expressions
  rather than OAuth scopes. Rejected because it introduces a non-standard authorization layer on
  top of OAuth, breaking the "treat MCP auth identically to any HTTP resource" principle. Standard
  Bearer + scopes is the correct primitive here.
