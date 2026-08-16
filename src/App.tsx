import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import { NavBar } from '@/components/NavBar';
import { AuthPage } from '@/pages/AuthPage';
import { VerifyPage } from '@/pages/VerifyPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OfferRidePage } from '@/pages/OfferRidePage';
import { FindRidePage } from '@/pages/FindRidePage';
import { RideDetailsPage } from '@/pages/RideDetailsPage';
import { MyRidesPage } from '@/pages/MyRidesPage';
import { MyTripsPage } from '@/pages/MyTripsPage';
import { ChatsPage } from '@/pages/ChatsPage';
import { ChatPage } from '@/pages/ChatPage';

function AppRoutes() {
  const { session, profile, loading } = useAuth();
  const { path, navigate } = useRouter();

  // Route guard
  useEffect(() => {
    if (loading) return;
    if (!session && path !== '/' && !path.startsWith('/login')) {
      navigate('/');
    }
    if (session && (path === '/' || path === '/login')) {
      if (profile && profile.verification_status !== 'verified') {
        navigate('/verify');
      } else {
        navigate('/dashboard');
      }
    }
    if (session && profile && profile.verification_status !== 'verified' && path !== '/verify') {
      navigate('/verify');
    }
  }, [session, profile, loading, path, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (profile && profile.verification_status !== 'verified' && path !== '/verify') {
    return <VerifyPage />;
  }

  const showNav = path !== '/verify' || (profile?.verification_status === 'verified');

  return (
    <div className="min-h-screen bg-slate-50">
      {showNav && <NavBar />}
      <main>{renderRoute(path)}</main>
    </div>
  );
}

function renderRoute(path: string) {
  if (path === '/verify') return <VerifyPage />;
  if (path === '/dashboard') return <DashboardPage />;
  if (path === '/offer') return <OfferRidePage />;
  if (path === '/find') return <FindRidePage />;
  if (path.startsWith('/ride/')) return <RideDetailsPage rideId={path.split('/ride/')[1]} />;
  if (path === '/my-rides') return <MyRidesPage />;
  if (path === '/my-trips') return <MyTripsPage />;
  if (path === '/chats') return <ChatsPage />;
  if (path.startsWith('/chat/')) return <ChatPage requestId={path.split('/chat/')[1]} />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </RouterProvider>
  );
}
