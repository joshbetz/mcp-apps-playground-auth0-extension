import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { getCallerToken } from '../../server/context.ts';
import { withRequiredAuth } from '../../server/scopes.ts';
import type { DestinationSearchResult } from './types.ts';
import { getTravelBaseUrl } from './urls.ts';

const RESOURCE_URI = 'ui://recommendations';
const RESOURCE_MIME_TYPE = 'text/html';
const recommendationsHtml = require('../../apps/dist/recommendations/mcp-app.html') as string;

export function registerSearchDestinations(server: McpServer): void {
  const schema = z.object({
    query: z.string().min(1).describe('Search query — e.g. "beach getaway", "cultural city break", "romantic Europe"'),
    departureCity: z.string().optional().describe('City you are departing from, e.g. "London"'),
    maxBudget: z.number().positive().optional().describe('Maximum average nightly hotel rate in USD'),
  });

  registerAppTool(
    server,
    'search_destinations',
    {
      description:
        'Searches travel destinations matching a query and renders results as rich destination cards. Returns highlights, ratings, and price ranges to help choose the next trip.',
      inputSchema: schema,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    withRequiredAuth(
      { scopes: 'read:destinations' },
      async (args: z.infer<typeof schema>) => {
        const url = new URL(`${getTravelBaseUrl()}/destinations`);
        url.searchParams.set('q', args.query);
        if (args.maxBudget != null) url.searchParams.set('maxBudget', String(args.maxBudget));

        let data: DestinationSearchResult;
        try {
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${getCallerToken()}` },
          });
          if (!res.ok) throw new Error(`Travel API error: ${res.status} ${res.statusText}`);
          data = (await res.json()) as DestinationSearchResult;
        } catch (errorMessage) {
          throw new Error(
            `Failed to fetch destinations for query "${args.query}": ${String(errorMessage)}`,
          );
        }

        const summary = data.destinations
          .slice(0, 3)
          .map((d) => `${d.name} (${d.country}) — from €${d.avgNightlyRate}/night, ⭐ ${d.rating}`)
          .join('; ');

        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${data.total} destination${data.total === 1 ? '' : 's'} for "${args.query}". Top picks: ${summary}.`,
            },
          ],
          structuredContent: data,
        };
      },
    ),
  );

  registerAppResource(server, 'Travel Recommendations', RESOURCE_URI, {}, async () => {
    return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: recommendationsHtml }] };
  });
}
