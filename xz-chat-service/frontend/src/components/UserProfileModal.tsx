import { X, Globe, MessageSquare, Award } from 'lucide-react';
import { resolveMediaUrl } from '../api';

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onStartChat?: (otherUserId: string) => void;
}

export default function UserProfileModal({ userId, onClose, onStartChat }: UserProfileModalProps) {
  // Load users directory to find profile details
  const usersJson = sessionStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  const user = dynamicUsers.find((u) => u.id === userId || u._id === userId);

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
        <div className="bg-[var(--bg-card)] border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center" style={{ borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400">
            <X size={16} />
          </button>
          <p className="text-xs text-stone-400 py-6">User profile details could not be found.</p>
        </div>
      </div>
    );
  }

  const avatarValue = user.avatar || '';
  const isImage = avatarValue.startsWith('http') || avatarValue.startsWith('/') || avatarValue.includes('.');
  const initials = (user.initials || user.name.slice(0, 2)).toUpperCase();
  const gradients = [
    'from-red-700 to-red-900',
    'from-purple-700 to-purple-900',
    'from-rose-600 to-pink-900',
    'from-blue-700 to-blue-900',
    'from-emerald-700 to-teal-900',
    'from-amber-600 to-orange-800'
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorGradient = gradients[hash % gradients.length];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div 
        className="bg-[var(--bg-card)] border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden" 
        style={{ borderColor: 'var(--border)' }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400 z-10">
          <X size={16} />
        </button>

        {/* Decorative Top Accent */}
        <div className={`absolute top-0 inset-x-0 h-2 bg-gradient-to-r ${colorGradient}`} />

        {/* Header Profile Info */}
        <div className="flex flex-col items-center text-center mt-4">
          {isImage ? (
            <img 
              src={resolveMediaUrl(avatarValue)} 
              alt={user.name} 
              className="w-20 h-20 rounded-3xl object-cover shadow-lg border border-opacity-10 mb-4"
              style={{ borderColor: 'var(--border)' }}
            />
          ) : (
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br shadow-lg mb-4 ${colorGradient}`}>
              {initials}
            </div>
          )}
          <h3 className="text-lg font-bold text-stone-850 dark:text-white">{user.name}</h3>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded bg-red-105/10 text-red-500 border border-red-500/20" style={{ color: 'var(--primary)' }}>
              {user.role || 'Member'}
            </span>
            {user.community && (
              <span className="text-[10px] text-stone-400 border border-stone-800 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)]">
                {user.community}
              </span>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="mt-6 space-y-4">
          <div className="bg-[var(--bg-elevated)] p-4 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">About</span>
            <p className="text-xs leading-relaxed italic text-[var(--text-secondary)]">
              "{user.bio || 'No biography written yet.'}"
            </p>
          </div>

          {/* Spoken Languages */}
          {user.languages && user.languages.length > 0 && (
            <div>
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">Spoken Languages</span>
              <div className="flex flex-wrap gap-1.5">
                {user.languages.map((l: string) => (
                  <span key={l} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border font-semibold flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <Globe size={11} className="text-stone-500" />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preferences/Interests */}
          {user.contentPreferences && user.contentPreferences.length > 0 && (
            <div>
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">Interests</span>
              <div className="flex flex-wrap gap-1.5">
                {user.contentPreferences.map((p: string) => (
                  <span key={p} className="text-[9px] px-2.5 py-0.5 rounded border font-bold uppercase tracking-wider hover:scale-105 transition-transform cursor-pointer" style={{ background: 'rgba(138, 30, 36, 0.08)', borderColor: 'rgba(138, 30, 36, 0.15)', color: 'var(--primary)' }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Badges / Credits */}
          {((user.legacyCredits && user.legacyCredits > 0) || (user.badges && user.badges.length > 0)) && (
            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex justify-between items-center text-xs">
                {user.badges && user.badges.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Award size={14} className="text-amber-500" />
                    <span className="font-medium text-[var(--text-secondary)]">{user.badges.length} badges earned</span>
                  </div>
                )}
                {user.legacyCredits !== undefined && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {user.legacyCredits} legacy credits
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Button – hidden for Admin profiles */}
        {onStartChat && user.role !== 'Admin' && (
          <button
            onClick={() => {
              onStartChat(user._id || user.id);
              onClose();
            }}
            className="w-full mt-6 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] transition-transform"
            style={{ background: 'var(--primary)' }}
          >
            <MessageSquare size={13} />
            Send Private Message
          </button>
        )}
      </div>
    </div>
  );
}
