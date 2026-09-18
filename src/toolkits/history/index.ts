import type { McpServer } from '@modelcontextprotocol/server';

import { registerGetInvoice } from './get-invoice.ts';
import { registerGetTravelHistory } from './get-travel-history.ts';

export function registerHistoryTools(server: McpServer): void {
  registerGetTravelHistory(server);
  registerGetInvoice(server);
}
