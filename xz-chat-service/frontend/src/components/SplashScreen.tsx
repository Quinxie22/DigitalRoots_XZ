import { useState, useEffect, useRef } from 'react';
import {
  Globe, BookOpen, Mic, Users, Zap, Shield,
  ChevronRight, Play, Star, Layers
} from 'lucide-react';

interface SplashScreenProps {
  onEnter: () => void;
}

// ── Animated floating particle ─────────────────────────────────────────────
function Particle({ x, y, size, delay, duration }: {
  x: number; y: number; size: number; delay: number; duration: number;
}) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: 'var(--primary)',
        opacity: 0,
        animation: `floatParticle ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

// ── Animated stat card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, delay }: {
  icon: any; value: string; label: string; delay: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl border"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        animation: `fadeInUp 0.6s ease ${delay} both`,
      }}
    >
      <Icon size={18} style={{ color: 'var(--primary)' }} />
      <span className="text-xl font-black text-white">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </span>
    </div>
  );
}

// ── Feature pill ────────────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, text, delay }: {
  icon: any; text: string; delay: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-full text-xs font-semibold border"
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(8px)',
        animation: `fadeInUp 0.5s ease ${delay} both`,
      }}
    >
      <Icon size={13} style={{ color: 'var(--primary)' }} />
      {text}
    </div>
  );
}

export default function SplashScreen({ onEnter }: SplashScreenProps) {
  const [phase, setPhase] = useState<'intro' | 'main'>('intro');
  const [logoVisible, setLogoVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Particle canvas animation ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create orbs
    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 80 + Math.random() * 120,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      hue: i % 2 === 0 ? '138, 30, 36' : '109, 40, 217',
      alpha: 0.04 + Math.random() * 0.06,
    }));

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      orbs.forEach(orb => {
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `rgba(${orb.hue}, ${orb.alpha})`);
        grad.addColorStop(1, `rgba(${orb.hue}, 0)`);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        orb.x += orb.dx;
        orb.y += orb.dy;
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ── Phase transition: brief intro → main content ───────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 200);
    const t2 = setTimeout(() => setPhase('main'), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleEnter = () => {
    setExiting(true);
    // Give the CSS exit animation time to play before parent unmounts this component
    setTimeout(() => {
      onEnter();
    }, 550);
  };

  const particles = Array.from({ length: 18 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 4,
    duration: 4 + Math.random() * 6,
  }));

  return (
    <>
      {/* Inject keyframes */}
      <style>{`
        @keyframes floatParticle {
          0%   { opacity: 0; transform: translateY(0px) scale(0.8); }
          30%  { opacity: 0.4; }
          70%  { opacity: 0.2; }
          100% { opacity: 0; transform: translateY(-60px) scale(1.2); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes logoReveal {
          0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          60%  { transform: scale(1.06) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: 0.03; }
          50%       { opacity: 0.06; }
        }
        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(138,30,36,0); }
          50%       { box-shadow: 0 0 28px 4px rgba(138,30,36,0.25); }
        }
        @keyframes slideOut {
          to { opacity: 0; transform: scale(1.04); }
        }
        .splash-exit { animation: slideOut 0.6s ease forwards; }
      `}</style>

      <div
        className={`fixed inset-0 flex flex-col items-center justify-center overflow-hidden select-none z-50 ${exiting ? 'splash-exit' : ''}`}
        style={{ background: '#05050a' }}
      >
        {/* Canvas orbs */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            animation: 'gridPulse 6s ease-in-out infinite',
          }}
        />

        {/* Floating particles */}
        {particles.map((p, i) => (
          <Particle key={i} {...p} />
        ))}

        {/* ── INTRO PHASE ── full-screen logo burst */}
        {phase === 'intro' && (
          <div className="flex flex-col items-center gap-4 z-10">
            <div
              style={{
                opacity: logoVisible ? 1 : 0,
                animation: logoVisible ? 'logoReveal 0.9s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
              }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center font-black text-white text-4xl shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #8A1E24 0%, #c41c24 50%, #7c3aed 100%)',
                  animation: 'borderGlow 2s ease-in-out infinite',
                }}
              >
                XZ
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-lg tracking-tight">Digital Roots</p>
                <p className="text-[11px] uppercase tracking-[0.3em] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Bridging Generations
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN PHASE ── full splash content */}
        {phase === 'main' && (
          <div
            className="relative z-10 w-full max-w-4xl mx-auto px-6 flex flex-col items-center gap-8"
            style={{ animation: 'scaleIn 0.5s ease forwards' }}
          >

            {/* Top badge */}
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-semibold"
              style={{
                background: 'rgba(138,30,36,0.12)',
                borderColor: 'rgba(138,30,36,0.3)',
                color: '#f87171',
                animation: 'fadeInDown 0.5s ease 0.1s both',
              }}
            >
              <Star size={11} fill="currentColor" />
              The intergenerational knowledge platform
              <Star size={11} fill="currentColor" />
            </div>

            {/* Hero logo */}
            <div
              className="flex items-center gap-4"
              style={{ animation: 'fadeInDown 0.5s ease 0.2s both' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #8A1E24 0%, #c41c24 50%, #7c3aed 100%)',
                  boxShadow: '0 8px 32px rgba(138,30,36,0.4)',
                }}
              >
                XZ
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-black text-white tracking-tight leading-none">
                  Digital Roots
                </h1>
                <p className="text-sm font-medium mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Where every voice finds its archive
                </p>
              </div>
            </div>

            {/* Tagline */}
            <div
              className="text-center max-w-xl"
              style={{ animation: 'fadeInUp 0.5s ease 0.3s both' }}
            >
              <p className="text-white/70 text-sm leading-relaxed">
                A secure, multilingual platform connecting elders and youth — preserving oral
                histories, sharing knowledge across generations, and building community
                through authentic conversation.
              </p>
            </div>

            {/* Feature pills */}
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              style={{ animation: 'fadeInUp 0.5s ease 0.35s both' }}
            >
              <FeaturePill icon={Mic}     text="Audio Transcription"    delay="0.4s" />
              <FeaturePill icon={Globe}   text="Multilingual Support"   delay="0.45s" />
              <FeaturePill icon={BookOpen} text="Knowledge Archive"     delay="0.5s" />
              <FeaturePill icon={Users}   text="Generational Bridge"    delay="0.55s" />
              <FeaturePill icon={Zap}     text="Real-Time Messaging"    delay="0.6s" />
              <FeaturePill icon={Shield}  text="Secure & Encrypted"     delay="0.65s" />
              <FeaturePill icon={Layers}  text="30+ Content Categories" delay="0.7s" />
            </div>

            {/* Divider */}
            <div
              className="w-px h-8 mx-auto"
              style={{
                background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)',
                animation: 'fadeInUp 0.5s ease 0.75s both',
              }}
            />

            {/* Stats row */}
            <div
              className="flex flex-wrap items-center justify-center gap-3"
              style={{ animation: 'fadeInUp 0.5s ease 0.8s both' }}
            >
              <StatCard icon={BookOpen} value="∞" label="Stories"   delay="0.85s" />
              <StatCard icon={Globe}   value="50+"  label="Languages" delay="0.9s" />
              <StatCard icon={Users}   value="3"    label="Roles"     delay="0.95s" />
              <StatCard icon={Play}    value="HD"   label="Media"     delay="1.0s" />
            </div>

            {/* CTA */}
            <div
              className="flex flex-col items-center gap-3 mt-2"
              style={{ animation: 'fadeInUp 0.5s ease 1.05s both' }}
            >
              <button
                onClick={handleEnter}
                className="group flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-sm transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #8A1E24 0%, #c41c24 60%, #7c3aed 100%)',
                  boxShadow: '0 12px 40px rgba(138,30,36,0.45)',
                }}
              >
                Enter Digital Roots
                <ChevronRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </button>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Secure · Private · Multilingual
              </p>
            </div>

            {/* Bottom credit line */}
            <p
              className="text-[10px] mt-2"
              style={{
                color: 'rgba(255,255,255,0.15)',
                animation: 'fadeInUp 0.5s ease 1.2s both',
              }}
            >
              XZ Digital Roots · Built for communities, powered by AI
            </p>
          </div>
        )}
      </div>
    </>
  );
}
