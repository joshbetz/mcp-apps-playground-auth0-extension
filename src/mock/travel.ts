import { randomUUID } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

const DESTINATIONS = [
  {
    id: 'dest_paris',
    name: 'Paris',
    country: 'France',
    continent: 'Europe',
    description:
      'The City of Light dazzles with iconic landmarks, world-class cuisine, and unmatched art. Stroll along the Seine, visit the Louvre, and climb the Eiffel Tower for breathtaking views.',
    highlights: ['Eiffel Tower', 'Louvre Museum', 'Montmartre', 'Palace of Versailles'],
    avgNightlyRate: 145,
    currency: 'EUR',
    rating: 4.8,
    reviewCount: 84_210,
    tags: ['romance', 'culture', 'food', 'art', 'architecture'],
    climate: 'Temperate — best April–June and September–October',
    timezone: 'Europe/Paris',
  },
  {
    id: 'dest_tokyo',
    name: 'Tokyo',
    country: 'Japan',
    continent: 'Asia',
    description:
      'A seamless blend of ancient tradition and futuristic innovation. World-class sushi, neon-lit districts, serene temples, and the most efficient transit system on earth.',
    highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tsukiji Market', 'Akihabara'],
    avgNightlyRate: 110,
    currency: 'JPY',
    rating: 4.9,
    reviewCount: 92_430,
    tags: ['culture', 'food', 'tech', 'shopping', 'history'],
    climate: 'Temperate — best March–May (cherry blossom) and October–November',
    timezone: 'Asia/Tokyo',
  },
  {
    id: 'dest_bali',
    name: 'Bali',
    country: 'Indonesia',
    continent: 'Asia',
    description:
      'Sacred temples, terraced rice paddies, surf beaches, and lush jungle retreats. Bali is the ultimate balance of spiritual serenity and tropical adventure.',
    highlights: ['Uluwatu Temple', 'Tegalalang Rice Terraces', 'Seminyak Beach', 'Ubud Market'],
    avgNightlyRate: 72,
    currency: 'USD',
    rating: 4.7,
    reviewCount: 71_850,
    tags: ['beach', 'nature', 'wellness', 'culture', 'surfing'],
    climate: 'Tropical — dry season May–October',
    timezone: 'Asia/Makassar',
  },
  {
    id: 'dest_nyc',
    name: 'New York',
    country: 'United States',
    continent: 'Americas',
    description:
      'The city that never sleeps — iconic skyline, Broadway shows, world-class museums, and neighbourhoods full of character. Central Park in autumn is unmissable.',
    highlights: ['Central Park', 'Metropolitan Museum of Art', 'High Line', 'Brooklyn Bridge'],
    avgNightlyRate: 195,
    currency: 'USD',
    rating: 4.6,
    reviewCount: 113_740,
    tags: ['culture', 'shopping', 'entertainment', 'food', 'architecture'],
    climate: 'Humid continental — best April–June and September–November',
    timezone: 'America/New_York',
  },
  {
    id: 'dest_cape_town',
    name: 'Cape Town',
    country: 'South Africa',
    continent: 'Africa',
    description:
      'Table Mountain rising behind a sparkling harbour, world-class wines, whale watching, and some of the finest beaches on the planet. Spectacular at every turn.',
    highlights: ['Table Mountain', 'Cape of Good Hope', 'Boulders Beach Penguins', 'V&A Waterfront'],
    avgNightlyRate: 95,
    currency: 'ZAR',
    rating: 4.8,
    reviewCount: 48_620,
    tags: ['nature', 'adventure', 'beach', 'food', 'wildlife'],
    climate: 'Mediterranean — best November–March (Southern Hemisphere summer)',
    timezone: 'Africa/Johannesburg',
  },
  {
    id: 'dest_barcelona',
    name: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    description:
      "Gaudí's surreal architecture, golden beaches, world-class tapas, and the energy of Las Ramblas. Barcelona is vibrant around the clock.",
    highlights: ['Sagrada Família', 'Park Güell', 'Las Ramblas', 'Camp Nou'],
    avgNightlyRate: 118,
    currency: 'EUR',
    rating: 4.7,
    reviewCount: 79_130,
    tags: ['culture', 'beach', 'food', 'architecture', 'nightlife'],
    climate: 'Mediterranean — best May–June and September–October',
    timezone: 'Europe/Madrid',
  },
  {
    id: 'dest_kyoto',
    name: 'Kyoto',
    country: 'Japan',
    continent: 'Asia',
    description:
      'Japan\'s ancient imperial capital — thousands of temples, traditional tea houses, geisha districts, and the transcendent bamboo groves of Arashiyama.',
    highlights: ['Fushimi Inari Shrine', 'Arashiyama Bamboo Grove', 'Gion District', 'Kinkaku-ji'],
    avgNightlyRate: 98,
    currency: 'JPY',
    rating: 4.9,
    reviewCount: 67_890,
    tags: ['culture', 'history', 'nature', 'temples', 'tradition'],
    climate: 'Temperate — best March–April and November',
    timezone: 'Asia/Tokyo',
  },
  {
    id: 'dest_lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    continent: 'Europe',
    description:
      'Europe\'s westernmost capital enchants with pastel-tiled facades, vintage trams, world-famous pastéis de nata, and fado music drifting from candlelit bars.',
    highlights: ['Belém Tower', 'Alfama District', 'Time Out Market', 'Sintra Palace'],
    avgNightlyRate: 82,
    currency: 'EUR',
    rating: 4.6,
    reviewCount: 55_340,
    tags: ['culture', 'food', 'history', 'architecture', 'affordable'],
    climate: 'Mediterranean — best March–May and September–October',
    timezone: 'Europe/Lisbon',
  },
  {
    id: 'dest_maldives',
    name: 'Maldives',
    country: 'Maldives',
    continent: 'Asia',
    description:
      'Crystal-clear lagoons, overwater bungalows, and the finest coral reefs on earth. The Maldives is the definitive luxury escape — and a truly bucket-list snorkelling destination.',
    highlights: ['Overwater Bungalows', 'Coral Reef Snorkelling', 'Whale Shark Diving', 'Sunset Dolphin Cruise'],
    avgNightlyRate: 420,
    currency: 'USD',
    rating: 4.9,
    reviewCount: 39_180,
    tags: ['beach', 'luxury', 'romance', 'diving', 'snorkelling'],
    climate: 'Tropical — dry season November–April',
    timezone: 'Indian/Maldives',
  },
  {
    id: 'dest_prague',
    name: 'Prague',
    country: 'Czech Republic',
    continent: 'Europe',
    description:
      'The City of a Hundred Spires — a medieval old town frozen in time, gothic castles, cellar jazz bars, and world-class pilsner. Stunning and surprisingly affordable.',
    highlights: ['Prague Castle', 'Charles Bridge', 'Old Town Square', 'Josefov Jewish Quarter'],
    avgNightlyRate: 68,
    currency: 'CZK',
    rating: 4.7,
    reviewCount: 62_450,
    tags: ['history', 'culture', 'architecture', 'nightlife', 'affordable'],
    climate: 'Temperate continental — best May–September',
    timezone: 'Europe/Prague',
  },
];

const PAST_BOOKINGS = [
  {
    bookingId: 'BK-2026-0038',
    destinationId: 'dest_barcelona',
    destination: 'Barcelona',
    country: 'Spain',
    hotel: 'Hotel Arts Barcelona',
    hotelRating: 5,
    hotelAddress: 'Carrer de la Marina, 19-21, 08005 Barcelona',
    checkIn: '2026-06-04',
    checkOut: '2026-06-11',
    nights: 7,
    passengers: 2,
    flightOutbound: { airline: 'Iberia', number: 'IB3461', departure: 'LHR 06:45', arrival: 'BCN 10:05' },
    flightReturn: { airline: 'Iberia', number: 'IB3468', departure: 'BCN 18:20', arrival: 'LHR 19:45' },
    totalAmount: 1840.0,
    currency: 'EUR',
    status: 'completed',
    bookedAt: '2026-04-11T14:23:00Z',
  },
  {
    bookingId: 'BK-2026-0019',
    destinationId: 'dest_tokyo',
    destination: 'Tokyo',
    country: 'Japan',
    hotel: 'Park Hyatt Tokyo',
    hotelRating: 5,
    hotelAddress: '3-7-1-2 Nishi Shinjuku, Shinjuku-ku, Tokyo',
    checkIn: '2026-03-21',
    checkOut: '2026-03-30',
    nights: 9,
    passengers: 1,
    flightOutbound: { airline: 'Japan Airlines', number: 'JL402', departure: 'LHR 12:00', arrival: 'HND 08:45+1' },
    flightReturn: { airline: 'Japan Airlines', number: 'JL401', departure: 'HND 11:00', arrival: 'LHR 16:20' },
    totalAmount: 2460.0,
    currency: 'GBP',
    status: 'completed',
    bookedAt: '2026-01-08T09:47:00Z',
  },
  {
    bookingId: 'BK-2025-0094',
    destinationId: 'dest_lisbon',
    destination: 'Lisbon',
    country: 'Portugal',
    hotel: 'Bairro Alto Hotel',
    hotelRating: 5,
    hotelAddress: 'Praça Luís de Camões 8, 1200-243 Lisboa',
    checkIn: '2026-01-10',
    checkOut: '2026-01-15',
    nights: 5,
    passengers: 2,
    flightOutbound: { airline: 'TAP Air Portugal', number: 'TP1363', departure: 'LHR 07:10', arrival: 'LIS 09:40' },
    flightReturn: { airline: 'TAP Air Portugal', number: 'TP1368', departure: 'LIS 20:50', arrival: 'LHR 23:20' },
    totalAmount: 1240.0,
    currency: 'EUR',
    status: 'completed',
    bookedAt: '2025-11-23T16:12:00Z',
  },
  {
    bookingId: 'BK-2026-0071',
    destinationId: 'dest_bali',
    destination: 'Bali',
    country: 'Indonesia',
    hotel: 'Four Seasons Resort Bali at Sayan',
    hotelRating: 5,
    hotelAddress: 'Sayan, Ubud, Gianyar, Bali 80571',
    checkIn: '2026-11-08',
    checkOut: '2026-11-16',
    nights: 8,
    passengers: 2,
    flightOutbound: { airline: 'Singapore Airlines', number: 'SQ317', departure: 'LHR 21:30', arrival: 'DPS 21:55+1' },
    flightReturn: { airline: 'Singapore Airlines', number: 'SQ316', departure: 'DPS 23:45', arrival: 'LHR 06:30+1' },
    totalAmount: 3180.0,
    currency: 'USD',
    status: 'upcoming',
    bookedAt: '2026-07-03T11:08:00Z',
  },
  {
    bookingId: 'BK-2026-0085',
    destinationId: 'dest_paris',
    destination: 'Paris',
    country: 'France',
    hotel: 'Le Meurice',
    hotelRating: 5,
    hotelAddress: '228 Rue de Rivoli, 75001 Paris',
    checkIn: '2026-12-26',
    checkOut: '2027-01-02',
    nights: 7,
    passengers: 2,
    flightOutbound: { airline: 'Air France', number: 'AF1682', departure: 'LHR 08:05', arrival: 'CDG 10:20' },
    flightReturn: { airline: 'Air France', number: 'AF1685', departure: 'CDG 18:45', arrival: 'LHR 19:05' },
    totalAmount: 2920.0,
    currency: 'EUR',
    status: 'upcoming',
    bookedAt: '2026-08-19T08:34:00Z',
  },
];

const INVOICES: Record<string, object> = {
  'BK-2026-0038': {
    bookingId: 'BK-2026-0038',
    invoiceNumber: 'INV-2026-00382',
    issuedAt: '2026-04-11T14:23:00Z',
    billedTo: { name: 'Jacob Vidal', email: 'jacob@example.com' },
    destination: 'Barcelona, Spain',
    travelDates: '4–11 June 2026',
    passengers: 2,
    lineItems: [
      { description: 'Return flights LHR–BCN (Iberia IB3461 / IB3468) × 2 pax', amount: 480.0 },
      { description: 'Hotel Arts Barcelona — 7 nights (Superior Sea View) × 2', amount: 1120.0 },
      { description: 'Travel insurance — Standard plan × 2 pax', amount: 98.0 },
      { description: 'Airport transfers (LHR + BCN) × 2 ways', amount: 80.0 },
      { description: 'Taxes & airport fees', amount: 62.0 },
    ],
    subtotal: 1840.0,
    tax: 0.0,
    total: 1840.0,
    currency: 'EUR',
    paymentMethod: 'Visa •••• 4812',
    paidAt: '2026-04-11T14:23:00Z',
    status: 'paid',
  },
  'BK-2026-0019': {
    bookingId: 'BK-2026-0019',
    invoiceNumber: 'INV-2026-00194',
    issuedAt: '2026-01-08T09:47:00Z',
    billedTo: { name: 'Jacob Vidal', email: 'jacob@example.com' },
    destination: 'Tokyo, Japan',
    travelDates: '21–30 March 2026',
    passengers: 1,
    lineItems: [
      { description: 'Return flight LHR–HND (JAL JL402 / JL401) × 1 pax', amount: 920.0 },
      { description: 'Park Hyatt Tokyo — 9 nights (Deluxe City View) × 1', amount: 1350.0 },
      { description: 'Travel insurance — Comprehensive plan × 1 pax', amount: 89.0 },
      { description: 'Airport transfers (LHR + HND Narita Express) × 2 ways', amount: 62.0 },
      { description: 'Taxes & airport fees', amount: 39.0 },
    ],
    subtotal: 2460.0,
    tax: 0.0,
    total: 2460.0,
    currency: 'GBP',
    paymentMethod: 'Visa •••• 4812',
    paidAt: '2026-01-08T09:47:00Z',
    status: 'paid',
  },
  'BK-2025-0094': {
    bookingId: 'BK-2025-0094',
    invoiceNumber: 'INV-2025-00941',
    issuedAt: '2025-11-23T16:12:00Z',
    billedTo: { name: 'Jacob Vidal', email: 'jacob@example.com' },
    destination: 'Lisbon, Portugal',
    travelDates: '10–15 January 2026',
    passengers: 2,
    lineItems: [
      { description: 'Return flights LHR–LIS (TAP TP1363 / TP1368) × 2 pax', amount: 360.0 },
      { description: 'Bairro Alto Hotel — 5 nights (Superior Room) × 2', amount: 720.0 },
      { description: 'Travel insurance — Standard plan × 2 pax', amount: 88.0 },
      { description: 'Airport transfers (LHR + LIS) × 2 ways', amount: 42.0 },
      { description: 'Taxes & airport fees', amount: 30.0 },
    ],
    subtotal: 1240.0,
    tax: 0.0,
    total: 1240.0,
    currency: 'EUR',
    paymentMethod: 'Mastercard •••• 7291',
    paidAt: '2025-11-23T16:12:00Z',
    status: 'paid',
  },
  'BK-2026-0071': {
    bookingId: 'BK-2026-0071',
    invoiceNumber: 'INV-2026-00713',
    issuedAt: '2026-07-03T11:08:00Z',
    billedTo: { name: 'Jacob Vidal', email: 'jacob@example.com' },
    destination: 'Bali, Indonesia',
    travelDates: '8–16 November 2026',
    passengers: 2,
    lineItems: [
      { description: 'Return flights LHR–DPS (SQ SQ317 / SQ316) × 2 pax', amount: 1420.0 },
      { description: 'Four Seasons Resort Bali at Sayan — 8 nights (Garden Villa) × 2', amount: 1480.0 },
      { description: 'Travel insurance — Comprehensive plan × 2 pax', amount: 178.0 },
      { description: 'Airport transfers (LHR + Ngurah Rai) × 2 ways', amount: 62.0 },
      { description: 'Taxes & fees', amount: 40.0 },
    ],
    subtotal: 3180.0,
    tax: 0.0,
    total: 3180.0,
    currency: 'USD',
    paymentMethod: 'Visa •••• 4812',
    paidAt: '2026-07-03T11:08:00Z',
    status: 'paid',
  },
  'BK-2026-0085': {
    bookingId: 'BK-2026-0085',
    invoiceNumber: 'INV-2026-00852',
    issuedAt: '2026-08-19T08:34:00Z',
    billedTo: { name: 'Jacob Vidal', email: 'jacob@example.com' },
    destination: 'Paris, France',
    travelDates: '26 December 2026 – 2 January 2027',
    passengers: 2,
    lineItems: [
      { description: 'Return flights LHR–CDG (Air France AF1682 / AF1685) × 2 pax', amount: 380.0 },
      { description: 'Le Meurice — 7 nights (Tuileries View Room) × 2', amount: 2240.0 },
      { description: 'Travel insurance — Standard plan × 2 pax', amount: 120.0 },
      { description: 'Airport transfers (LHR + CDG) × 2 ways', amount: 80.0 },
      { description: 'Taxes & fees', amount: 100.0 },
    ],
    subtotal: 2920.0,
    tax: 0.0,
    total: 2920.0,
    currency: 'EUR',
    paymentMethod: 'Visa •••• 4812',
    paidAt: '2026-08-19T08:34:00Z',
    status: 'paid',
  },
};

const SEARCH_RESULTS: Record<string, object[]> = {
  dest_paris: [
    {
      tripId: 'TR-PAR-001',
      destination: 'Paris',
      country: 'France',
      origin: 'London',
      airline: 'Air France',
      flightNumber: 'AF1682',
      hotel: 'Hôtel Plaza Athénée',
      hotelRating: 5,
      hotelStars: '⭐⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-21',
      nights: 7,
      passengers: 2,
      pricePerPerson: 920.0,
      totalPrice: 1840.0,
      currency: 'EUR',
      includes: ['Return flights', '7 nights hotel', 'Breakfast daily', 'Airport transfers'],
      dealTag: 'Best value',
    },
    {
      tripId: 'TR-PAR-002',
      destination: 'Paris',
      country: 'France',
      origin: 'London',
      airline: 'Eurostar',
      flightNumber: 'ES9016',
      hotel: 'Hotel Du Louvre',
      hotelRating: 4,
      hotelStars: '⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-21',
      nights: 7,
      passengers: 2,
      pricePerPerson: 680.0,
      totalPrice: 1360.0,
      currency: 'EUR',
      includes: ['Return Eurostar tickets', '7 nights hotel', 'Airport transfers'],
      dealTag: 'Budget pick',
    },
    {
      tripId: 'TR-PAR-003',
      destination: 'Paris',
      country: 'France',
      origin: 'London',
      airline: 'British Airways',
      flightNumber: 'BA308',
      hotel: 'Le Meurice',
      hotelRating: 5,
      hotelStars: '⭐⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-21',
      nights: 7,
      passengers: 2,
      pricePerPerson: 1460.0,
      totalPrice: 2920.0,
      currency: 'EUR',
      includes: ['Business class flights', '7 nights luxury hotel', 'Breakfast & dinner', 'Concierge service'],
      dealTag: 'Luxury',
    },
  ],
  dest_tokyo: [
    {
      tripId: 'TR-TYO-001',
      destination: 'Tokyo',
      country: 'Japan',
      origin: 'London',
      airline: 'Japan Airlines',
      flightNumber: 'JL402',
      hotel: 'Shinjuku Granbell Hotel',
      hotelRating: 4,
      hotelStars: '⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-25',
      nights: 11,
      passengers: 2,
      pricePerPerson: 1280.0,
      totalPrice: 2560.0,
      currency: 'GBP',
      includes: ['Return flights', '11 nights hotel', 'Airport transfers', 'JR Pass 14-day'],
      dealTag: 'Best value',
    },
    {
      tripId: 'TR-TYO-002',
      destination: 'Tokyo',
      country: 'Japan',
      origin: 'London',
      airline: 'British Airways',
      flightNumber: 'BA007',
      hotel: 'Park Hyatt Tokyo',
      hotelRating: 5,
      hotelStars: '⭐⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-25',
      nights: 11,
      passengers: 2,
      pricePerPerson: 2340.0,
      totalPrice: 4680.0,
      currency: 'GBP',
      includes: ['Club World flights', '11 nights luxury hotel', 'Breakfast daily', 'JR Pass 14-day', 'Concierge'],
      dealTag: 'Luxury',
    },
  ],
  dest_bali: [
    {
      tripId: 'TR-BAL-001',
      destination: 'Bali',
      country: 'Indonesia',
      origin: 'London',
      airline: 'Singapore Airlines',
      flightNumber: 'SQ317',
      hotel: 'Alaya Resort Ubud',
      hotelRating: 4,
      hotelStars: '⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-24',
      nights: 10,
      passengers: 2,
      pricePerPerson: 960.0,
      totalPrice: 1920.0,
      currency: 'USD',
      includes: ['Return flights', '10 nights hotel', 'Breakfast daily', 'Airport transfers', 'Welcome spa treatment'],
      dealTag: 'Popular',
    },
    {
      tripId: 'TR-BAL-002',
      destination: 'Bali',
      country: 'Indonesia',
      origin: 'London',
      airline: 'Qatar Airways',
      flightNumber: 'QR535',
      hotel: 'Four Seasons Resort Bali at Sayan',
      hotelRating: 5,
      hotelStars: '⭐⭐⭐⭐⭐',
      departureDate: '2026-11-14',
      returnDate: '2026-11-24',
      nights: 10,
      passengers: 2,
      pricePerPerson: 2640.0,
      totalPrice: 5280.0,
      currency: 'USD',
      includes: ['Business class flights', '10 nights villa', 'Full board dining', 'Private transfers', 'Daily spa'],
      dealTag: 'Luxury',
    },
  ],
};

function getDefaultResults(destination: string, origin: string): object[] {
  return [
    {
      tripId: `TR-${randomUUID().slice(0, 6).toUpperCase()}`,
      destination,
      origin,
      airline: 'British Airways',
      flightNumber: 'BA200',
      hotel: `${destination} Grand Hotel`,
      hotelRating: 4,
      departureDate: '2026-11-14',
      returnDate: '2026-11-21',
      nights: 7,
      passengers: 2,
      pricePerPerson: 850.0,
      totalPrice: 1700.0,
      currency: 'EUR',
      includes: ['Return flights', '7 nights hotel', 'Breakfast daily'],
      dealTag: 'Best value',
    },
  ];
}

function searchDestinations(query: string, maxBudget?: number): object[] {
  const q = query.toLowerCase();
  let results = DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.country.toLowerCase().includes(q) ||
      d.continent.toLowerCase().includes(q) ||
      d.tags.some((t) => t.includes(q)) ||
      d.description.toLowerCase().includes(q),
  );
  if (maxBudget != null) {
    results = results.filter((d) => d.avgNightlyRate <= maxBudget);
  }
  if (results.length === 0) {
    results = DESTINATIONS.slice(0, 4);
  }
  return results;
}

const travelRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { q?: string; maxBudget?: string } }>(
    '/travel/destinations',
    async (req, reply) => {
      if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
      req.log.info(
        { hasAuthorization: Boolean(req.headers.authorization) },
        '[mock/travel] GET /travel/destinations',
      );
      const results = searchDestinations(req.query.q ?? '', req.query.maxBudget ? Number(req.query.maxBudget) : undefined);
      return reply.send({ destinations: results, total: results.length });
    },
  );

  fastify.get<{ Params: { id: string } }>('/travel/destinations/:id', async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    req.log.info(
      { hasAuthorization: Boolean(req.headers.authorization) },
      '[mock/travel] GET /travel/destinations/:id',
    );
    const destination = DESTINATIONS.find((d) => d.id === req.params.id);
    if (!destination) return reply.code(404).send({ error: 'Destination not found' });
    return reply.send(destination);
  });

  fastify.get('/travel/history', async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    req.log.info(
      { hasAuthorization: Boolean(req.headers.authorization) },
      '[mock/travel] GET /travel/history',
    );
    return reply.send({ bookings: PAST_BOOKINGS });
  });

  fastify.get<{ Params: { bookingId: string } }>(
    '/travel/history/:bookingId/invoice',
    async (req, reply) => {
      if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
      req.log.info(
        { hasAuthorization: Boolean(req.headers.authorization) },
        '[mock/travel] GET /travel/history/:bookingId/invoice',
      );
      const invoice = INVOICES[req.params.bookingId];
      if (!invoice) return reply.code(404).send({ error: 'Invoice not found' });
      return reply.send(invoice);
    },
  );

  fastify.get<{
    Querystring: { origin?: string; destination?: string; departureDate?: string; returnDate?: string; passengers?: string };
  }>('/travel/search', async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    req.log.info(
      { hasAuthorization: Boolean(req.headers.authorization) },
      '[mock/travel] GET /travel/search',
    );
    const { destination = '', origin = 'London' } = req.query;
    const destId = DESTINATIONS.find(
      (d) => d.name.toLowerCase() === destination.toLowerCase(),
    )?.id;
    const options = destId ? (SEARCH_RESULTS[destId] ?? getDefaultResults(destination, origin)) : getDefaultResults(destination, origin);
    return reply.send({ options, total: options.length });
  });

  fastify.post('/travel/bookings', async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'Unauthorized' });
    req.log.info(
      { hasAuthorization: Boolean(req.headers.authorization) },
      '[mock/travel] POST /travel/bookings',
    );
    const body = req.body as { tripId?: string; leadPassengerName?: string; email?: string };
    if (!body.tripId || !body.leadPassengerName || !body.email) {
      return reply.code(400).send({ error: 'tripId, leadPassengerName and email are required' });
    }

    const allOptions = Object.values(SEARCH_RESULTS).flat() as Record<string, unknown>[];
    const trip = allOptions.find((o) => o['tripId'] === body.tripId);

    const bookingId = `BK-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    return reply.code(201).send({
      bookingId,
      tripId: body.tripId,
      leadPassengerName: body.leadPassengerName,
      email: body.email,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      message: `Your booking ${bookingId} is confirmed. Check your email at ${body.email} for full details.`,
      destination: trip?.['destination'] ?? 'Unknown',
      country: trip?.['country'] ?? '',
      hotel: trip?.['hotel'] ?? '',
      airline: trip?.['airline'] ?? '',
      flightNumber: trip?.['flightNumber'] ?? '',
      departureDate: trip?.['departureDate'] ?? '',
      returnDate: trip?.['returnDate'] ?? '',
      nights: trip?.['nights'] ?? 0,
      passengers: trip?.['passengers'] ?? 1,
      totalPrice: trip?.['totalPrice'] ?? 0,
      currency: trip?.['currency'] ?? 'EUR',
    });
  });
};

export default travelRoutes;
