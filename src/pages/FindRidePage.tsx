import { useEffect, useState } from 'react';
import { Search, MapPin, Clock, Users, Car, Navigation, AlertCircle, X, Route } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LocationSearch } from '@/components/LocationSearch';
import type { Ride, GeoLocation } from '@/lib/types';
import { distanceToRoute, formatDistance } from '@/lib/geo';

export function FindRidePage() {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const [pickup, setPickup] = useState<GeoLocation | null>(null);
  const [dropoff, setDropoff] = useState<GeoLocation | null>(null);

  const loadRides = async () => {
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const { data, error: queryError } = await supabase
        .from('rides')
        .select('*, rider:profiles(*)')
        .eq('status', 'active')
        .order('departure_time', { ascending: true });
      if (queryError) throw queryError;
      let result = (data as Ride[]) || [];

      if (pickup && dropoff) {
        result = result.filter((r) => {
          if (!r.source_lat || !r.source_lng || !r.dest_lat || !r.dest_lng) return false;
          const routePoints: GeoLocation[] = [
            { label: r.source, lat: r.source_lat, lng: r.source_lng },
            { label: r.destination, lat: r.dest_lat, lng: r.dest_lng },
          ];
          const pickupResult = distanceToRoute(pickup, routePoints);
          const dropoffResult = distanceToRoute(dropoff, routePoints);
          return pickupResult.withinRoute && dropoffResult.withinRoute;
        });
      } else if (pickup) {
        result = result.filter((r) => {
          if (!r.source_lat || !r.source_lng || !r.dest_lat || !r.dest_lng) return false;
          const routePoints: GeoLocation[] = [
            { label: r.source, lat: r.source_lat, lng: r.source_lng },
            { label: r.destination, lat: r.dest_lat, lng: r.dest_lng },
          ];
          return distanceToRoute(pickup, routePoints).withinRoute;
        });
      }

      setRides(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load rides';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return null;

  const clearSearch = () => {
    setPickup(null);
    setDropoff(null);
    setSearched(false);
    loadRides();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Find a ride</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your pickup and drop-off — we'll show rides whose route passes through both.
        </p>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <LocationSearch
            label="Your pickup"
            placeholder="Search where you're starting from..."
            value={pickup}
            onChange={setPickup}
            icon={<MapPin className="h-4 w-4" />}
          />
          <LocationSearch
            label="Your drop-off"
            placeholder="Search where you're going..."
            value={dropoff}
            onChange={setDropoff}
            icon={<Navigation className="h-4 w-4" />}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={loadRides} loading={loading} className="flex-1">
            <Search className="h-4 w-4" />
            Find matching rides
          </Button>
          {(pickup || dropoff) && (
            <Button variant="outline" onClick={clearSearch}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : rides.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Car className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            {searched && (pickup || dropoff) ? 'No rides on your route' : 'No rides found'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {searched && (pickup || dropoff)
              ? 'No active rides pass through your pickup and drop-off. Try different locations or check back later.'
              : 'Try searching with your pickup and drop-off, or check back later as more students post rides.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{rides.length} ride{rides.length !== 1 ? 's' : ''} available</p>
          {rides.map((ride) => {
            const isOwn = ride.rider_id === session?.user?.id;
            const seatsLeft = ride.total_seats - ride.booked_seats;
            return (
              <Card
                key={ride.id}
                onClick={() => navigate(`/ride/${ride.id}`)}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="my-1 h-8 w-0.5 bg-slate-200" />
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <Navigation className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">From</p>
                        <p className="text-sm font-semibold text-slate-900">{ride.source}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">To</p>
                        <p className="text-sm font-semibold text-slate-900">{ride.destination}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row flex-wrap items-center gap-4 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(ride.departure_time)}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        {seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left
                      </p>
                    </div>
                    {isOwn ? (
                      <Badge color="amber">Your ride</Badge>
                    ) : seatsLeft <= 0 ? (
                      <Badge color="red">Full</Badge>
                    ) : (
                      <Badge color="emerald">Available</Badge>
                    )}
                  </div>
                </div>
                {ride.rider && (
                  <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {ride.rider.full_name[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{ride.rider.full_name}</span>
                      {' · '}
                      {ride.rider.college_name}
                      {' · '}
                      {ride.vehicle_info}
                    </p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
