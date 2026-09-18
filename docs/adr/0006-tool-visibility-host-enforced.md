# Tool visibility is declared by the gateway, enforced by the host

`visibility` (`_meta.ui.visibility`) is a UI signal from the ext-apps spec. It tells the MCP
host which tools to include in the model's tool list (`"model"`) vs which are callable only
by app UIs (`"app"`). The gateway's responsibility is to declare it correctly; the host
(MCP client) is responsible for acting on it.

## Decision

The gateway passes `visibility` through in `_meta.ui` at tool registration. It does not
enforce visibility at the HTTP boundary. This is correct per spec — visibility is
host-enforced, and the SDK communicates intent via `_meta`. No gateway-level enforcement
should be added for this field.

The comment on `execute-transfer` ("requires host-side visibility enforcement to take
effect") is accurate and intentional. Do not add a gateway-level check that gates tool
calls based on `visibility`.

## The gap for sensitive operations

The ext-apps spec notes that visibility alone is not a security boundary. For operations
where the gateway needs to ensure only app UIs can trigger them, the recommendation is to
combine visibility with server-side validation — returning `isError: true` from the handler
if the caller context is not an app.

`execute-transfer` currently does not do this. It declares `visibility: ['app']` but has
no handler-level check. This is acceptable for a research fixture, but is a concrete spec
item for `auth0-mcp-js`: the SDK should provide a mechanism to enforce app-only
callability at the handler level, not just via `_meta` declaration.

## Considered options

- **Gateway enforces visibility at the HTTP boundary**: rejected — there is no standard
  signal in the MCP Streamable HTTP request that identifies the caller as an app UI vs an
  LLM-driven client. Enforcement at this layer would require a proprietary convention.
- **No visibility field at all**: rejected — the field is part of the ext-apps spec and is
  meaningful for hosts that implement it (e.g. Claude Desktop with ext-apps support).
