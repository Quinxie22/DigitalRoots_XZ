import { useState, useEffect } from 'react';
import type { User } from '../types';
import { Loader, Mail, Lock, User as UserIcon, ArrowRight, BookOpen, Sparkles, Heart, Eye, EyeOff } from 'lucide-react';
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
import CustomDialog from './CustomDialog';

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
  const [dateOfBirth, setDateOfBirth] = useState('');

  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return 0;
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  };
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  // State for post-Google Sign-In modals (role selection â†’ onboarding)
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    firebaseUid: string; email: string; name: string;
  } | null>(null);
  const [pendingGoogleToken, setPendingGoogleToken] = useState('');
  const [pendingOnboardingUser, setPendingOnboardingUser] = useState<User | null>(null);
  const [pendingOnboardingJwt, setPendingOnboardingJwt]   = useState('');

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => {},
  });

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

  // â”€â”€ Forgot Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Email / Password Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // ── REGISTRATION ────────────────────────────────────────────────────────
        // 1. Create Firebase account (for credential management)
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const idToken     = await credential.user.getIdToken();

        // 2. Exchange for our internal JWT, passing the chosen role + name
        if (!dateOfBirth) {
          setError('Date of birth is required.');
          setLoading(false);
          return;
        }
        const calculatedAge = calculateAge(dateOfBirth);
        if (calculatedAge < 15 || calculatedAge > 250) {
          setDialogConfig({
            isOpen: true,
            type: 'error',
            title: 'Age Validation Failed',
            message: 'Age validation failed: Users must be between 15 and 250 years old to register. If you believe this is an error, please contact support with your justification.',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
          setLoading(false);
          return;
        }
        const calculatedRole = calculatedAge >= 40 ? 'Elder' : 'Youth';
        const { data, ok } = await exchangeFirebaseToken(idToken, { role: calculatedRole, name, dateOfBirth } as any);
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
        // â”€â”€ LOGIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // 1. Pre-check if the email is registered in MongoDB
        try {
          const checkRes = await fetch(`${USER_SERVICE_URL}/api/users/check-email?email=${encodeURIComponent(email.trim())}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (!checkData.exists) {
              setError('No account found with this email. Redirecting to Sign Up...');
              setTimeout(() => {
                setIsRegister(true);
                setView('register');
                setError('');
              }, 2000);
              setLoading(false);
              return;
            }
          }
        } catch (checkErr) {
          console.warn('[Login] Precheck email exists failed:', checkErr);
        }

        // 2. Attempt Firebase authentication first (works for Firebase-registered users)
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
          // â”€â”€ Legacy fallback: user exists only in MongoDB (pre-Firebase) â”€â”€
          const legacyCodes = [
            'auth/user-not-found',
            'auth/invalid-credential',
            'auth/wrong-password',
            'auth/invalid-email',
            'auth/configuration-not-found', // Firebase not yet configured â†’ always fallback
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

  // â”€â”€ Google Sign-In â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const idToken     = await credential.user.getIdToken();

      // Send to backend without a role â€” backend decides if this is new or returning
      const { data, ok } = await exchangeFirebaseToken(idToken);
      if (!ok) throw new Error(data.message || 'Google Sign-In failed');

      if (data.needsRoleSelection) {
        // Brand-new Google user â€” show role picker before profile creation
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

  // â”€â”€ Callbacks from child modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Render modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // -- Heritage Introductory Welcome Screen --
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
        {/* 1. Sticky Nav */}
        <header style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(252,251,249,0.9)', borderBottom: '1px solid #EADFCF' }}>
          <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="Digital Roots" className="w-9 h-9 flex-shrink-0 rounded-xl shadow" />
              <span className="text-xl font-extrabold tracking-tight text-[#4C1212] font-sans uppercase">Digital Roots</span>
            </div>
            <div className="flex items-center gap-4 font-sans">
              <button type="button" onClick={() => { setIsRegister(false); setView('login'); setError(''); }}
                className="text-sm font-semibold text-[#4C1212] hover:opacity-70 transition-opacity cursor-pointer hidden sm:block">
                Sign In
              </button>
              <button type="button" onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
                className="px-5 py-2.5 rounded-full bg-[#4C1212] hover:bg-[#6B1D1D] text-white text-xs uppercase font-bold tracking-wider transition-all cursor-pointer shadow-md active:scale-95">
                Join Free
              </button>
            </div>
          </div>
        </header>

        {/* 2. Cinematic Hero with real photo */}
        <section style={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
          <img src="/hero-generations.png" alt="Grandmother and granddaughter connecting"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(110deg, rgba(28,8,4,0.88) 0%, rgba(76,18,18,0.6) 55%, rgba(0,0,0,0.1) 100%)' }} />
          <div className="relative max-w-7xl mx-auto px-6 py-24 w-full">
            <div className="max-w-2xl space-y-7">
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase font-sans"
                style={{ background: 'rgba(226,62,62,0.2)', color: '#FFBCBC', border: '1px solid rgba(226,62,62,0.4)' }}>
                Where Generations Meet &amp; Wisdom Flows
              </span>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] text-white font-serif drop-shadow-lg">
                Bridging<br />Generations.<br />
                <span style={{ color: '#FFBCBC' }}>Together.</span>
              </h1>
              <p className="text-lg md:text-xl text-stone-200 font-sans font-light leading-relaxed max-w-xl">
                Every generation has something to teach — and something to learn. Digital Roots is the platform where elders and youth truly connect.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2 font-sans">
                <button type="button" onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
                  className="px-8 py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-xl"
                  style={{ background: '#E23E3E', color: 'white' }}>
                  Join the Community →
                </button>
                <button type="button" onClick={() => { setIsRegister(false); setView('login'); setError(''); }}
                  className="px-8 py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1.5px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(8px)' }}>
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Image Feature Cards */}
        <section className="py-20 md:py-28" style={{ background: '#FAF7F2' }}>
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center space-y-3 mb-14">
              <p className="text-xs font-bold tracking-widest text-[#E23E3E] uppercase font-sans">What We Offer</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#4C1212] font-serif">A Platform Built for All Generations</h2>
              <p className="text-base text-[#5C4D44] font-sans max-w-xl mx-auto">Closing the gap between elders and youth through real conversations, mentorship and shared wisdom.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="rounded-3xl overflow-hidden shadow-xl group cursor-pointer" style={{ border: '1px solid #EADFCF', background: 'white' }}
                onClick={() => { setIsRegister(true); setView('register'); setError(''); }}>
                <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                  <img src="/wisdom-mentorship.png" alt="Elder mentoring youth"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.6s ease' }}
                    className="group-hover:scale-105" />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(30,5,5,0.65), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider font-sans"
                      style={{ background: 'rgba(226,62,62,0.85)', color: 'white' }}>Wisdom Hub</span>
                  </div>
                </div>
                <div className="p-7 space-y-3 font-sans">
                  <h3 className="font-serif font-bold text-xl text-[#4C1212]">Learn from Those Who Lived It</h3>
                  <p className="text-sm text-[#5C4D44] leading-relaxed">Elders share curated guides, life lessons, cultural knowledge, and mentorship — while younger members gain the insight that only lived experience can provide.</p>
                  <p className="text-xs font-bold text-[#E23E3E] uppercase tracking-wider group-hover:underline">Explore Wisdom →</p>
                </div>
              </div>
              <div className="rounded-3xl overflow-hidden shadow-xl group cursor-pointer" style={{ border: '1px solid #EADFCF', background: 'white' }}
                onClick={() => { setIsRegister(true); setView('register'); setError(''); }}>
                <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
                  <img src="/community-connect.png" alt="Multigenerational community"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.6s ease' }}
                    className="group-hover:scale-105" />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(30,5,5,0.65), transparent)' }} />
                  <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider font-sans"
                      style={{ background: 'rgba(76,18,18,0.85)', color: 'white' }}>Generational Connect</span>
                  </div>
                </div>
                <div className="p-7 space-y-3 font-sans">
                  <h3 className="font-serif font-bold text-xl text-[#4C1212]">No Generation Left Behind</h3>
                  <p className="text-sm text-[#5C4D44] leading-relaxed">Break down barriers between age groups through real conversations, voice recordings, group mentoring, and collaborative archives — so no generation feels alone or unheard.</p>
                  <p className="text-xs font-bold text-[#E23E3E] uppercase tracking-wider group-hover:underline">Join the Conversation →</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Quote Band */}
        <section className="py-20 text-center px-6" style={{ background: '#4C1212' }}>
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="text-5xl font-serif leading-none" style={{ color: 'rgba(255,188,188,0.35)' }}>"</div>
            <p className="text-xl md:text-2xl font-serif italic text-white leading-relaxed">
              The bond between generations is the most powerful force in any society. When elders and youth truly listen to each other, entire communities are transformed.
            </p>
            <div className="w-10 h-0.5 mx-auto rounded-full" style={{ background: 'rgba(255,188,188,0.35)' }} />
            <p className="text-xs uppercase tracking-widest font-bold font-sans" style={{ color: 'rgba(255,188,188,0.6)' }}>Digital Roots — Our Mission</p>
          </div>
        </section>

        {/* 5. Full-photo CTA */}
        <section style={{ position: 'relative', minHeight: 420, display: 'flex', alignItems: 'center' }}>
          <img src="/hero-generations.png" alt="Community"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.28)' }} />
          <div className="relative max-w-3xl mx-auto px-6 py-20 text-center space-y-6 w-full">
            <h2 className="text-3xl md:text-4xl font-serif font-extrabold text-white">Connecting Generations, Together.</h2>
            <p className="text-base md:text-lg font-sans text-stone-300 max-w-xl mx-auto leading-relaxed">
              Join our growing community of elders and youth, dedicated to closing the generational gap through real conversations, mentorship, and shared wisdom.
            </p>
            <button type="button" onClick={() => { setIsRegister(true); setView('register'); setError(''); }}
              className="px-10 py-4 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xl font-sans"
              style={{ background: '#E23E3E', color: 'white' }}>
              Join the Movement — It's Free
            </button>
          </div>
        </section>

        {/* 6. Footer */}
        <footer style={{ background: '#110A07', color: '#9C8F8A' }} className="py-12 font-sans">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" alt="Digital Roots" className="w-7 h-7 rounded-lg" />
                <span className="text-base font-bold uppercase text-white">Digital Roots</span>
              </div>
              <p className="text-sm text-stone-500 max-w-sm leading-relaxed">
                Bridging the gap between generations — connecting elders and youth through mentorship, shared wisdom, and meaningful dialogue.
              </p>
            </div>
            <div className="flex gap-14 md:justify-end text-sm">
              <div className="space-y-2">
                <span className="font-bold text-white uppercase tracking-wider text-xs">Platform</span>
                <ul className="space-y-2 text-stone-500">
                  <li className="hover:text-stone-300 cursor-pointer transition-colors">Wisdom Hub</li>
                  <li className="hover:text-stone-300 cursor-pointer transition-colors">Generational Connect</li>
                  <li className="hover:text-stone-300 cursor-pointer transition-colors">Mentoring Program</li>
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-bold text-white uppercase tracking-wider text-xs">Join</span>
                <ul className="space-y-2 text-stone-500">
                  <li className="hover:text-stone-300 cursor-pointer transition-colors" onClick={() => { setIsRegister(true); setView('register'); setError(''); }}>Create Account</li>
                  <li className="hover:text-stone-300 cursor-pointer transition-colors" onClick={() => { setIsRegister(false); setView('login'); setError(''); }}>Sign In</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 pt-8 mt-8 text-center text-xs text-stone-700 border-t border-stone-800/50">
            © 2026 Digital Roots. Bridging generations, preserving legacies.
          </div>
        </footer>
        <CustomDialog
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          message={dialogConfig.message}
          onConfirm={dialogConfig.onConfirm}
        />
      </div>
    );
  }

  // â”€â”€ Main Login / Register Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Forgot Password Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (showForgotPassword) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-dark)] p-4">
        <div className="max-w-md w-full p-8 bg-white dark:bg-[#111118] border border-stone-200 dark:border-stone-800 rounded-3xl shadow-xl space-y-6 animate-fade-in">

          {/* Header */}
          <div className="space-y-1.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--primary-10)' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-2xl font-bold font-serif text-stone-900 dark:text-white">Reset your password</h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              Enter your email address and we'll send you a link to reset your password.
              <br />
              <span className="text-stone-500">Google Sign-In users don't have a password â€” just click "Sign in with Google" instead.</span>
            </p>
          </div>

          {resetSent ? (
            /* Success state */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-2">
                <div className="text-2xl">âœ‰ï¸</div>
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
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
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
                â† Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // â”€â”€ Main Login / Register Form (original) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            <h2 className="text-2xl font-bold font-serif text-stone-900 dark:text-white">
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

          {/* â”€â”€ Google Sign-In Button â”€â”€ */}
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

          {/* â”€â”€ Email / Password Form â”€â”€ */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {isRegister && (
              <div className="space-y-1.5 text-left animate-slide-in">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                  style={{ borderColor: 'var(--border)' }}
                />
                {dateOfBirth !== '' && (
                  <p className="text-[11px] text-stone-400 mt-2 leading-relaxed text-left">
                    {t('ageHelper')} <span className="font-bold text-red-500">{calculateAge(dateOfBirth) >= 40 ? t('senior') : t('youth')}</span> (Age: {calculateAge(dateOfBirth)}).
                  </p>
                )}
              </div>
            )}

            {isRegister && (
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">
                  {t('nameLabel')}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
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
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
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
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                  <Lock size={14} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl outline-none border transition-all dark:bg-[#1a1a24] text-stone-800 dark:text-white dark:border-stone-800 focus:border-red-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 focus:outline-none cursor-pointer flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || (isRegister && dateOfBirth === '')}
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
              className="text-xs transition-colors hover:underline text-stone-550 dark:text-stone-500 cursor-pointer"
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
              â† Back to Welcome Screen
            </button>
          </div>
        </div>
      </div>
      <CustomDialog
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        message={dialogConfig.message}
        onConfirm={dialogConfig.onConfirm}
      />
    </div>
  );
}