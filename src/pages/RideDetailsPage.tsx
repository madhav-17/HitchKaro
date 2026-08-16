import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Navigation, Clock, Users, IndianRupee, Car, CheckCircle2, AlertCircle, MessageSquare, ShieldCheck, Route } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LocationSearch } from '@/components/LocationSearch';
import type { Ride, RideRequest, GeoLocation } from '@/lib/types';
import { distanceToRoute, formatDistance } from '@/lib/geo';
import { formatDateTime } from './FindRidePage';

export function RideDetailsPage({ rideId }: { rideId: string }) {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [ride, setRide] = useState<Ride | null>(null);
  const [existingRequest, setExistingRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [seats, setSeats] = useState(1);
  const [offeredPrice, setOfferedPrice] = useState('');
  const [pickup, setPickup] = useState<GeoLocation | null>(null);
  const [dropoff, setDropoff] = useState<GeoLocation | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error: qError } = await supabase
          .from('rides')
          .select('*, rider:profiles(*)')
          .eq('id', rideId)
          .maybeSingle();
        if (qError) throw qError;
        setRide(data as Ride | null);
        if (data && session?.user?.id) {
          const { data: req } = await supabase
            .from('ride_requests')
            .select('*')
            .eq('ride_id', rideId)
            .eq('passenger_id', session.user.id)
            .maybeSingle();
          if (req) setExistingRequest(req as RideRequest);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load ride';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [rideId, session?.user?.id]);

  const validateRoute = (): boolean => {
    setRouteError('');
    if (!ride || !pickup || !dropoff) return true;
    if (!ride.source_lat || !ride.source_lng || !ride.dest_lat || !ride.dest_lng) return true;
    const routePoints: GeoLocation[] = [
      { label: ride.source, lat: ride.source_lat, lng: ride.source_lng },
      { label: ride.destination, lat: ride.dest_lat, lng: ride.dest_lng },
    ];
    const pickupResult = distanceToRoute(pickup, routePoints);
    const dropoffResult = distanceToRoute(dropoff, routePoints);
    if (!pickupResult.withinRoute) {
      setRouteError(`Your pickup is ${formatDistance(pickupResult.distance)} from the ride's route. Please choose a closer location.`);
      return false;
    }
    if (!dropoffResult.withinRoute) {
      setRouteError(`Your drop-off is ${formatDistance(dropoffResult.distance)} from the ride's route. Please choose a closer location.`);
      return false;
    }
    return true;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !ride) return;
    if (!pickup || !dropoff) {
      setError('Please set your pickup and drop-off locations.');
      return;
    }
    if (!validateRoute()) return;
    if (!offeredPrice || Number(offeredPrice) <= 0) {
      setError("Please enter a price you'd like to offer.");
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('ride_requests')
        .insert({
          ride_id: rideId,
          passenger_id: session.user.id,
          seats_requested: seats,
          offered_price: Number(offeredPrice),
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          dropoff_lat: dropoff.lat,
          dropoff_lng: dropoff.lng,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (note.trim()) {
        await supabase.from('messages').insert({
          ride_id: rideId,
          request_id: data.id,
          sender_id: session.user.id,
          content: note.trim(),
        });
      }
      await supabase.rpc('create_notification', {
        target_user_id: ride.rider_id,
        notif_type: 'ride_booked',
        notif_title: 'New ride request!',
        notif_body: `Someone requested ${seats} seat${seats !== 1 ? 's' : ''} on your ${ride.source} → ${ride.destination} ride.`,
        target_ride_id: rideId,
        target_request_id: data.id,
      });
      navigate(`/chat/${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send request';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-500">This ride is no longer available.</p>
        <Button className="mt-4" onClick={() => navigate('/find')}>Back to find rides</Button>
      </div>
    );
  }

  const isOwn = ride.rider_id === session?.user?.id;
  const seatsLeft = ride.total_seats - ride.booked_seats;
  const rideCancelled = ride.status === 'cancelled';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button
        onClick={() => navigate('/find')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to rides
      </button>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="my-1 h-12 w-0.5 bg-white/30" />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Navigation className="h-6 w-6" />
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-100">From</p>
                <p className="text-lg font-bold">{ride.source}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-100">To</p>
                <p className="text-lg font-bold">{ride.destination}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
          <InfoTile icon={<Clock className="h-4 w-4" />} label="Departure" value={formatDateTime(ride.departure_time)} />
          <InfoTile icon={<Users className="h-4 w-4" />} label="Seats left" value={`${seatsLeft} / ${ride.total_seats}`} />
          <InfoTile icon={<Car className="h-4 w-4" />} label="Vehicle" value={ride.vehicle_info} />
        </div>

        {ride.notes && (
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rider notes</p>
            <p className="mt-1 text-sm text-slate-600">{ride.notes}</p>
          </div>
        )}

        {ride.rider && (
          <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {ride.rider.full_name[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">{ride.rider.full_name}</p>
              <p className="text-xs text-slate-500">{ride.rider.college_name}</p>
            </div>
            <Badge color="emerald">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified
            </Badge>
          </div>
        )}
      </Card>

      {rideCancelled ? (
        <Card className="p-6 text-center">
          <Badge color="red" className="text-sm">This ride has been cancelled</Badge>
          <p className="mt-2 text-sm text-slate-500">The rider cancelled this ride. Try searching for other rides.</p>
        </Card>
      ) : isOwn ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-500">This is your ride. View and manage requests from your dashboard.</p>
          <Button className="mt-4" onClick={() => navigate('/my-rides')}>
            <Car className="h-4 w-4" />
            Manage my rides
          </Button>
        </Card>
      ) : existingRequest ? (
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Request sent</h3>
          <p className="mt-1 text-sm text-slate-500">
            You've already requested this ride. Open the chat to negotiate the price.
          </p>
          <Button className="mt-4" onClick={() => navigate(`/chat/${existingRequest.id}`)}>
            <MessageSquare className="h-4 w-4" />
            Open chat
          </Button>
        </Card>
      ) : seatsLeft <= 0 ? (
        <Card className="p-6 text-center">
          <Badge color="red" className="text-sm">Sorry, this ride is full</Badge>
          <p className="mt-2 text-sm text-slate-500">All seats have been booked. Try searching for other rides.</p>
        </Card>
      ) : (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-900">Request this ride</h3>
          <p className="mt-1 text-sm text-slate-500">
            Set your pickup, drop-off, and offered price. You can negotiate further in the chat.
          </p>
          <form onSubmit={handleRequest} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LocationSearch
                label="Your pickup"
                placeholder="Search pickup point..."
                value={pickup}
                onChange={setPickup}
                icon={<MapPin className="h-4 w-4" />}
              />
              <LocationSearch
                label="Your drop-off"
                placeholder="Search drop-off point..."
                value={dropoff}
                onChange={setDropoff}
                icon={<Navigation className="h-4 w-4" />}
              />
            </div>

            {routeError && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Route className="h-3.5 w-3.5 shrink-0" />
                {routeError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Seats needed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                    onClick={() => setSeats(Math.max(1, seats - 1))}
                  >
                    −
                  </button>
                  <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-slate-400" />
                    {seats}
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                    onClick={() => setSeats(Math.min(seatsLeft, seats + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <Input
                label="Your offered price (₹)"
                type="number"
                min="1"
                placeholder="e.g. 150"
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                icon={<IndianRupee className="h-4 w-4" />}
              />
            </div>
            <Textarea
              label="Message to rider (optional)"
              placeholder="Hi! I'd like to join your ride."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" size="lg" loading={submitting} className="w-full">
              <MessageSquare className="h-4 w-4" />
              Send request & start chat
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
