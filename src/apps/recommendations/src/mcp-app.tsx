import type {
  McpUiHostContextChangedNotification,
  McpUiToolResultNotification,
} from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme, useApp } from '@modelcontextprotocol/ext-apps/react';
import { MapPin, Star, Thermometer } from 'lucide-react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.tsx';
import { SpinnerPage } from '../../components/ui/spinner.tsx';
import type { Destination, DestinationSearchResult } from '../../../toolkits/recommendations/types.ts';
import '../../global.css';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1 text-amber-500">
      <Star className="h-3.5 w-3.5 fill-current" />
      <span className="text-sm font-medium text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function DestinationCard({
  destination,
  onBook,
}: {
  destination: Destination;
  onBook: (d: Destination) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleBook() {
    setLoading(true);
    await onBook(destination);
  }

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5 w-full bg-primary" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{destination.name}</CardTitle>
            <CardDescription className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {destination.country}
            </CardDescription>
          </div>
          <RatingStars rating={destination.rating} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-3">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {destination.description}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Thermometer className="h-3.5 w-3.5 shrink-0" />
          {destination.climate}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {destination.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs capitalize">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between pt-0 pb-4">
        <div>
          <span className="text-lg font-bold text-primary">
            {destination.currency} {destination.avgNightlyRate}
          </span>
          <span className="text-xs text-muted-foreground ml-1">/night avg</span>
        </div>
        <Button size="sm" disabled={loading} onClick={handleBook}>
          {loading ? 'Loading…' : 'Book now'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function App() {
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'recommendations', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a) => {
      a.onhostcontextchanged = (
        notification: McpUiHostContextChangedNotification['params'],
      ) => {
        if (notification.theme) applyDocumentTheme(notification.theme);
      };

      a.ontoolresult = (params: McpUiToolResultNotification['params']) => {
        const data = params.structuredContent as DestinationSearchResult | undefined;
        if (!data?.destinations) {
          setLoadError('No destination data received.');
          return;
        }
        setDestinations(data.destinations);
      };
    },
  });

  async function handleBook(destination: Destination) {
    if (!app) return;
    const depart = addDays(21);
    const ret = addDays(28);
    await app.sendMessage({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `I'd like to book a trip to ${destination.name}, ${destination.country}. Departing from London on ${depart}, returning ${ret}, for 2 passengers.`,
        },
      ],
    });
    await app.requestTeardown();
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">Connection error: {error.message}</p>
      </div>
    );
  }

  if (!isConnected || destinations === null) {
    return <SpinnerPage />;
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">No destinations found for your search.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {destinations.length} destination{destinations.length === 1 ? '' : 's'} found
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {destinations.map((d) => (
          <DestinationCard key={d.id} destination={d} onBook={handleBook} />
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
