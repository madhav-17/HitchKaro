import { useEffect, useState } from 'react';
import { Car, MapPin, Navigation, Clock, Users, IndianRupee, Check, X, MessageSquare, Plus, AlertCircle, ChevronDown, ChevronUp, Ban } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Ride, RideRequest } from '@/lib/types';
import { formatDateTime } from './FindRidePage';

export function MyRidesPage() {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [requests, setRequests] = useState<Record<string, RideRequest[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data: ridesData, error: rError } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', session.user.id)
        .order('created_at', { ascending: false });
      if (rError) throw rError;
      const ridesList = (ridesData as Ride[]) || [];
      setRides(ridesList);

      if (ridesList.length > 0) {
        const rideIds = ridesList.map((r) => r.id);
        const { data: reqsData, error: reqError } = await supabase
          .from('ride_requests')
          .select('*, passenger:profiles(*)')
          .in('ride_id', rideIds)
          .order('created_at', { ascending: false });
        if (reqError) throw reqError;
        const map: Record<string, RideRequest[]> = {};
        (reqsData as RideRequest[] || []).forEach((req) => {
          if (!map[req.ride_id]) map[req.ride_id] = [];
          map[req.ride_id].push(req);
        });
        setRequests(map);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load rides';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const updateRequestStatus = async (req: RideRequest, status: 'accepted' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ status })
        .eq('id', req.id);
      if (error) throw error;

      if (status === 'accepted') {
        await supabase.from('messages').insert({
          ride_id: req.ride_id,
          request_id: req.id,
          sender_id: session!.user.id,
          content: `Request accepted! Your seat is confirmed.`,
        });
        await supabase.rpc('create_notification', {
          target_user_id: req.passenger_id,
          notif_type: 'request_accepted',
          notif_title: 'Request accepted!',
          notif_body: `Your ride request has been accepted by the rider.`,
          target_ride_id: req.ride_id,
          target_request_id: req.id,
        });
      } else {
        await supabase.rpc('create_notification', {
          target_user_id: req.passenger_id,
          notif_type: 'request_rejected',
          notif_title: 'Request declined',
          notif_body: `Your ride request was declined by the rider.`,
          target_ride_id: req.ride_id,
          target_request_id: req.id,
        });
      }
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update request';
      setError(msg);
    }
  };

  const cancelRide = async (rideId: string) => {
    setCancelling(rideId);
    try {
      const { error } = await supabase.rpc('cancel_ride', { ride_id: rideId });
      if (error) throw error;
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel ride';
      setError(msg);
    } finally {
      setCancelling(null);
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My rides</h1>
          <p className="mt-1 text-sm text-slate-500">Manage rides you've offered and incoming requests.</p>
        </div>
        <Button onClick={() => navigate('/offer')}>
          <Plus className="h-4 w-4" />
          Offer new
        </Button>
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
      ) : rides.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Car className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">No rides offered yet</h3>
          <p className="mt-1 text-sm text-slate-500">Offer your first ride and start earning back fuel costs.</p>
          <Button className="mt-4" onClick={() => navigate('/offer')}>
            <Plus className="h-4 w-4" />
            Offer a ride
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => {
            const reqs = requests[ride.id] || [];
            const pending = reqs.filter((r) => r.status === 'pending');
            const accepted = reqs.filter((r) => r.status === 'accepted');
            const seatsLeft = ride.total_seats - ride.booked_seats;
            const isOpen = expanded === ride.id;
            const isActive = ride.status === 'active';
            return (
              <Card key={ride.id} className="overflow-hidden">
                <div
                  className="flex cursor-pointer items-center gap-4 p-5"
                  onClick={() => setExpanded(isOpen ? null : ride.id)}
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {ride.source} → {ride.destination}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(ride.departure_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pending.length > 0 && isActive && (
                      <Badge color="amber">{pending.length} new</Badge>
                    )}
                    <Badge color={isActive ? 'emerald' : 'slate'}>
                      {ride.status}
                    </Badge>
                    <div className="text-slate-400">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 p-5">
                    <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">Seats</p>
                        <p className="font-semibold text-slate-700">{seatsLeft} / {ride.total_seats} left</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Accepted</p>
                        <p className="font-semibold text-slate-700">{accepted.length}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">Vehicle</p>
                        <p className="font-semibold text-slate-700">{ride.vehicle_info}</p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="mb-4 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={cancelling === ride.id}
                          onClick={() => cancelRide(ride.id)}
                        >
                          <Ban className="h-4 w-4 text-red-500" />
                          Cancel ride
                        </Button>
                      </div>
                    )}

                    {reqs.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-400">No requests yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {reqs.map((req) => (
                          <RequestRow
                            key={req.id}
                            req={req}
                            onAccept={() => updateRequestStatus(req, 'accepted')}
                            onReject={() => updateRequestStatus(req, 'rejected')}
                            onChat={() => navigate(`/chat/${req.id}`)}
                          />
                        ))}
                      </div>
                    )}
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

function RequestRow({
  req,
  onAccept,
  onReject,
  onChat,
}: {
  req: RideRequest;
  onAccept: () => void;
  onReject: () => void;
  onChat: () => void;
}) {
  const statusColor =
    req.status === 'pending' ? 'amber' : req.status === 'accepted' ? 'emerald' : 'red';
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
        {req.passenger?.full_name?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">{req.passenger?.full_name}</p>
        <p className="text-xs text-slate-500">
          {req.seats_requested} seat{req.seats_requested !== 1 ? 's' : ''} · offered ₹{req.offered_price}
        </p>
      </div>
      <Badge color={statusColor as 'amber' | 'emerald' | 'red'}>{req.status}</Badge>
      <div className="flex gap-1.5">
        <Button size="sm" variant="ghost" onClick={onChat}>
          <MessageSquare className="h-4 w-4" />
        </Button>
        {req.status === 'pending' && (
          <>
            <Button size="sm" variant="outline" onClick={onAccept}>
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
