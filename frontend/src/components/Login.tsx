// ─────────────────────────────────────────────────────────────────────────────
// Login.tsx
// The login / user-selection screen shown before accessing the chat.
//
// HOW IT WORKS:
//   - The app uses Firebase in "Mock Mode" (no real credentials needed).
//   - Users click a persona card (Arthur, Sarah, Tessa, Felix) to log in.
//   - The user's ID (e.g. "user-arthur") is used as the "Firebase token".
//   - The backend accepts any string as a valid user in mock mode and echoes
//     that string back as the firebase_uid for that session.
//   - This allows opening 2 browser tabs to simulate a real 2-user call.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import type { User } from '../types';

const PERSONAS: User[] = [
  {
    id: 'user-arthur',
    name: 'Arthur Miller',
    avatar: 'AM',
    role: 'Arthur',
  },
  {
    id: 'user-sarah',
    name: 'Sarah Chen',
    avatar: 'SC',
    role: 'Sarah',
  },
  {
    id: 'user-tessa',
    name: 'Tessa Elvis',
    avatar: 'TE',
    role: 'Tessa',
  },
  {
    id: 'user-felix',
    name: 'Felix Kamau',
    avatar: 'FK',
    role: 'Felix',
  },
];

const AVATAR_COLORS: Record<string, string> = {
  'user-arthur': 'from-red-700 to-red-900',
  'user-sarah':  'from-purple-700 to-purple-900',
  'user-tessa':  'from-rose-600 to-pink-900',
  'user-felix':  'from-blue-700 to-blue-900',
};

interface LoginProps {
  onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
         style={{ background: 'var(--bg-dark)' }}>

      {/* Decorative background orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full opacity-10 blur-3xl"
           style={{ background: 'radial-gradient(circle, #dc2626, transparent)' }} />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full opacity-10 blur-3xl"
           style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-12 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg"
               style={{ background: 'var(--primary)' }}>
            XZ
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Live Connection
          </span>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Select Your Persona
        </h1>
        <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Open two browser tabs with different personas to test a live call
        </p>
      </div>

      {/* Persona Cards */}
      <div className="grid grid-cols-2 gap-4 px-4 max-w-lg w-full">
        {PERSONAS.map((user, i) => (
          <button
            key={user.id}
            onClick={() => onLogin(user)}
            onMouseEnter={() => setHoverId(user.id)}
            onMouseLeave={() => setHoverId(null)}
            className="relative p-6 rounded-2xl text-left transition-all duration-200 cursor-pointer group"
            style={{
              animation: `fadeIn 0.3s ease ${i * 0.08}s both`,
              background: hoverId === user.id ? 'var(--bg-elevated)' : 'var(--bg-card)',
              border: `1px solid ${hoverId === user.id ? 'var(--primary)' : 'var(--border)'}`,
              transform: hoverId === user.id ? 'translateY(-2px)' : 'none',
              boxShadow: hoverId === user.id ? '0 8px 32px rgba(220,38,38,0.2)' : 'none',
            }}>
            {/* Avatar */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white mb-3 bg-gradient-to-br ${AVATAR_COLORS[user.id]}`}>
              {user.avatar}
            </div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              ID: {user.id}
            </div>

            {/* Hover arrow */}
            {hoverId === user.id && (
              <span className="absolute top-4 right-4 text-xs font-medium"
                    style={{ color: 'var(--primary)' }}>
                Select →
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dev note */}
      <div className="mt-10 px-6 py-3 rounded-xl text-xs text-center max-w-md"
           style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        🔧 <strong style={{ color: 'var(--text-secondary)' }}>Dev Mode:</strong> No Firebase credentials needed. 
        Backend is running in mock mode — any user ID is accepted as valid.
      </div>
    </div>
  );
}
