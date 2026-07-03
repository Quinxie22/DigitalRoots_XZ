import { useState, useEffect } from 'react';
import type { User } from '../types';
import { Loader, Mail, Lock, User as UserIcon, ArrowRight, BookOpen, Sparkles, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import RoleSelectionModal from './RoleSelectionModal';
import OnboardingModal from './OnboardingModal';

interface LoginProps {
  onLogin: (user: User) => void;
}

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

/** Exchange a Firebase ID Token for our internal JWT via the User Service */
async function exchangeFirebaseToken(
  idToken: string,
  opts?: { role?: string; name?: string }
): Promise<{ data: any; ok: boolean }> {
  const res = await fetch(`${USER_SERVICE_URL}/api/users/firebase-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, ...opts }),
  });
  const data = await res.json();
  return { data, ok: res.ok };
}

export default function Login({ onLogin }: LoginProps) {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [view, setView] = useState<'welcome' | 'login' | 'register'>('welcome');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [name, setName]           = useState('');
  const [age, setAge]             = useState<number | ''>('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // State for post-Google Sign-In modals (role selection → onboarding)
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    firebaseUid: string; email: string; name: string;
  } | null>(null);
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [pendingOnboardingUser, setPendingOnboardingUser] = useState<User | null>(null);
  const [pendingOnboardingJwt, setPendingOnboardingJwt]   = useState('');

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

  // ── Forgot Password ──────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found':   'No account found with this email. If you signed up with Google, you do not have a password.',
        'auth/invalid-email':    'Please enter a valid email address.',
        'auth/too-many-requests':'Too many attempts. Please wait a moment and try again.',
      };
      setResetError(msg[err.code] || err.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  // ── Email / Password Submit ──────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // ── REGISTRATION ────────────────────────────────────────────────────
        // 1. Create Firebase account (for credential management)
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const idToken     = await credential.user.getIdToken();

        // 2. Exchange for our internal JWT, passing the chosen role + name
        const calculatedRole = Number(age) >= 40 ? 'Elder' : 'Youth';
        const { data, ok } = await exchangeFirebaseToken(idToken, { role: calculatedRole, name, age } as any);
        if (!ok) throw new Error(data.message || 'Registration failed');

        sessionStorage.setItem('token', data.token);
        localStorage.setItem('token', data.token);
        if (data.needsOnboarding) {
          setPendingOnboardingUser(data.user);
          setPendingOnboardingJwt(data.token);
        } else {
          onLogin(data.user);
        }

      } else {
        // ── LOGIN ───────────────────────────────────────────────────────────
        // Attempt Firebase authentication first (works for Firebase-registered users)
        try {
          const credential = await signInWithEmailAndPassword(auth, email, password);
          const idToken     = await credential.user.getIdToken();
          const { data, ok } = await exchangeFirebaseToken(idToken);
          if (!ok) throw new Error(data.message || 'Login failed');

          sessionStorage.setItem('token', data.token);
          localStorage.setItem('token', data.token);
          if (data.needsOnboarding) {
            setPendingOnboardingUser(data.user);
            setPendingOnboardingJwt(data.token);
          } else {
            onLogin(data.user);
          }

        } catch (firebaseErr: any) {
          // ── Legacy fallback: user exists only in MongoDB (pre-Firebase) ──
          const legacyCodes = [
            'auth/user-not-found',
            'auth/invalid-credential',
            'auth/wrong-password',
            'auth/invalid-email',
            'auth/configuration-not-found', // Firebase not yet configured → always fallback
          ];
          if (legacyCodes.some(c => firebaseErr.code?.startsWith(c) || firebaseErr.code === c)) {
            const res = await fetch(`${USER_SERVICE_URL}/api/users/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Invalid email or password');
            sessionStorage.setItem('token', data.token);
            localStorage.setItem('token', data.token);
            onLogin(data.user);
          } else {
            // Real Firebase error (e.g. wrong password for a Firebase account)
            throw firebaseErr;
          }
        }
      }

    } catch (err: any) {
      // Map Firebase error codes to user-friendly messages
      const msg: Record<string, string> = {
        'auth/email-already-in-use':     'An account with this email already exists.',
        'auth/invalid-email':            'Please enter a valid email address.',
        'auth/weak-password':            'Password must be at least 6 characters.',
        'auth/wrong-password':           'Incorrect password. Please try again.',
        'auth/user-not-found':           'No account found with this email.',
        'auth/invalid-credential':       'Invalid email or password.',
        'auth/too-many-requests':        'Too many attempts. Please wait a moment and try again.',
        'auth/network-request-failed':   'Network error. Check your connection and try again.',
      };
      setError(msg[err.code] || err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ───────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken     = await credential.user.getIdToken();

      // Send to backend without a role — backend decides if this is new or returning
      const { data, ok } = await exchangeFirebaseToken(idToken);
      if (!ok) throw new Error(data.message || 'Google Sign-In failed');

      if (data.needsRoleSelection) {
        // Brand-new Google user — show role picker before profile creation
        setPendingGoogleUser({ firebaseUid: data.firebaseUid, email: data.email, name: data.name });
        setPendingGoogleToken(idToken);
      } else {
        sessionStorage.setItem('token', data.token);
        localStorage.setItem('token', data.token);
        if (data.needsOnboarding) {
          setPendingOnboardingUser(data.user);
          setPendingOnboardingJwt(data.token);
        } else {
          onLogin(data.user);
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Callbacks from child modals ──────────────────────────────────────────
  const handleRoleSelected = (user: User, token: string, needsOnboarding: boolean) => {
    setPendingGoogleUser(null);
    sessionStorage.setItem('token', token);
    localStorage.setItem('token', token);
    if (needsOnboarding) {
      setPendingOnboardingUser(user);
      setPendingOnboardingJwt(token);
    } else {
      onLogin(user);
    }
  };

  const handleOnboardingComplete = (updatedUser: User) => {
    setPendingOnboardingUser(null);
    onLogin(updatedUser);
  };

  // ── Render modals ────────────────────────────────────────────────────────
  if (pendingGoogleUser) {
    return (
      <RoleSelectionModal
        pendingUser={pendingGoogleUser}
        idToken={pendingGoogleToken}
        onComplete={handleRoleSelected}
        onError={(msg) => { setPendingGoogleUser(null); setError(msg); }}
      />
    );
  }

  if (pendingOnboardingUser) {
    return (
      <OnboardingModal
        currentUser={pendingOnboardingUser}
        token={pendingOnboardingJwt}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // ── Heritage Introductory Welcome Screen ──────────────────────────────────
  if (view === 'welcome') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#FCFBF9',
          color: '#2A1E17',
          zIndex: 9999,
        }}
        className="font-serif selection:bg-[#E23E3E]/20"
      >
        
        {/* Fine gold line top border decoration */}
        <div className="h-1 w-full bg-[#E5D2C0]" />

        {/* 1. Header Navigation */}
        <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-[#EADFCF] select-none">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Digital Roots" className="w-9 h-9 flex-shrink-0 shadow-md rounded-xl" />
            <span className="text-2xl font-bold tracking-tight uppercase text-[#4C1212] font-sans">Digital Roots</span>
          </div>
          
          <div className="flex items-center gap-6 font-sans">
            <button 
              onClick={() => { setIsRegister(false); setView('login'); setError(''); }}
              className="text-sm font-bold text-[#4C1212] hover:opacity-80 transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
              className="px-5 py-2.5 rounded-full bg-[#4C1212] hover:bg-[#6B1D1D] text-white text-xs uppercase font-bold tracking-wider transition-all cursor-pointer shadow-md"
            >
              Join Now
            </button>
          </div>
        </header>

        {/* 2. Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-12 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 max-w-xl text-left">
            <p className="text-sm font-bold tracking-widest text-[#E23E3E] uppercase font-sans">Where Generations Meet & Wisdom Flows</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-[#4C1212] font-serif">
              Bridging <br className="hidden md:inline"/> Generations.
            </h1>
            <p className="text-lg md:text-xl italic text-[#5C4D44] font-serif leading-relaxed">
              "Every generation has something to teach — and something to learn. Digital Roots is where they meet."
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4 font-sans">
              <button
                onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
                className="px-6 py-3.5 rounded-xl bg-[#4C1212] hover:bg-[#6B1D1D] text-white font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg shadow-[#4c1212]/10"
              >
                Join the Community
              </button>
              <button
                onClick={() => { setIsRegister(false); setView('login'); setError(''); }}
                className="px-6 py-3.5 rounded-xl border border-[#EADFCF] hover:bg-[#FAF6F0] text-[#4C1212] font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>

          {/* Styled Heritage Photo Frame */}
          <div className="flex justify-center select-none">
            <div className="p-4 bg-[#FAF7F2] border border-[#EADFCF] rounded-3xl shadow-xl hover:rotate-1 transition-transform duration-500 max-w-md w-full relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#EADFCF]/30 border border-[#E5D2C0] flex items-center justify-center flex-col p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#4C1212]/5 flex items-center justify-center text-red-700">
                  <Sparkles size={28} />
                </div>
                <h4 className="font-serif font-bold text-xl text-[#4C1212]">Generational Bridges</h4>
                <p className="text-sm text-[#5C4D44] max-w-xs leading-relaxed font-sans">
                  A living network where elders mentor youth, and younger generations connect with the lived experience and wisdom of those who came before them.
                </p>
              </div>
              {/* Photo Caption Label */}
              <div className="text-center pt-3 text-xs font-bold text-stone-500 uppercase tracking-widest font-sans">
                Digital Roots Community — Est. 2026
              </div>
            </div>
          </div>
        </section>

        {/* 3. Features Section */}
        <section className="bg-[#FAF7F2] border-y border-[#EADFCF] py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-6 space-y-12 text-center">
            <div className="space-y-3">
              <span className="text-2xl text-[#E23E3E]">❧</span>
              <h2 className="text-3xl md:text-4xl font-extrabold font-serif text-[#4C1212]">A Platform Built for All Generations</h2>
              <p className="text-sm text-[#5C4D44] uppercase tracking-wider font-semibold font-sans">Connecting elders and youth — closing the generational gap</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left font-sans">
              
              {/* Wisdom Hub Feature Card */}
              <div className="bg-white border border-[#EADFCF] p-6 md:p-8 rounded-3xl space-y-4 hover:shadow-lg transition-all duration-300">
                <div className="w-11 h-11 rounded-2xl bg-[#E23E3E]/10 flex items-center justify-center text-[#E23E3E]">
                  <Heart size={20} />
                </div>
                <h3 className="font-serif font-bold text-xl text-[#4C1212]">Wisdom Hub</h3>
                <p className="text-sm text-[#5C4D44] leading-relaxed">
                  A living bridge between generations. Elders share curated guides, life lessons, cultural knowledge, and mentorship — while younger members gain the insight and grounding that only lived experience can provide.
                </p>
              </div>

              {/* Community & Connection Feature Card */}
              <div className="bg-white border border-[#EADFCF] p-6 md:p-8 rounded-3xl space-y-4 hover:shadow-lg transition-all duration-300">
                <div className="w-11 h-11 rounded-2xl bg-[#4C1212]/10 flex items-center justify-center text-[#4C1212]">
                  <BookOpen size={20} />
                </div>
                <h3 className="font-serif font-bold text-xl text-[#4C1212]">Generational Connect</h3>
                <p className="text-sm text-[#5C4D44] leading-relaxed">
                  Break down barriers between age groups through real conversations, shared voice recordings, group mentoring, and collaborative digital archives — so no generation ever feels alone or unheard.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* 4. Timeless Quote Section */}
        <section className="max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
          <div className="space-y-6">
            <span className="text-3xl text-stone-300 font-serif">“</span>
            <p className="text-xl md:text-2xl font-serif italic text-[#4C1212] leading-relaxed max-w-2xl mx-auto">
              The bond between generations is the most powerful force in any society. When elders and youth truly listen to each other, entire communities are transformed.
            </p>
            <div className="w-12 h-0.5 bg-[#E23E3E]/30 mx-auto rounded-full" />
            <p className="text-xs text-[#5C4D44] uppercase tracking-wider font-extrabold font-sans">Digital Roots — Our Mission</p>
          </div>
        </section>

        {/* 5. Bottom Call to Action Section */}
        <section className="bg-[#4C1212] text-white py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-serif font-extrabold">Connecting Generations, Together.</h2>
            <p className="text-base md:text-lg font-sans text-stone-300 max-w-xl mx-auto leading-relaxed">
              Join our growing community of elders and youth, dedicated to closing the generational gap through real conversations, mentorship, and shared wisdom.
            </p>
            <div className="pt-4 font-sans">
              <button
                onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
                className="px-8 py-4 rounded-xl bg-white hover:bg-[#FCFBF9] text-[#4C1212] font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-lg"
              >
                Join the Movement
              </button>
            </div>
          </div>
        </section>

        {/* 6. Footer */}
        <footer className="bg-[#1A110D] text-stone-400 py-12 border-t border-stone-850 font-sans">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-3 text-left">
              <span className="text-xl font-bold uppercase text-white">Digital Roots</span>
              <p className="text-sm text-stone-500 max-w-sm leading-relaxed">
                A platform dedicated to bridging the gap between generations — connecting elders and youth through mentorship, shared wisdom, and meaningful dialogue.
              </p>
            </div>
            
            <div className="flex gap-16 md:justify-end text-xs text-left">
              <div className="space-y-2">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">Heritage</span>
                <ul className="space-y-1.5 text-stone-500">
                  <li className="hover:text-stone-300 cursor-pointer">Our Story</li>
                  <li className="hover:text-stone-300 cursor-pointer">The Philosophy</li>
                  <li className="hover:text-stone-300 cursor-pointer">Archive Guidelines</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">Legacy</span>
                <ul className="space-y-1.5 text-stone-500">
                  <li className="hover:text-stone-300 cursor-pointer">Wisdom Guides</li>
                  <li className="hover:text-stone-300 cursor-pointer">Memoir Audio</li>
                  <li className="hover:text-stone-300 cursor-pointer">Write Articles</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 pt-12 text-center text-[10px] text-stone-600 border-t border-stone-800/40 mt-8">
            &copy; 2026 Digital Roots. All rights reserved. Preserving history, one voice at a time.
          </div>
        </footer>

      </div>
    );
  }

  // ── Main Login / Register Form ───────────────────────────────────────────

  // ── Forgot Password Panel ────────────────────────────────────────────────
  if (showForgotPassword) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-dark)] p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-[#111118] border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl space-y-6 animate-fade-in">

          {/* Header */}
          <div className="space-y-1.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--primary-10)' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-2xl font-bold font-serif text-stone-850 dark:text-white">Reset your password</h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              Enter your email address and we'll send you a link to reset your password.
              <br />
              <span className="text-stone-500">Google Sign-In users don't have a password — just click "Sign in with Google" instead.</span>
            </p>
          </div>

          {resetSent ? (
            /* Success state */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-2">
                <div className="text-2xl">✉️</div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Email sent!</p>
                <p className="text-xs text-stone-500">
                  Check <span className="font-semibold text-stone-700 dark:text-stone-300">{resetEmail}</span> for a password reset link. It may take a minute to arrive.
                </p>
              </div>
              <button
                onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(''); }}
                className="w-full py-2.5 rounded-xl text-white font-bold text-xs transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: 'var(--primary)' }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {resetError && (
                <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500 animate-slide-in">
                  {resetError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Email address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                    <Mail size={14} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 rounded-xl text-white font-bold text-xs transition-all hover:opacity-95 active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--primary)' }}
              >
                {resetLoading ? (
                  <><Loader className="animate-spin" size={14} /><span>Sending...</span></>
                ) : (
                  <><span>Send Reset Link</span><ArrowRight size={14} /></>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetError(''); setResetEmail(''); }}
                className="w-full py-2.5 text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
              >
                ← Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main Login / Register Form (original) ────────────────────────────────
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
              {isRegister ? t('signupTitle') : t('loginTitle')}
            </h2>
            <p className="text-xs text-stone-400">
              {isRegister
                ? t('signupSubtitle')
                : t('loginSubtitle')}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-500 text-left animate-slide-in">
              {error}
            </div>
          )}

          {/* ── Google Sign-In Button ── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a1a24] hover:bg-stone-50 dark:hover:bg-[#202030] transition-all text-xs font-semibold text-stone-700 dark:text-stone-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader className="animate-spin" size={14} />
            ) : (
              /* Google "G" SVG icon */
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>{isRegister ? t('googleSignup') : t('googleLogin')}</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{t('orSeparator')}</span>
            <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
          </div>

          {/* ── Email / Password Form ── */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {isRegister && (
              <div className="space-y-1.5 text-left animate-slide-in">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-455 dark:text-stone-400">
                  {t('ageLabel')}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="120"
                  placeholder={t('enterAgePlaceholder')}
                  value={age}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                  style={{ borderColor: 'var(--border)' }}
                />
                {age !== '' && (
                  <p className="text-[11px] text-stone-400 mt-2 leading-relaxed text-left">
                    {t('ageHelper')} <span className="font-bold text-red-500">{Number(age) >= 40 ? t('senior') : t('youth')}</span>.
                  </p>
                )}
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-455 dark:text-stone-400">
                  {t('nameLabel')}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                    <UserIcon size={14} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder={t('namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-455 dark:text-stone-400">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-450">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  required
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-455 dark:text-stone-400">
                  {t('passwordLabel')}
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setResetEmail(email); setResetError(''); setResetSent(false); }}
                    className="text-[10px] transition-colors hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    {t('forgotPassword')}
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
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || (isRegister && age === '')}
              className="w-full py-3 rounded-xl text-white font-bold text-xs transition-all hover:opacity-95 active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 cursor-pointer mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--primary)' }}
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={14} />
                  <span>{t('loading')}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? t('createAccountButton') : t('enterRootsButton')}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 flex flex-col items-center">
            <button
              type="button"
              onClick={() => { 
                const nextReg = !isRegister;
                setIsRegister(nextReg); 
                setView(nextReg ? 'register' : 'login');
                setError(''); 
              }}
              className="text-xs transition-colors hover:underline text-stone-550 dark:text-stone-450 cursor-pointer"
            >
              {isRegister
                ? t('alreadyHaveAccount')
                : t('newToCommunity')}
            </button>
            <button
              type="button"
              onClick={() => { setView('welcome'); setError(''); }}
              className="text-[11px] transition-colors hover:underline text-stone-400 dark:text-stone-500 mt-2 cursor-pointer"
            >
              ← Back to Welcome Screen
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}