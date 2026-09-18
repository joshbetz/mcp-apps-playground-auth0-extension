export type Destination = {
  id: string;
  name: string;
  country: string;
  continent: string;
  description: string;
  highlights: string[];
  avgNightlyRate: number;
  currency: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  climate: string;
  timezone: string;
};

export type DestinationSearchResult = {
  destinations: Destination[];
  total: number;
};
