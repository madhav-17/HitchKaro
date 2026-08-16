import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, IndianRupee, Check, X, CheckCircle2, Clock, MapPin, Navigation, AlertCircle, Handshake, Ban, MessageCircle, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { Message, Ride, RideRequest, Profile } from '@/lib/types';

export function ChatPage({ requestId }: { requestId: string }) {
  const { profile, session } = useAuth();
  const { navigate } = useRouter();

  const [request, setRequest] = useState<RideRequest | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [priceProposal, setPriceProposal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      setLoading(true);
      try {
        const { data: req, error: reqError } = await supabase
          .from('ride_requests')
          .select('*, passenger:profiles(*), ride:rides(*)')
          .eq('id', requestId)
          .maybeSingle();
        if (reqError) throw reqError;
        if (!req) {
          setError('This conversation no longer exists.');
          return;
        }
        const reqData = req as RideRequest & { passenger: Profile; ride: Ride };
        setRequest(reqData);
        setRide(reqData.ride);
        const isPassenger = reqData.passenger_id === session.user.id;
        setOtherUser(isPassenger ? reqData.ride?.rider ?? null : reqData.passenger);
        setPriceProposal(String(reqData.offered_price));

        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true });
        setMessages((msgs as Message[]) || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load chat';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId, session?.user?.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${requestId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `request_id=eq.${requestId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ride_requests', filter: `id=eq.${requestId}` },
        (payload) => setRequest(payload.new as RideRequest)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${request?.ride_id}` },
        (payload) => setRide(payload.new as Ride)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, request?.ride_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const isChatClosed = request?.status === 'cancelled' || ride?.status === 'cancelled';

  const sendMessage = async (content: string) => {
    if (!session?.user?.id || !content.trim() || isChatClosed) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        ride_id: request!.ride_id,
        request_id: requestId,
        sender_id: session.user.id,
        content: content.trim(),
      });
      if (error) throw error;
      setText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const sendSuggestion = async (suggestion: string) => {
    await sendMessage(suggestion);
  };

  const sendPriceProposal = async () => {
    if (!session?.user?.id || !request || isChatClosed) return;
    const price = Number(priceProposal);
    if (isNaN(price) || price < 0) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        ride_id: request.ride_id,
        request_id: requestId,
        sender_id: session.user.id,
        content: `Proposed price: ₹${price}`,
        price_proposal: price,
      });
      if (error) throw error;
      setShowPriceInput(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const acceptPrice = async (msg: Message) => {
    if (!session?.user?.id || !request || !msg.price_proposal || isChatClosed) return;
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({ final_price: msg.price_proposal, status: 'accepted' })
        .eq('id', requestId);
      if (error) throw error;
      await supabase.from('messages').insert({
        ride_id: request.ride_id,
        request_id: requestId,
        sender_id: session.user.id,
        content: `Deal! Price agreed at ₹${msg.price_proposal}`,
      });
    } catch (err) {
      const msg2 = err instanceof Error ? err.message : 'Failed to accept';
      setError(msg2);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!request || !ride) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-500">{error || 'Conversation not found.'}</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  const isPassenger = request.passenger_id === session?.user?.id;
  const dealDone = request.status === 'accepted' && request.final_price !== null;

  const suggestions: string[] = [];
  if (messages.length === 0) {
    suggestions.push(`Hi! I'm ${profile?.full_name}. I'd like to book ${request.seats_requested} seat${request.seats_requested !== 1 ? 's' : ''} for ${ride.source} → ${ride.destination}.`);
    suggestions.push(`Hi! Is your ride still available for ${formatDateTime(ride.departure_time)}?`);
  }
  if (request.status === 'pending' && !dealDone) {
    if (isPassenger) {
      suggestions.push(`Would ₹${request.offered_price} per seat work for you?`);
    } else {
      suggestions.push(`Your offer of ₹${request.offered_price} works for me. Let's confirm!`);
    }
  }
  if (dealDone) {
    suggestions.push(`Great, see you at ${formatDateTime(ride.departure_time)}!`);
    suggestions.push(`Where exactly should I meet you for pickup?`);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 sm:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 py-4">
        <button
          onClick={() => navigate(isPassenger ? '/my-trips' : '/my-rides')}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
          {otherUser?.full_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{otherUser?.full_name ?? 'Unknown'}</p>
          <p className="truncate text-xs text-slate-500">
            {otherUser?.college_name ?? ''} · {ride.source} → {ride.destination}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {/* Ride summary strip */}
      <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium">{ride.source}</span>
        <Navigation className="h-3 w-3 shrink-0" />
        <span className="font-medium">{ride.destination}</span>
        <span className="ml-auto text-emerald-600">
          {request.seats_requested} seat{request.seats_requested !== 1 ? 's' : ''} · offered ₹{request.offered_price}
        </span>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Chat closed banner */}
      {isChatClosed && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
          <Ban className="h-4 w-4 text-slate-400" />
          This chat is closed — the ride was cancelled. You can no longer send messages.
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && !isChatClosed && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Handshake className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">Start the conversation</p>
            <p className="mt-1 text-xs text-slate-400">
              Negotiate the price and confirm your ride details here.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const mine = msg.sender_id === session?.user?.id;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine
                    ? 'rounded-br-md bg-emerald-600 text-white'
                    : 'rounded-bl-md bg-white text-slate-800 border border-slate-200'
                }`}
              >
                {msg.price_proposal !== null && (
                  <div className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${mine ? 'text-emerald-100' : 'text-emerald-600'}`}>
                    <IndianRupee className="h-3.5 w-3.5" />
                    Price offer: ₹{msg.price_proposal}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-emerald-100/70' : 'text-slate-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </p>
                {msg.price_proposal !== null && !mine && !dealDone && request.status === 'pending' && (
                  <button
                    onClick={() => acceptPrice(msg)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accept this price
                  </button>
                )}
                {msg.price_proposal !== null && dealDone && request.final_price === msg.price_proposal && (
                  <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${mine ? 'text-emerald-100' : 'text-emerald-600'}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Deal sealed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deal banner */}
      {dealDone && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Deal confirmed at ₹{request.final_price} for {request.seats_requested} seat{request.seats_requested !== 1 ? 's' : ''}!
        </div>
      )}

      {/* Auto-suggestions */}
      {!isChatClosed && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendSuggestion(s)}
              className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <MessageCircle className="h-3 w-3" />
              {s.length > 50 ? s.slice(0, 50) + '...' : s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-slate-200 py-3">
        {isChatClosed ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
            <Ban className="h-4 w-4" />
            Chat closed — messages disabled
          </div>
        ) : showPriceInput ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              placeholder="Your price (₹)"
              value={priceProposal}
              onChange={(e) => setPriceProposal(e.target.value)}
              icon={<IndianRupee className="h-4 w-4" />}
              autoFocus
            />
            <Button onClick={sendPriceProposal} loading={sending}>
              <Send className="h-4 w-4" />
              Send offer
            </Button>
            <Button variant="ghost" onClick={() => setShowPriceInput(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowPriceInput(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-emerald-600 hover:bg-emerald-50"
              title="Send a price offer"
            >
              <IndianRupee className="h-5 w-5" />
            </button>
            <Input
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(text);
                }
              }}
            />
            <Button onClick={() => sendMessage(text)} loading={sending} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function RequestStatusBadge({ status }: { status: RideRequest['status'] }) {
  if (status === 'accepted') return <Badge color="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Accepted</Badge>;
  if (status === 'rejected') return <Badge color="red"><X className="h-3.5 w-3.5" /> Rejected</Badge>;
  if (status === 'cancelled') return <Badge color="slate"><Ban className="h-3.5 w-3.5" /> Cancelled</Badge>;
  return <Badge color="amber"><Clock className="h-3.5 w-3.5" /> Pending</Badge>;
}
