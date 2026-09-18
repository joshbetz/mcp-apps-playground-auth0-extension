# Challenge: tool annotations

## Current state

`ToolAnnotations` and the `annotations` field were removed from tool definitions in this playground. Tools are registered without hint metadata; the MCP SDK applies its spec defaults.

## Why this was deferred

The MCP spec's `ToolAnnotations` shape (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) is under active discussion and expected to change significantly. Investing in a strict annotation contract now would create churn when the spec stabilises.

## Why it matters for auth0-mcp-js

The spec defaults are biased toward caution: `destructiveHint` defaults to `true` and `openWorldHint` defaults to `true`. An MCP gateway that omits annotations will cause clients to assume every tool is destructive and internet-connected, which degrades the client experience (e.g. confirmation prompts, sandboxing).

The right answer depends on the final spec shape:
- If annotations stay as-is, `auth0-mcp-js` should require all four fields at authoring time (the original approach here).
- If annotations are replaced by a different hint model, `auth0-mcp-js` should adopt that model directly.

## When to act

Once the MCP spec stabilises the annotations shape. Track: https://github.com/modelcontextprotocol/modelcontextprotocol/issues
