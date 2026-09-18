import type {
  McpUiHostContextChangedNotification,
  McpUiToolResultNotification,
} from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme, useApp } from '@modelcontextprotocol/ext-apps/react';
import { CalendarDays, CheckCircle, Hotel, Plane, Users } from 'lucide-react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Button } from '../../components/ui/button.tsx';
import { Card, CardContent, CardFooter } from '../../components/ui/card.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import { SpinnerPage } from '../../components/ui/spinner.tsx';
import type { BookingConfirmation } from '../../../toolkits/bookings/types.ts';
import '../../global.css';

function App() {
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'booking-confirmation', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a) => {
      a.onhostcontextchanged = (
        notification: McpUiHostContextChangedNotification['params'],
      ) => {
        if (notification.theme) applyDocumentTheme(notification.theme);
      };

      a.ontoolresult = (params: McpUiToolResultNotification['params']) => {
        const data = params.structuredContent as BookingConfirmation | undefined;
        if (!data?.bookingId) {
          setLoadError('No confirmation data received.');
          return;
        }
        setConfirmation(data);
      };
    },
  });

  async function viewTrips() {
    if (!app) return;
    await app.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: 'Show my travel history' }],
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

  if (!isConnected || confirmation === null) {
    return <SpinnerPage />;
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center text-center gap-2 pt-2">
        <CheckCircle className="h-10 w-10 text-success" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Booking confirmed!</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            A confirmation has been sent to{' '}
            <span className="font-medium text-foreground">{confirmation.email}</span>
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-1.5 w-full bg-success" />
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Booking reference</span>
            <span className="font-mono font-bold text-foreground tracking-wide">
              {confirmation.bookingId}
            </span>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground text-base">
                {confirmation.destination}, {confirmation.country}
              </p>
              <p className="text-sm text-muted-foreground">
                Booked for {confirmation.leadPassengerName}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium">
                    {confirmation.departureDate} — {confirmation.returnDate}
                  </p>
                  <p className="text-xs text-muted-foreground">{confirmation.nights} nights</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Plane className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium">
                    {confirmation.airline} {confirmation.flightNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">Return flight included</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Hotel className="h-4 w-4 text-primary shrink-0" />
                <p className="font-medium">{confirmation.hotel}</p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <p className="text-muted-foreground">
                  {confirmation.passengers} passenger{confirmation.passengers === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total paid</span>
            <span className="text-xl font-bold text-primary">
              {confirmation.currency} {confirmation.totalPrice.toLocaleString()}
            </span>
          </div>
        </CardContent>

        <CardFooter className="pb-4">
          <Button variant="outline" className="w-full" onClick={viewTrips}>
            View my trips
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
