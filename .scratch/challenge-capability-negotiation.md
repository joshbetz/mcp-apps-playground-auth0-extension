# Challenge: capability negotiation for app tool registration

## Current state

App tools are registered unconditionally at startup. Every client that connects sees app tools in `tools/list` regardless of whether it supports MCP App rendering.

## The spec

The 2026-01-26 ext-apps spec adds per-connection capability negotiation:

```typescript
// Client advertises UI support in initialize:
{ capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } }

// Server checks via SDK helper:
import { getUiCapability } from "@modelcontextprotocol/ext-apps/server";
const uiCap = getUiCapability(clientCapabilities);
if (uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE)) {
  // register app tools
} else {
  // register text-only fallback or skip
}
```

## Why this is deferred

This playground uses stateless Streamable HTTP (SEP-2575) — there is no persistent session. App tools and resources are registered once at startup on a single `McpServer` instance shared across all requests. Per-connection conditional registration would require either:

1. Re-building the SDK server per request (defeats the stateless design)
2. Registering all tools and relying on the host to filter based on its own capabilities

Option 2 is effectively what we do today and is a reasonable fallback — hosts that don't support MCP Apps will simply show app tools as regular tools and never render iframes.

## When to act

When a stateful session model is introduced, or when a host ecosystem emerges where graceful fallback to text-only tools is required by product.
