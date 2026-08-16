import { useEffect, useState } from 'react';
import { MessageSquare, ArrowLeft, Search, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import type { RideRequest, Ride, Profile, Message } from '@/lib/types';

interface ChatThread {
  request: RideRequest;
  ride: Ride;
  otherUser: Profile | null;
  lastMessage: Message | null;
}

export function ChatsPage() {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      setLoading(true);
      try {
        // Get requests where I'm passenger OR rider of the ride
        const [passengerReqs, riderReqs] = await Promise.all([
          supabase
            .from('ride_requests')
            .select('*, ride:rides(*, rider:profiles(*))')
            .eq('passenger_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('ride_requests')
            .select('*, passenger:profiles(*), ride:rides(*)')
            .in(
              'ride_id',
              (await supabase.from('rides').select('id').eq('rider_id', session.user.id)).data?.map((r) => r.id) || []
            )
            .order('created_at', { ascending: false }),
        ]);

        const all: ChatThread[] = [];
        for (const r of (passengerReqs.data as (RideRequest & { ride: Ride & { rider: Profile } })[]) || []) {
          const { data: last } = await supabase
            .from('messages')
            .select('*')
            .eq('request_id', r.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          all.push({ request: r, ride: r.ride, otherUser: r.ride?.rider ?? null, lastMessage: last as Message | null });
        }
        for (const r of (riderReqs.data as (RideRequest & { passenger: Profile; ride: Ride })[]) || []) {
          if (all.find((t) => t.request.id === r.id)) continue;
          const { data: last } = await supabase
            .from('messages')
            .select('*')
            .eq('request_id', r.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          all.push({ request: r, ride: r.ride, otherUser: r.passenger ?? null, lastMessage: last as Message | null });
        }
        all.sort((a, b) => {
          const aTime = a.lastMessage?.created_at ?? a.request.created_at;
          const bTime = b.lastMessage?.created_at ?? b.request.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setThreads(all);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load chats';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  if (!profile) return null;

  const filtered = threads.filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.otherUser?.full_name?.toLowerCase().includes(q) ||
      t.ride?.source?.toLowerCase().includes(q) ||
      t.ride?.destination?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Chats</h1>
        <p className="mt-1 text-sm text-slate-500">Your ride negotiations and conversations.</p>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name or route..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <MessageSquare className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">No conversations yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            When you request a ride or receive a request, the chat will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card
              key={t.request.id}
              onClick={() => navigate(`/chat/${t.request.id}`)}
              className="flex items-center gap-3 p-4"
            >
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {t.otherUser?.full_name?.[0]?.toUpperCase() ?? '?'}
                {t.request.status === 'pending' && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{t.otherUser?.full_name ?? 'Unknown'}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {t.lastMessage
                      ? new Date(t.lastMessage.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : new Date(t.request.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {t.ride.source} → {t.ride.destination}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {t.lastMessage?.content ?? 'No messages yet. Say hello!'}
                </p>
              </div>
              <ChatStatusBadge status={t.request.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatStatusBadge({ status }: { status: RideRequest['status'] }) {
  if (status === 'accepted') return <Badge color="emerald">Deal</Badge>;
  if (status === 'rejected') return <Badge color="red">Rejected</Badge>;
  if (status === 'cancelled') return <Badge color="slate">Cancelled</Badge>;
  return <Badge color="amber">Pending</Badge>;
}
