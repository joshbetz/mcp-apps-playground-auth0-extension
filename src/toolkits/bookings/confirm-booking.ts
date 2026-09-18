import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { getCallerToken } from '../../server/context.ts';
import { withRequiredAuth } from '../../server/scopes.ts';
import type { BookingConfirmation } from './types.ts';
import { getTravelBaseUrl } from './urls.ts';

export function registerConfirmBooking(server: McpServer): void {
  const schema = z.object({
    tripId: z.string().min(1).describe('Trip ID selected by the user'),
    leadPassengerName: z.string().min(1).describe('Full name of the lead passenger'),
    email: z.string().email().describe('Contact email for confirmation'),
  });

  server.registerTool(
    'confirm_booking',
    {
      description: 'Confirms and books the selected trip. Called from within the book_trip app after the user reviews and approves their selection.',
      inputSchema: schema,
    },
    withRequiredAuth(
      { scopes: 'bookings:write' },
      async (args: z.infer<typeof schema>) => {
        let confirmation: BookingConfirmation;
        try {
          const res = await fetch(`${getTravelBaseUrl()}/bookings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getCallerToken()}`,
            },
            body: JSON.stringify(args),
          });
          if (!res.ok) throw new Error(`Travel API error: ${res.status} ${res.statusText}`);
          confirmation = (await res.json()) as BookingConfirmation;
        } catch (errorMessage) {
          throw new Error(`Failed to confirm booking for trip "${args.tripId}": ${String(errorMessage)}`);
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: `Booking confirmed! Reference: **${confirmation.bookingId}**. ${confirmation.message}`,
            },
          ],
          structuredContent: confirmation,
        };
      },
    ),
  );
}
