import type { TripBooking } from '../../../toolkits/history/types.ts';

type FlightLeg = TripBooking['flightOutbound'];

function isFlightLeg(value: unknown): value is FlightLeg {
  if (typeof value !== 'object' || value === null) return false;
  const leg = value as Partial<FlightLeg>;
  return (
    typeof leg.airline === 'string' &&
    typeof leg.number === 'string' &&
    typeof leg.departure === 'string' &&
    typeof leg.arrival === 'string'
  );
}

export function isTripBooking(value: unknown): value is TripBooking {
  if (typeof value !== 'object' || value === null) return false;
  const booking = value as Partial<TripBooking>;
  return (
    typeof booking.bookingId === 'string' &&
    typeof booking.destination === 'string' &&
    typeof booking.country === 'string' &&
    typeof booking.hotel === 'string' &&
    typeof booking.hotelAddress === 'string' &&
    typeof booking.checkIn === 'string' &&
    typeof booking.checkOut === 'string' &&
    typeof booking.passengers === 'number' &&
    typeof booking.totalAmount === 'number' &&
    typeof booking.currency === 'string' &&
    (booking.status === 'completed' || booking.status === 'upcoming' || booking.status === 'cancelled') &&
    isFlightLeg(booking.flightOutbound) &&
    isFlightLeg(booking.flightReturn)
  );
}

export function parseBookings(value: unknown): TripBooking[] | null {
  if (!Array.isArray(value) || !value.every(isTripBooking)) return null;
  return value;
}
