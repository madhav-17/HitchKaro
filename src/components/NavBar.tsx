import { useEffect, useRef, useState } from 'react';
import { Car, LogOut, Menu, X, Compass, LayoutGrid, MessageSquare, Plus, Ticket, Bell, Check, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/context/RouterContext';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import type { Profile, AppNotification } from '@/lib/types';

export function NavBar() {
  const { profile, signOut } = useAuth();
  const { path, navigate } = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const links: { to: string; label: string; icon: React.ReactNode }[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
    { to: '/offer', label: 'Offer Ride', icon: <Plus className="h-4 w-4" /> },
    { to: '/find', label: 'Find Ride', icon: <Compass className="h-4 w-4" /> },
    { to: '/my-rides', label: 'My Rides', icon: <Car className="h-4 w-4" /> },
    { to: '/my-trips', label: 'My Trips', icon: <Ticket className="h-4 w-4" /> },
    { to: '/chats', label: 'Chats', icon: <MessageSquare className="h-4 w-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <Car className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Hitch<span className="text-emerald-600">Karo</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = path === link.to || path.startsWith(link.to + '/');
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <NotificationBell />
          <ProfileChip profile={profile} />
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <NotificationBell />
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <ProfileChip profile={profile} />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function NotificationBell() {
  const { session } = useAuth();
  const { navigate } = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const list = (data as AppNotification[]) || [];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    if (!session?.user?.id || unreadCount === 0) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', session.user.id)
      .eq('read', false);
    loadNotifications();
  };

  const handleNotifClick = (notif: AppNotification) => {
    if (!notif.read) {
      supabase.from('notifications').update({ read: true }).eq('id', notif.id);
    }
    if (notif.request_id) {
      navigate(`/chat/${notif.request_id}`);
    } else if (notif.ride_id) {
      navigate(`/ride/${notif.ride_id}`);
    }
    setOpen(false);
  };

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
    loadNotifications();
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-400">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">Ride updates and booking alerts will appear here.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  className={`group flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    !notif.read ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${getNotifColor(notif.type)}`}>
                    {getNotifIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{notif.title}</p>
                    {notif.body && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  <span
                    onClick={(e) => deleteNotif(notif.id, e)}
                    className="mt-1 shrink-0 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getNotifIcon(type: AppNotification['type']): React.ReactNode {
  switch (type) {
    case 'ride_cancelled':
      return <X className="h-4 w-4 text-red-600" />;
    case 'request_accepted':
      return <Check className="h-4 w-4 text-emerald-600" />;
    case 'request_rejected':
      return <X className="h-4 w-4 text-red-500" />;
    case 'ride_booked':
      return <Ticket className="h-4 w-4 text-blue-600" />;
    case 'new_message':
      return <MessageSquare className="h-4 w-4 text-slate-600" />;
    case 'request_cancelled':
      return <X className="h-4 w-4 text-slate-500" />;
    default:
      return <Bell className="h-4 w-4 text-slate-600" />;
  }
}

function getNotifColor(type: AppNotification['type']): string {
  switch (type) {
    case 'ride_cancelled':
      return 'bg-red-100';
    case 'request_accepted':
      return 'bg-emerald-100';
    case 'request_rejected':
      return 'bg-red-50';
    case 'ride_booked':
      return 'bg-blue-100';
    case 'new_message':
      return 'bg-slate-100';
    case 'request_cancelled':
      return 'bg-slate-100';
    default:
      return 'bg-slate-100';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ProfileChip({ profile }: { profile: Profile | null }) {
  if (!profile) return null;
  const initials = (profile.full_name || profile.college_email)
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        {initials}
      </div>
      <div className="hidden lg:block">
        <p className="text-sm font-semibold text-slate-900">{profile.full_name}</p>
        <p className="text-xs text-slate-500">{profile.college_name}</p>
      </div>
    </div>
  );
}
