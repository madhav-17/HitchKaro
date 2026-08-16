import { useState } from 'react';
import { Car, Mail, Lock, User, Phone, GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/context/RouterContext';
import { isCollegeEmail } from '@/lib/profiles';

export function AuthPage() {
  const { navigate } = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [collegeName, setCollegeName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup') {
      if (!isCollegeEmail(email)) {
        setError('Please use your college email (e.g. .edu, .ac.in domain).');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (!fullName.trim() || !collegeName.trim()) {
        setError('Please fill in all required fields.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;

        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            phone,
            college_name: collegeName,
            college_email: email,
            verification_status: 'pending',
          });
        }
        navigate('/verify');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left brand panel */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white lg:p-12">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute right-0 top-1/2 h-96 w-96 rounded-full bg-teal-300/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Car className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            Hitch<span className="text-emerald-200">Karo</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight lg:text-5xl">
            Share rides with fellow students
          </h1>
          <p className="mt-4 text-lg text-emerald-50/90">
            HitchKaro connects verified college students to share rides, split costs,
            and travel together safely.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, text: 'Verified students only — ID card & face scan' },
              { icon: <Car className="h-5 w-5" />, text: 'Offer or find rides on your route' },
              { icon: <GraduationCap className="h-5 w-5" />, text: 'Negotiate prices in a private chat' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-emerald-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                  {f.icon}
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-emerald-100/70">
          Trusted by students across campuses nationwide.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'signup'
                ? 'Register with your college email to get started.'
                : 'Sign in to continue your journey.'}
            </p>
          </div>

          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => setMode('signup')}
            >
              Sign up
            </button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <Input
                  label="Full name"
                  placeholder="Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  icon={<User className="h-4 w-4" />}
                  required
                />
                <Input
                  label="Phone number"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  icon={<Phone className="h-4 w-4" />}
                />
                <Input
                  label="College / University name"
                  placeholder="IIT Delhi"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  icon={<GraduationCap className="h-4 w-4" />}
                  required
                />
              </>
            )}

            <Input
              label="College email"
              type="email"
              placeholder="yourname@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
            />

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
