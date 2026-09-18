export type FlightLeg = {
  airline: string;
  number: string;
  departure: string;
  arrival: string;
};

export type TripBooking = {
  bookingId: string;
  destinationId: string;
  destination: string;
  country: string;
  hotel: string;
  hotelRating: number;
  hotelAddress: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  passengers: number;
  flightOutbound: FlightLeg;
  flightReturn: FlightLeg;
  totalAmount: number;
  currency: string;
  status: 'completed' | 'upcoming' | 'cancelled';
  bookedAt: string;
};

export type InvoiceLineItem = {
  description: string;
  amount: number;
};

export type Invoice = {
  bookingId: string;
  invoiceNumber: string;
  issuedAt: string;
  billedTo: { name: string; email: string };
  destination: string;
  travelDates: string;
  passengers: number;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paidAt: string;
  status: 'paid' | 'pending';
};
