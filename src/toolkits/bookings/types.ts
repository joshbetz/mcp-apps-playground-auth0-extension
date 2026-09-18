export type TripOption = {
  tripId: string;
  destination: string;
  country: string;
  origin: string;
  airline: string;
  flightNumber: string;
  hotel: string;
  hotelRating: number;
  departureDate: string;
  returnDate: string;
  nights: number;
  passengers: number;
  pricePerPerson: number;
  totalPrice: number;
  currency: string;
  includes: string[];
  dealTag?: string;
};

export type TripSearchResult = {
  options: TripOption[];
  total: number;
};

export type BookingConfirmation = {
  bookingId: string;
  tripId: string;
  leadPassengerName: string;
  email: string;
  status: 'confirmed';
  confirmedAt: string;
  message: string;
  destination: string;
  country: string;
  hotel: string;
  airline: string;
  flightNumber: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  passengers: number;
  totalPrice: number;
  currency: string;
};
