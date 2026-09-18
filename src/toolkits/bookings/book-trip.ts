import { registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { getCallerToken } from '../../server/context.ts';
import { withRequiredAuth } from '../../server/scopes.ts';
import type { TripSearchResult } from './types.ts';
import { getTravelBaseUrl } from './urls.ts';

const RESOURCE_URI = 'ui://book-trip';
const RESOURCE_MIME_TYPE = 'text/html';
const bookTripHtml = require('../../apps/dist/book-trip/mcp-app.html') as string;

export function registerBookTrip(server: McpServer): void {
  const schema = z.object({
    origin: z.string().min(1).describe('Departure city or airport, e.g. "London"'),
    destination: z.string().min(1).describe('Destination city, e.g. "Paris"'),
    departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
    returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format (omit for one-way)'),
    passengers: z.number().int().min(1).max(9).default(1).describe('Number of passengers'),
  });

  registerAppTool(
    server,
    'book_trip',
    {
      description:
        'Searches available flight + hotel packages for a route and date range, then renders them as selectable cards. The user picks a package, reviews it, and confirms — the booking is handled entirely within the UI.',
      inputSchema: schema,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    withRequiredAuth(
      { scopes: 'read:destinations' },
      async (args: z.infer<typeof schema>) => {
        const url = new URL(`${getTravelBaseUrl()}/search`);
        url.searchParams.set('origin', args.origin);
        url.searchParams.set('destination', args.destination);
        url.searchParams.set('departureDate', args.departureDate);
        if (args.returnDate) url.searchParams.set('returnDate', args.returnDate);
        url.searchParams.set('passengers', String(args.passengers));

        let data: TripSearchResult;
        try {
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${getCallerToken()}` },
          });
          if (!res.ok) throw new Error(`Travel API error: ${res.status} ${res.statusText}`);
          data = (await res.json()) as TripSearchResult;
        } catch (errorMessage) {
          throw new Error(
            `Failed to search trips from ${args.origin} to ${args.destination}: ${String(errorMessage)}`,
          );
        }

        const cheapest = data.options.reduce(
          (min, o) => (o.totalPrice < min.totalPrice ? o : min),
          data.options[0],
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${data.total} package${data.total === 1 ? '' : 's'} for ${args.origin} → ${args.destination}. Prices from ${cheapest?.currency} ${cheapest?.totalPrice.toFixed(0)} for ${args.passengers} pax.`,
            },
          ],
          structuredContent: data,
        };
      },
    ),
  );

  registerAppResource(server, 'Book a Trip', RESOURCE_URI, {}, async () => {
    return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: bookTripHtml }] };
  });
}
