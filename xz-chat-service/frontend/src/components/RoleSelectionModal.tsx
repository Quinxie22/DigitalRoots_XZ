import { useState } from 'react';
import { Loader } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RoleSelectionModalProps {
  /** Data returned from the backend's needsRoleSelection response */
  pendingUser: {
    firebaseUid: string;
    email: string;
    name: string;
  };
  /** The Firebase ID Token — kept alive so we can re-send it with the chosen role */
  idToken: string;
  onComplete: (user: any, token: string, needsOnboarding: boolean) => void;
  onError: (msg: string) => void;
}

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

export default function RoleSelectionModal({
  pendingUser,
  idToken,
  onComplete,
  onError,
}: RoleSelectionModalProps) {
  const { t } = useTranslation();
  const [age, setAge] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (age === '') return;
    const calculatedRole = Number(age) >= 40 ? 'Elder' : 'Youth';
    setSaving(true);
    try {
      // Re-call firebase-login, this time with the chosen role.
      // The backend will now create the MongoDB profile and issue the JWT.
      const res = await fetch(`${USER_SERVICE_URL}/api/users/firebase-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role: calculatedRole, name: pendingUser.name, age }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create profile');
      onComplete(data.user, data.token, data.needsOnboarding);
    } catch (err: any) {
      onError(err.message || 'Failed to save role. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const roleName = age !== '' ? (Number(age) >= 40 ? t('senior') : t('youth')) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
      <div
        className="bg-[var(--bg-card)] border rounded-3xl p-8 max-w-sm w-full shadow-2xl"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-7">
          {/* XZ Logo mark */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl mb-4 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #8A1E24 0%, #c41c24 50%, #7c3aed 100%)' }}
          >
            XZ
          </div>
          <h3 className="text-xl font-bold font-serif text-stone-850 dark:text-white text-center">
            {t('roleSelectionWelcome')}, {pendingUser.name.split(' ')[0]}!
          </h3>
          <p className="text-xs text-stone-400 text-center mt-2 leading-relaxed">
            {t('roleSelectionDesc')}
          </p>
        </div>

        {/* Age Input */}
        <div className="flex flex-col gap-3 mb-6 text-left">
          <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400 dark:text-stone-500">
            {t('roleSelectionLabel')}
          </label>
          <input
            type="number"
            required
            min="0"
            max="120"
            placeholder={t('roleSelectionPlaceholder')}
            value={age}
            onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
            className="w-full px-4 py-2.5 text-xs rounded-xl outline-none border transition-all bg-[var(--bg-elevated)] text-stone-850 dark:text-white dark:border-stone-800 focus:border-red-500/50"
            style={{ borderColor: 'var(--border)' }}
          />
          {age !== '' && (
            <p className="text-[11px] text-stone-400 mt-2 leading-relaxed">
              {t('roleSelectionCalculated')} <span className="font-bold text-red-500">{Number(age) >= 40 ? t('senior') : t('youth')}</span>.
            </p>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={age === '' || saving}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? (
            <>
              <Loader className="animate-spin" size={15} />
              <span>{t('roleSelectionLoading')}</span>
            </>
          ) : (
            <span>{t('roleSelectionConfirm')} {roleName || '…'}</span>
          )}
        </button>
      </div>
    </div>
  );
}
