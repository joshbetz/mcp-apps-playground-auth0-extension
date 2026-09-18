import type { McpServer } from '@modelcontextprotocol/server';

import { registerSearchDestinations } from './search-destinations.ts';

export function registerRecommendationsTools(server: McpServer): void {
  registerSearchDestinations(server);
}
