import type {
  McpUiHostContextChangedNotification,
  McpUiToolResultNotification,
} from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme, useApp } from '@modelcontextprotocol/ext-apps/react';
import { ArrowLeft, CalendarDays, CheckCircle, Hotel, Plane, Tag, Users } from 'lucide-react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
import { SpinnerPage } from '../../components/ui/spinner.tsx';
import type { BookingConfirmation, TripOption, TripSearchResult } from '../../../toolkits/bookings/types.ts';
import '../../global.css';

type SortKey = 'price' | 'rating' | 'duration';
type View = 'results' | 'review' | 'confirmed';

function sortOptions(options: TripOption[], key: SortKey): TripOption[] {
  return [...options].sort((a, b) => {
    if (key === 'price') return a.totalPrice - b.totalPrice;
    if (key === 'rating') return b.hotelRating - a.hotelRating;
    if (key === 'duration') return a.nights - b.nights;
    return 0;
  });
}

function TripCard({ option, onSelect }: { option: TripOption; onSelect: (o: TripOption) => void }) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1 w-full bg-primary" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            {option.origin} → {option.destination}
          </CardTitle>
          {option.dealTag && (
            <Badge variant="upcoming" className="shrink-0 text-xs">
              <Tag className="h-3 w-3 mr-1" />{option.dealTag}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plane className="h-3.5 w-3.5 shrink-0 text-primary" />
          {option.airline} {option.flightNumber}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Hotel className="h-3.5 w-3.5 shrink-0 text-primary" />
          {option.hotel} <span className="text-amber-500">{'★'.repeat(option.hotelRating)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {option.departureDate} → {option.returnDate} ({option.nights}n)
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {option.passengers} passenger{option.passengers === 1 ? '' : 's'}
        </div>
        {option.includes.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap gap-1">
              {option.includes.map((inc) => (
                <Badge key={inc} variant="secondary" className="text-xs">{inc}</Badge>
              ))}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between pt-0 pb-4">
        <div>
          <span className="text-xl font-bold text-primary">{option.currency} {option.totalPrice.toLocaleString()}</span>
          <span className="ml-1 text-xs text-muted-foreground">({option.currency} {option.pricePerPerson.toLocaleString()}/person)</span>
        </div>
        <Button size="sm" onClick={() => onSelect(option)}>Select</Button>
      </CardFooter>
    </Card>
  );
}

function ReviewCard({ option, onConfirm, onBack, loading }: {
  option: TripOption; onConfirm: () => void; onBack: () => void; loading: boolean;
}) {
  return (
    <div className="p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} disabled={loading} className="h-7 px-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>
      <div>
        <h2 className="text-base font-semibold">Review your booking</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Check everything looks right before confirming.</p>
      </div>
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-primary" />
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-base">{option.destination}, {option.country}</p>
              <p className="text-sm text-muted-foreground">{option.origin} → {option.destination}</p>
            </div>
            {option.dealTag && <Badge variant="upcoming" className="text-xs shrink-0">{option.dealTag}</Badge>}
          </div>
          <Separator />
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-medium">{option.departureDate} — {option.returnDate}</p>
                <p className="text-xs text-muted-foreground">{option.nights} nights</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Plane className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-medium">{option.airline} {option.flightNumber}</p>
                <p className="text-xs text-muted-foreground">Return flight included</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Hotel className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-medium">{option.hotel}</p>
                <p className="text-xs text-muted-foreground">{'★'.repeat(option.hotelRating)} · {option.nights} nights</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-primary shrink-0" />
              <p className="text-muted-foreground">{option.passengers} pax · {option.currency} {option.pricePerPerson.toLocaleString()}/person</p>
            </div>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-1">
            {option.includes.map((inc) => <Badge key={inc} variant="secondary" className="text-xs">{inc}</Badge>)}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total price</p>
            <p className="text-xl font-bold text-primary">{option.currency} {option.totalPrice.toLocaleString()}</p>
          </div>
        </CardContent>
        <CardFooter className="pb-4">
          <Button className="w-full" size="lg" onClick={onConfirm} disabled={loading}>
            {loading ? 'Booking…' : 'Confirm booking'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function ConfirmedCard({ confirmation, trip, onViewTrips }: {
  confirmation: BookingConfirmation; trip: TripOption; onViewTrips: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center text-center gap-2 pt-2">
        <CheckCircle className="h-10 w-10 text-success" />
        <div>
          <h2 className="text-base font-semibold">Booking confirmed!</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirmation sent to <span className="font-medium text-foreground">{confirmation.email}</span>
          </p>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-success" />
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Booking reference</span>
            <span className="font-mono font-bold tracking-wide">{confirmation.bookingId}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Destination</span>
            <span className="font-medium">{trip.destination}, {trip.country}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dates</span>
            <span>{trip.departureDate} → {trip.returnDate}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Hotel</span>
            <span className="font-medium">{trip.hotel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Flight</span>
            <span>{trip.airline} {trip.flightNumber}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-sm font-semibold">Total paid</span>
            <span className="font-bold text-primary text-base">{trip.currency} {trip.totalPrice.toLocaleString()}</span>
          </div>
        </CardContent>
        <CardFooter className="pb-4">
          <Button variant="outline" className="w-full" onClick={onViewTrips}>View my trips</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function App() {
  const [options, setOptions] = useState<TripOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>('results');
  const [selectedTrip, setSelectedTrip] = useState<TripOption | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'book-trip', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a) => {
      a.onhostcontextchanged = (n: McpUiHostContextChangedNotification['params']) => {
        if (n.theme) applyDocumentTheme(n.theme);
      };
      a.ontoolresult = (params: McpUiToolResultNotification['params']) => {
        const data = params.structuredContent as TripSearchResult | undefined;
        if (!data?.options) { setLoadError('No trip options received.'); return; }
        setOptions(data.options);
      };
    },
  });

  async function confirmBooking() {
    if (!app || !selectedTrip) return;
    setBookingError(null);
    setBooking(true);
    try {
      const result = await app.callServerTool({
        name: 'confirm_booking',
        arguments: { tripId: selectedTrip.tripId, leadPassengerName: 'Jacob Vidal', email: 'jacob@example.com' },
      });
      setConfirmation(result.structuredContent as BookingConfirmation);
      setView('confirmed');
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : String(err));
    } finally {
      setBooking(false);
    }
  }

  async function viewTrips() {
    if (!app) return;
    await app.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Show my travel history' }] });
    await app.requestTeardown();
  }

  if (error) return <div className="flex h-full items-center justify-center p-6"><p className="text-sm text-destructive">Connection error: {error.message}</p></div>;
  if (!isConnected || options === null) return <SpinnerPage />;
  if (loadError) return <div className="flex h-full items-center justify-center p-6"><p className="text-sm text-destructive">{loadError}</p></div>;

  if (view === 'confirmed' && confirmation && selectedTrip) {
    return <ConfirmedCard confirmation={confirmation} trip={selectedTrip} onViewTrips={viewTrips} />;
  }

  if (view === 'review' && selectedTrip) {
    return <ReviewCard option={selectedTrip} onConfirm={confirmBooking} onBack={() => setView('results')} loading={booking} />;
  }

  if (options.length === 0) return <div className="flex h-full items-center justify-center p-6"><p className="text-sm text-muted-foreground">No packages found for this route.</p></div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{options.length} package{options.length === 1 ? '' : 's'} available</h2>
      </div>
      {bookingError && <p className="text-sm text-destructive">{bookingError}</p>}
      <Tabs defaultValue="price">
        <TabsList>
          <TabsTrigger value="price">By price</TabsTrigger>
          <TabsTrigger value="rating">By rating</TabsTrigger>
          <TabsTrigger value="duration">By duration</TabsTrigger>
        </TabsList>
        {(['price', 'rating', 'duration'] as SortKey[]).map((key) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {sortOptions(options, key).map((o) => <TripCard key={o.tripId} option={o} onSelect={(t) => { setSelectedTrip(t); setView('review'); }} />)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
