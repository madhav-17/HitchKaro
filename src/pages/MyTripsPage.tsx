import { useEffect, useState } from 'react';
import { Ticket, MapPin, Navigation, Clock, IndianRupee, MessageSquare, CheckCircle2, X, AlertCircle, Car } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { RideRequest, Ride, Profile } from '@/lib/types';
import { formatDateTime } from './FindRidePage';

export function MyTripsPage() {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [trips, setTrips] = useState<(RideRequest & { ride: Ride; rider: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: qError } = await supabase
        .from('ride_requests')
        .select('*, ride:rides(*, rider:profiles(*))')
        .eq('passenger_id', session.user.id)
        .order('created_at', { ascending: false });
      if (qError) throw qError;
      setTrips((data as (RideRequest & { ride: Ride & { rider: Profile } })[]) || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load trips';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const cancelRequest = async (trip: RideRequest & { ride: Ride }) => {
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('id', trip.id);
      if (error) throw error;
      await supabase.rpc('create_notification', {
        target_user_id: trip.ride.rider_id,
        notif_type: 'request_cancelled',
        notif_title: 'Request cancelled',
        notif_body: `A passenger cancelled their request for ${trip.ride.source} → ${trip.ride.destination}.`,
        target_ride_id: trip.ride_id,
        target_request_id: trip.id,
      });
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel';
      setError(msg);
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My trips</h1>
        <p className="mt-1 text-sm text-slate-500">Rides you've requested and your trip history.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Ticket className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">No trips yet</h3>
          <p className="mt-1 text-sm text-slate-500">Find a ride and request a seat to get started.</p>
          <Button className="mt-4" onClick={() => navigate('/find')}>
            Find a ride
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const ride = trip.ride;
            return (
              <Card key={trip.id} className="overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                      <Car className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {ride.source} → {ride.destination}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(ride.departure_time)} · {ride.vehicle_info}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Rider: {ride.rider?.full_name} · {ride.rider?.college_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      {trip.final_price !== null ? (
                        <p className="flex items-center font-bold text-emerald-600">
                          <IndianRupee className="h-4 w-4" />
                          {trip.final_price}
                        </p>
                      ) : (
                        <p className="flex items-center text-sm text-slate-600">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {trip.offered_price} <span className="text-xs text-slate-400"> offered</span>
                        </p>
                      )}
                      <p className="text-xs text-slate-400">{trip.seats_requested} seat{trip.seats_requested !== 1 ? 's' : ''}</p>
                    </div>
                    <TripStatusBadge status={trip.status} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/chat/${trip.id}`)}>
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </Button>
                  {(trip.status === 'pending' || trip.status === 'accepted') && (
                    <Button size="sm" variant="outline" onClick={() => cancelRequest(trip)}>
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TripStatusBadge({ status }: { status: RideRequest['status'] }) {
  if (status === 'accepted') return <Badge color="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Confirmed</Badge>;
  if (status === 'rejected') return <Badge color="red"><X className="h-3.5 w-3.5" /> Rejected</Badge>;
  if (status === 'cancelled') return <Badge color="slate">Cancelled</Badge>;
  return <Badge color="amber"><Clock className="h-3.5 w-3.5" /> Pending</Badge>;
}
