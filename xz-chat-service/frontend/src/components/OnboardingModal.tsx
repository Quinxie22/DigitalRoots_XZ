import { useState } from 'react';
import type { User } from '../types';
import { Loader, Globe, Check } from 'lucide-react';

interface OnboardingModalProps {
  currentUser: User;
  token: string;
  onComplete: (updatedUser: User) => void;
}

const CATEGORIES = [
  'Cultural', 'Educational', 'Technical', 'Traditional',
  'Health', 'Sports', 'Travel', 'Music', 'Arts', 'Tech',
  'Business', 'News', 'Environment'
];

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

export default function OnboardingModal({ currentUser, token, onComplete }: OnboardingModalProps) {
  const [bio, setBio] = useState('');
  const [community, setCommunity] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(['English']);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleLanguage = (lang: string) => {
    setSelectedLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const toggleCategory = (cat: string) => {
    setSelectedCats(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLangs.length === 0) {
      setError('Please select at least one language.');
      return;
    }
    if (selectedCats.length === 0) {
      setError('Please select at least one content category.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`${USER_SERVICE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          bio,
          community,
          languages: selectedLangs,
          contentPreferences: selectedCats
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update preferences');
      }

      onComplete(data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-[var(--bg-card)] border rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[90vh]"
           style={{ borderColor: 'var(--border)' }}>
        
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-red-100 dark:bg-red-950/40 text-red-500 mb-3">
            <Globe size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <h3 className="text-xl font-bold font-serif text-stone-850 dark:text-white">Personalize Your Archive</h3>
          <p className="text-xs text-stone-400 text-center mt-1">Set up your profile and custom preferences before entering</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Short Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              required
              placeholder="e.g. Storyteller sharing regional folklore and history..."
              className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none text-stone-850 dark:text-white"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Cultural Origin / Community</label>
            <input
              type="text"
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
              required
              placeholder="e.g. Sawa community, Coastal origin..."
              className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-850 dark:text-white"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          {/* Languages selection (restricted to English and French) */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Spoken Languages</label>
            <div className="flex gap-3 mt-1">
              {['English', 'French'].map(lang => {
                const isSelected = selectedLangs.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${
                      isSelected ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-400'
                    }`}
                    style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border)' }}
                  >
                    {isSelected && <Check size={14} />}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categories select chips grid */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Interests & Content Preferences</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CATEGORIES.map(cat => {
                const isSelected = selectedCats.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`text-[11px] px-3.5 py-1.5 rounded-full border transition-all ${
                      isSelected ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'bg-transparent text-stone-400'
                    }`}
                    style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border)' }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-xs shadow-md shadow-red-950/20 flex items-center justify-center gap-2 cursor-pointer mt-6"
            style={{ background: 'var(--primary)' }}
          >
            {saving ? (
              <>
                <Loader className="animate-spin" size={14} />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <span>Save & Continue</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
