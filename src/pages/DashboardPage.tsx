import { Car, Compass, Plus, Search, ShieldCheck, TrendingUp, Users, MapPin, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/context/RouterContext';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export function DashboardPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-lg sm:p-12">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <Badge color="emerald" className="bg-white/15 text-white border-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Student
            </Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Hey {profile.full_name.split(' ')[0]}, where are you heading?
            </h1>
            <p className="mt-2 text-emerald-50/90">
              Offer a ride to fellow students or find one heading your way. Split the cost,
              travel safe.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/offer')}
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <Plus className="h-4 w-4" />
              Offer a ride
            </button>
            <button
              onClick={() => navigate('/find')}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/30 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-emerald-500/40"
            >
              <Search className="h-4 w-4" />
              Find a ride
            </button>
          </div>
        </div>
      </div>

      {/* Role selection cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <RoleCard
          icon={<Car className="h-6 w-6" />}
          title="I'm a Rider"
          description="Got empty seats? Offer rides to students on your route and earn back your fuel costs."
          cta="Offer a ride"
          to="/offer"
          accent="emerald"
        />
        <RoleCard
          icon={<Compass className="h-6 w-6" />}
          title="I'm a Passenger"
          description="Need a lift? Search for rides heading your way and negotiate the price in chat."
          cta="Find a ride"
          to="/find"
          accent="blue"
        />
      </div>

      {/* Quick stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Your College"
          value={profile.college_name}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Community"
          value="Verified students"
        />
        <StatCard
          icon={<MapPin className="h-5 w-5" />}
          label="Email"
          value={profile.college_email}
        />
      </div>

      {/* How it works */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">How HitchKaro works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StepCard
            num="1"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Get verified"
            desc="Sign up with your college email and verify with your ID card + face scan."
          />
          <StepCard
            num="2"
            icon={<Car className="h-5 w-5" />}
            title="Offer or find"
            desc="Post a ride with your route details, or search for rides to your destination."
          />
          <StepCard
            num="3"
            icon={<Clock className="h-5 w-5" />}
            title="Negotiate & ride"
            desc="Chat with the other person, agree on a price, and hit the road together."
          />
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  icon,
  title,
  description,
  cta,
  to,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  to: string;
  accent: 'emerald' | 'blue';
}) {
  const accentBg = accent === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600';
  return (
    <Card className="group p-6" onClick={() => (window.location.hash = to)}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentBg}`}>
        {icon}
      </div>
      <h3 className="mt-4 text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 group-hover:gap-2.5 transition-all">
        {cta}
        <span>→</span>
      </div>
    </Card>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function StepCard({ num, icon, title, desc }: { num: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          {icon}
        </div>
        <span className="text-2xl font-bold text-slate-200">{num}</span>
      </div>
      <h4 className="mt-3 text-sm font-bold text-slate-900">{title}</h4>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </Card>
  );
}
