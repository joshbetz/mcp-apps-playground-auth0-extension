# structuredContent and outputSchema: spec contract enforced at the type level

`structuredContent` is a core MCP protocol field (spec 2026-07-28). When a tool declares
`outputSchema`, the spec requires that its `structuredContent` conforms to that schema
(`MUST`). `HandlerResult` is generic to enforce this at compile time rather than at runtime.

## What structuredContent is

Any JSON value returned alongside `content` in a tool result. It is not specific to app
tools or a2ui — it is the standard mechanism for machine-readable tool output. Tools may
return it with or without an `outputSchema`. The spec also recommends serialising it as a
text block in `content` for backwards compatibility.

## How outputSchema and structuredContent relate

When `outputSchema` is declared on a tool, the server is making a spec-level promise:
`structuredContent` will conform to that schema. Clients may validate against it. Two
patterns in this codebase:

- **Regular tool with no `outputSchema`** (e.g. `initiate-transfer`, `profile/get`):
  `structuredContent` is `Record<string, unknown>` — valid per spec, no declared contract.
- **App tool with required `outputSchema`** (e.g. `get-transactions`): `structuredContent`
  must match the declared schema. The iframe and the client depend on this contract.

## Decision

`HandlerResult` is generic: `HandlerResult<TStructured = Record<string, unknown>>`. The
`TStructured` type parameter is inferred from `outputSchema` via the definition's type
parameters (`TOutput extends z.ZodTypeAny`). When `outputSchema` is absent, `TStructured`
defaults to `Record<string, unknown>` — no breakage, same behaviour as before.

`AppToolConfig` requires `TOutput` explicitly (no default) because `outputSchema` is a
required field. `ToolConfig` defaults `TOutput` to `z.ZodType<Record<string, unknown>>`
because `outputSchema` is optional.

## Distinct uses of structuredContent in this codebase

| Tool | outputSchema | structuredContent content |
|---|---|---|
| `profile/get` | none | raw profile object — supplementary data, no schema contract |
| `initiate-transfer` | none | `{ mimeType: 'application/a2ui+json', spec: ... }` — a2ui payload |
| `get-transactions` | declared | transaction list — spec-enforced, iframe depends on it |
| `execute-transfer` | none | transfer result — supplementary data, no schema contract |

a2ui payloads (`application/a2ui+json`) are a separate concern from `outputSchema`. They
use `structuredContent` as a transport but are not validated against a Zod schema — the
a2ui spec defines their shape independently.

## Current state (post-middleware-refactor)

`HandlerResult<TStructured>` was removed when the toolkit abstraction was replaced with direct
`server.registerTool()` calls. Tool handlers now return plain `{ content, structuredContent }`
typed by the MCP SDK's `CallToolResult` — the compile-time `outputSchema` enforcement described
above is no longer active in the playground.

This is an open design item for `auth0-mcp-js`: when the SDK exposes first-class `outputSchema`
typing on `registerTool`, the enforcement pattern here should be revisited.

## Considered options

- **Keep `HandlerResult` non-generic**: rejected — a tool declaring `outputSchema` is making
  a spec-level MUST commitment. TypeScript not enforcing it means the contract can be silently
  broken and only caught at runtime (or not at all, if the client skips validation).
- **Separate `TypedHandlerResult<T>` interface**: rejected — adds a second return type that
  handlers must remember to use. One generic interface with a default is less error-prone.
