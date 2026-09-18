import type { McpServer } from '@modelcontextprotocol/server';

import { registerBookTrip } from './book-trip.ts';
import { registerConfirmBooking } from './confirm-booking.ts';

export function registerBookingsTools(server: McpServer): void {
  registerBookTrip(server);
  registerConfirmBooking(server);
}
