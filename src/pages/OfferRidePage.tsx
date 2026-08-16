import { useState } from 'react';
import { MapPin, Navigation, Clock, Users, Car, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { LocationSearch } from '@/components/LocationSearch';
import type { GeoLocation } from '@/lib/types';

export function OfferRidePage() {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [source, setSource] = useState<GeoLocation | null>(null);
  const [destination, setDestination] = useState<GeoLocation | null>(null);
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [totalSeats, setTotalSeats] = useState(2);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!profile) return null;

  const vehicleInfo = [profile.vehicle_model, profile.vehicle_number].filter(Boolean).join(' · ') || 'Not registered';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!source || !destination) {
      setError('Please select your source and destination from the search results.');
      return;
    }
    if (!departureDate || !departureTime) {
      setError('Please select a departure date and time.');
      return;
    }
    if (totalSeats < 1) {
      setError('You need at least 1 seat available.');
      return;
    }
    if (!profile.vehicle_number || !profile.vehicle_model) {
      setError('Please register your vehicle in the verification page first.');
      return;
    }

    setLoading(true);
    try {
      const departureTimeISO = new Date(`${departureDate}T${departureTime}`).toISOString();
      const { error: insertError } = await supabase.from('rides').insert({
        rider_id: session!.user.id,
        source: source.label,
        destination: destination.label,
        route_stops: [],
        source_lat: source.lat,
        source_lng: source.lng,
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        departure_time: departureTimeISO,
        total_seats: totalSeats,
        price_per_seat: 0,
        vehicle_info: vehicleInfo,
        notes: notes.trim(),
        status: 'active',
      });
      if (insertError) throw insertError;
      setSuccess(true);
      setTimeout(() => navigate('/my-rides'), 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to post ride';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Ride posted!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your ride is now visible to students heading the same way. You'll be notified when someone requests a seat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Offer a ride</h1>
        <p className="mt-1 text-sm text-slate-500">
          Share your route. Students along the way can find and join your ride automatically.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Navigation className="h-4 w-4" />
            Route details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <LocationSearch
              label="Source (from)"
              placeholder="Search starting point..."
              value={source}
              onChange={setSource}
              icon={<MapPin className="h-4 w-4" />}
            />
            <LocationSearch
              label="Destination (to)"
              placeholder="Search destination..."
              value={destination}
              onChange={setDestination}
              icon={<Navigation className="h-4 w-4" />}
            />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Students can search their own pickup and drop-off — if it falls along your route, they'll see your ride.
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Clock className="h-4 w-4" />
            Schedule & seats
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Departure date</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Departure time</label>
              <input
                type="time"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Total seats</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                  onClick={() => setTotalSeats(Math.max(1, totalSeats - 1))}
                >
                  −
                </button>
                <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-slate-400" />
                  {totalSeats} {totalSeats === 1 ? 'seat' : 'seats'}
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
                  onClick={() => setTotalSeats(totalSeats + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Car className="h-4 w-4" />
            Vehicle & notes
          </h3>
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">{vehicleInfo}</p>
              <p className="text-xs text-emerald-600">Registered vehicle — used for all your rides</p>
            </div>
          </div>
          <Textarea
            label="Notes for passengers (optional)"
            placeholder="e.g. Luggage space is limited, no smoking, etc."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={loading}>
            <CheckCircle2 className="h-4 w-4" />
            Post ride
          </Button>
        </div>
      </form>
    </div>
  );
}
