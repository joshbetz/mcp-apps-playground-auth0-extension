import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { getCallerToken } from '../../server/context.ts';
import { withRequiredAuth } from '../../server/scopes.ts';
import type { TripBooking } from './types.ts';
import { getTravelBaseUrl } from './urls.ts';

const RESOURCE_URI = 'ui://travel-history';
const travelHistoryHtml = require('../../apps/dist/travel-history/mcp-app.html') as string;

export function registerGetTravelHistory(server: McpServer): void {
  registerAppTool(
    server,
    'get_travel_history',
    {
      description:
        "Retrieves the user's past and upcoming trips and renders them in a rich interactive panel. Each trip shows destination, dates, hotel, flight codes, and booking status. Users can click any trip to view the full invoice.",
      inputSchema: z.object({}),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    withRequiredAuth(
      { scopes: 'read:bookings' },
      async () => {
        let bookings: TripBooking[];
        try {
          const res = await fetch(`${getTravelBaseUrl()}/history`, {
            headers: { Authorization: `Bearer ${getCallerToken()}` },
          });
          if (!res.ok) throw new Error(`Travel API error: ${res.status} ${res.statusText}`);
          const data = (await res.json()) as { bookings: TripBooking[] };
          bookings = data.bookings;
        } catch (errorMessage) {
          throw new Error(`Failed to fetch travel history: ${String(errorMessage)}`);
        }

        const upcoming = bookings.filter((b) => b.status === 'upcoming').length;
        const completed = bookings.filter((b) => b.status === 'completed').length;

        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${bookings.length} booking${bookings.length === 1 ? '' : 's'} — ${upcoming} upcoming, ${completed} completed.`,
            },
          ],
          structuredContent: { bookings },
        };
      },
    ),
  );

  registerAppResource(server, 'Travel History', RESOURCE_URI, {}, async () => {
    return { contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: travelHistoryHtml }] };
  });
}
