import type {
  McpUiHostContextChangedNotification,
  McpUiToolResultNotification,
} from '@modelcontextprotocol/ext-apps';
import { applyDocumentTheme, useApp } from '@modelcontextprotocol/ext-apps/react';
import { ArrowLeft, CalendarDays, Hotel, Plane, ReceiptText, Users } from 'lucide-react';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs.tsx';
import { Spinner, SpinnerPage } from '../../components/ui/spinner.tsx';
import type { Invoice, TripBooking } from '../../../toolkits/history/types.ts';
import '../../global.css';

type View = { type: 'list' } | { type: 'detail'; bookingId: string };

function statusVariant(status: TripBooking['status']) {
  if (status === 'upcoming') return 'upcoming' as const;
  if (status === 'completed') return 'success' as const;
  return 'secondary' as const;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function InvoiceDetail({
  booking,
  invoice,
  loading,
  error,
  onBack,
}: {
  booking: TripBooking;
  invoice: Invoice | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          {booking.destination}, {booking.country}
        </h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)} · {booking.passengers} pax
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-start gap-2">
          <Hotel className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="font-medium">{booking.hotel}</p>
            <p className="text-xs text-muted-foreground">{booking.hotelAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Plane className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs">{booking.flightOutbound.airline} {booking.flightOutbound.number}</p>
            <p className="text-xs text-muted-foreground">{booking.flightOutbound.departure} → {booking.flightOutbound.arrival}</p>
            <p className="text-xs mt-1">{booking.flightReturn.number}</p>
            <p className="text-xs text-muted-foreground">{booking.flightReturn.departure} → {booking.flightReturn.arrival}</p>
          </div>
        </div>
      </div>

      <Separator />

      {loading && <div className="py-2"><Spinner size="sm" /></div>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {invoice && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">{invoice.invoiceNumber}</span>
            <span>{invoice.paymentMethod}</span>
          </div>

          <div className="space-y-2">
            {invoice.lineItems.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-muted-foreground flex-1 leading-snug">{item.description}</span>
                <span className="tabular-nums shrink-0 font-medium">
                  {invoice.currency} {item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-primary font-bold text-base tabular-nums">
              {invoice.currency} {invoice.total.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Issued {formatDate(invoice.issuedAt)} · {invoice.status.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}

function TripTable({
  bookings,
  onRowClick,
}: {
  bookings: TripBooking[];
  onRowClick: (b: TripBooking) => void;
}) {
  if (bookings.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No trips here yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destination</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Hotel</TableHead>
          <TableHead>
            <Users className="h-3.5 w-3.5" />
          </TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((b) => (
          <TableRow key={b.bookingId} className="cursor-pointer" onClick={() => onRowClick(b)}>
            <TableCell>
              <div className="font-medium">{b.destination}</div>
              <div className="text-xs text-muted-foreground">{b.country}</div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {formatDate(b.checkIn)}
              </div>
              <div className="text-xs text-muted-foreground ml-4">→ {formatDate(b.checkOut)}</div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1 text-xs">
                <Hotel className="h-3 w-3 text-muted-foreground" />
                <span className="line-clamp-1 max-w-32">{b.hotel}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Plane className="h-3 w-3" />
                {b.flightOutbound.number}
              </div>
            </TableCell>
            <TableCell className="text-sm">{b.passengers}</TableCell>
            <TableCell className="text-right">
              <span className="font-medium tabular-nums text-sm">
                {b.currency} {b.totalAmount.toLocaleString()}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant(b.status)} className="capitalize text-xs">
                {b.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function App() {
  const [bookings, setBookings] = useState<TripBooking[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ type: 'list' });
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: 'travel-history', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (a) => {
      a.onhostcontextchanged = (
        notification: McpUiHostContextChangedNotification['params'],
      ) => {
        if (notification.theme) applyDocumentTheme(notification.theme);
      };

      a.ontoolresult = (params: McpUiToolResultNotification['params']) => {
        const data = params.structuredContent as { bookings: TripBooking[] } | undefined;
        if (!data?.bookings) {
          setLoadError('No booking data received.');
          return;
        }
        setBookings(data.bookings);
      };
    },
  });

  async function openDetail(booking: TripBooking) {
    if (!app) return;
    setInvoice(null);
    setInvoiceError(null);
    setInvoiceLoading(true);
    setView({ type: 'detail', bookingId: booking.bookingId });
    try {
      const result = await app.callServerTool({
        name: 'get_invoice',
        arguments: { bookingId: booking.bookingId },
      });
      setInvoice(result.structuredContent as Invoice);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : String(err));
    } finally {
      setInvoiceLoading(false);
    }
  }

  function backToList() {
    setView({ type: 'list' });
    setInvoice(null);
    setInvoiceError(null);
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">Connection error: {error.message}</p>
      </div>
    );
  }

  if (!isConnected || bookings === null) {
    return <SpinnerPage />;
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  if (view.type === 'detail') {
    const booking = bookings.find((b) => b.bookingId === view.bookingId)!;
    return (
      <InvoiceDetail
        booking={booking}
        invoice={invoice}
        loading={invoiceLoading}
        error={invoiceError}
        onBack={backToList}
      />
    );
  }

  const upcoming = bookings.filter((b) => b.status === 'upcoming');
  const completed = bookings.filter((b) => b.status === 'completed');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">My trips</h2>
        <span className="text-xs text-muted-foreground">
          {bookings.length} booking{bookings.length === 1 ? '' : 's'} · click any row for invoice
        </span>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming{' '}
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {upcoming.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="past">
            Past{' '}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
              {completed.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <TripTable bookings={upcoming} onRowClick={openDetail} />
        </TabsContent>

        <TabsContent value="past">
          <TripTable bookings={completed} onRowClick={openDetail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
