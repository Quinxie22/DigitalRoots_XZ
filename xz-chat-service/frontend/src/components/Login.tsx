import { useState, useEffect } from 'react';
import type { User } from '../types';
import { Loader, Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

export default function Login({ onLogin }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Elder');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('auth-layout');
    document.body.classList.add('auth-layout');
    const rootEl = document.getElementById('root');
    if (rootEl) rootEl.classList.add('auth-layout');

    return () => {
      document.documentElement.classList.remove('auth-layout');
      document.body.classList.remove('auth-layout');
      if (rootEl) rootEl.classList.remove('auth-layout');
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/users/register' : '/api/users/login';
    const payload = isRegister
      ? { email, password, name, role }
      : { email, password };

    try {
      const res = await fetch(`${USER_SERVICE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      sessionStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[var(--bg-dark)] font-sans">

      {/* LEFT SECTION: BRANDING */}
      <div className="hidden md:flex md:w-[45%] bg-gradient-to-b from-[#101016] to-[#09090d] border-r border-[#1a1a24] text-white flex-col justify-between p-6 md:p-12 relative overflow-hidden select-none">
        {/* Glow decoration */}
        <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full opacity-10 bg-red-500 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <svg className="w-9 h-9 flex-shrink-0 shadow-lg" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="12" fill="url(#xzGrad)" />
            <path d="M11 11L29 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M29 11L23 17" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M17 23L11 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M13 15H27L13 25H27" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="xzGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E23E3E" />
                <stop stopColor="#8A1E24" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-lg font-bold tracking-tight uppercase">Digital Roots</span>
        </div>

        {/* Catchphrase */}
        <div className="my-auto py-6 md:py-12 space-y-6 relative z-10 max-w-sm">
          <h1 className="text-3xl md:text-4xl font-extrabold font-serif leading-tight">
            Passing on <span className="underline decoration-red-500 decoration-wavy">Knowledge</span>, nurturing the bond.
          </h1>
          <div className="w-12 h-1 bg-red-500/20 rounded-full" />
        </div>

        {/* Footer Quote */}
        <div className="space-y-4 relative z-10">
          <p className="text-xs md:text-sm font-medium italic leading-relaxed text-stone-300">
            "Every generation has something to teach. Every generation has something to learn. XZ is where these lessons meet."
          </p>
          <div className="flex gap-1.5">
            <span className="w-8 h-1 rounded bg-red-500" />
            <span className="w-1.5 h-1 rounded bg-white/20" />
            <span className="w-1.5 h-1 rounded bg-white/20" />
            <span className="w-1.5 h-1 rounded bg-white/20" />
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: FORM CARD */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-2.5 xs:p-4 py-8 md:p-12 bg-[#FAF8F6] dark:bg-[#0a0a0f] md:min-h-screen">
        <div className="max-w-md w-full p-4 xs:p-6 md:p-8 bg-white dark:bg-[#111118] border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl space-y-5 xs:space-y-6 animate-fade-in relative z-10">

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold font-serif text-stone-850 dark:text-white">
              {isRegister ? 'Join Digital Roots' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-stone-400">
              {isRegister
                ? 'Bridge generational wisdom and document history'
                : 'Continue your intergenerational journey.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500 text-left animate-slide-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {isRegister && (
              <div className="space-y-2 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-450">
                  Choose Your Identity
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('Elder')}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${role === 'Elder'
                        ? 'bg-red-50/10 text-red-500 border-red-500/30 font-bold'
                        : 'bg-transparent text-stone-400 border-stone-200 dark:border-stone-800'
                      }`}
                    style={{ borderColor: role === 'Elder' ? 'var(--primary)' : undefined }}
                  >
                    <span className="text-xs">Senior</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('Youth')}
                    className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${role === 'Youth'
                        ? 'bg-red-50/10 text-red-500 border-red-500/30 font-bold'
                        : 'bg-transparent text-stone-400 border-stone-200 dark:border-stone-800'
                      }`}
                    style={{ borderColor: role === 'Youth' ? 'var(--primary)' : undefined }}
                  >
                    <span className="text-xs">Youth</span>
                  </button>
                </div>
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-450">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arthur Miller"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-450">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@archive.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-450">
                  Password
                </label>
                {!isRegister && (
                  <button type="button" className="text-[10px] text-stone-450 hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                  <Lock size={14} />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-xs transition-all hover:opacity-95 active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-6"
              style={{
                background: 'var(--primary)'
              }}
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={14} />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Enter Digital Roots'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-xs transition-colors hover:underline text-stone-550 dark:text-stone-450"
            >
              {isRegister
                ? 'Already have an account? Sign In'
                : 'New to our community? Create an account'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}