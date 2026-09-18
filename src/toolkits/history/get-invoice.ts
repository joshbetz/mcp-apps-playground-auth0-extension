import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { getCallerToken } from '../../server/context.ts';
import { withRequiredAuth } from '../../server/scopes.ts';
import type { Invoice } from './types.ts';
import { getTravelBaseUrl } from './urls.ts';

export function registerGetInvoice(server: McpServer): void {
  const schema = z.object({
    bookingId: z.string().min(1).describe('Booking ID, e.g. BK-2026-0038'),
  });

  server.registerTool(
    'get_invoice',
    {
      description: 'Fetches the full invoice for a booking, including all line items and payment details.',
      inputSchema: schema,
    },
    withRequiredAuth(
      { scopes: 'read:bookings' },
      async (args: z.infer<typeof schema>) => {
        let invoice: Invoice;
        try {
          const res = await fetch(`${getTravelBaseUrl()}/history/${encodeURIComponent(args.bookingId)}/invoice`, {
            headers: { Authorization: `Bearer ${getCallerToken()}` },
          });
          if (!res.ok) throw new Error(`Travel API error: ${res.status} ${res.statusText}`);
          invoice = (await res.json()) as Invoice;
        } catch (errorMessage) {
          throw new Error(
            `Failed to fetch invoice for booking "${args.bookingId}": ${String(errorMessage)}`,
          );
        }

        const lineItemText = invoice.lineItems
          .map((li) => `  • ${li.description}: ${invoice.currency} ${li.amount.toFixed(2)}`)
          .join('\n');

        const text =
          `**Invoice ${invoice.invoiceNumber}** — ${invoice.destination} (${invoice.travelDates})\n\n` +
          `${lineItemText}\n\n` +
          `**Total:** ${invoice.currency} ${invoice.total.toFixed(2)} — ${invoice.paymentMethod} — ${invoice.status.toUpperCase()}`;

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: invoice,
        };
      },
    ),
  );
}
