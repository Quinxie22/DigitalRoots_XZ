import React, { useState, useRef, lazy, Suspense } from 'react';
import type { User } from '../types';
import { Loader, User as UserIcon, ShieldAlert, Check, Lock, Camera, Sun, Moon, Globe, Eye, EyeOff, Trash2 } from 'lucide-react';
import { uploadGenericFile, resolveMediaUrl } from '../api';
import { useTranslation } from 'react-i18next';

const CustomDialog = lazy(() => import('./CustomDialog'));

interface SettingsViewProps {
  currentUser: User;
  onProfileUpdate: (updatedUser: User) => void;
  onLogout?: () => void;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
  onNavigate?: (tab: any) => void;
}

const CATEGORIES = [
  'Cultural', 'Traditional', 'History', 'Educational', 'Tech',
  'Career', 'Business', 'Finance', 'Health', 'Sports',
  'Travel', 'Music', 'Arts', 'Community', 'Environment'
];

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

export default function SettingsView({ 
  currentUser, 
  onProfileUpdate, 
  onLogout,
  darkMode,
  setDarkMode,
  onNavigate
}: SettingsViewProps) {
  const { t, i18n } = useTranslation();
  // Profile form states
  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [community, setCommunity] = useState(currentUser.community || '');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(currentUser.languages || ['English']);
  const [selectedCats, setSelectedCats] = useState<string[]>(currentUser.contentPreferences || []);
  const [avatar, setAvatar] = useState(currentUser.avatar || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.dateOfBirth ? new Date(currentUser.dateOfBirth).toISOString().split('T')[0] : '');
  const [role, setRole] = useState(currentUser.role || 'Youth');

  const [deletingAccount, setDeletingAccount] = useState(false);

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

  const executeDeleteAccount = async () => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
    setDeletingAccount(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const targetId = currentUser.id || (currentUser as any)._id || '';
      const res = await fetch(`${USER_SERVICE_URL}/api/users/${targetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete account');
      
      setDialogConfig({
        isOpen: true,
        type: 'success',
        title: 'Account Deleted',
        message: 'Your account and all associated data have been permanently deleted.',
        confirmLabel: 'Goodbye',
        onConfirm: () => {
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
          if (onLogout) onLogout();
        }
      });
    } catch (err: any) {
      setError(err.message || 'Error deleting account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    setDialogConfig({
      isOpen: true,
      type: 'warning',
      title: 'Delete Account?',
      message: 'WARNING: This will permanently delete your account and all associated data (posts, chats, mentoring pairings, and rewards). This action is IRREVERSIBLE. Are you absolutely sure?',
      confirmLabel: 'Delete My Account',
      cancelLabel: 'Cancel',
      onConfirm: executeDeleteAccount,
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
    });
  };
  
  // Password change states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // UI states
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [error, setError] = useState('');

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const result = await uploadGenericFile(token, file);
      setAvatar(result.url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const AVATAR_OPTIONS = [
    { id: '1', name: 'Arthur', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Arthur' },
    { id: '2', name: 'Sarah', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah' },
    { id: '3', name: 'Tessa', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tessa' },
    { id: '4', name: 'Felix', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix' },
    { id: '5', name: 'Lydia', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lydia' },
    { id: '6', name: 'Bastian', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Bastian' }
  ];

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLangs.length === 0) {
      setError('Please select at least one language.');
      return;
    }
    if (selectedCats.length === 0) {
      setError('Please select at least one interest.');
      return;
    }

    if (dateOfBirth) {
      const calculatedAge = calculateAge(dateOfBirth);
      if (calculatedAge < 15 || calculatedAge > 250) {
        setDialogConfig({
          isOpen: true,
          type: 'error',
          title: 'Age Validation Failed',
          message: 'Age validation failed: Users must be between 15 and 250 years old to update their profile. If you believe this is an error, please contact support with your justification.',
          confirmLabel: 'OK',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    setSavingProfile(true);
    setError('');
    setProfileSuccess('');

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const res = await fetch(`${USER_SERVICE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          bio,
          community,
          languages: selectedLangs,
          contentPreferences: selectedCats,
          avatar,
          dateOfBirth: dateOfBirth || undefined,
          role
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      onProfileUpdate(data.user);
      setProfileSuccess('Profile details saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Error saving profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    setError('');
    setPasswordSuccess('');

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const res = await fetch(`${USER_SERVICE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password');
      }

      setPasswordSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Error changing password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-dark)]">
      
      {/* Header */}
      <header className="h-16 flex-shrink-0 flex items-center px-8 border-b"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h2 className="text-lg font-bold font-serif">{t('settings')}</h2>
      </header>

      {/* Main Form container */}
      <div className="flex-grow overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full space-y-8 pb-24">
        
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Menu Info/Help text column */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-105/10 text-red-500" style={{ color: 'var(--primary)' }}>
                <UserIcon size={16} />
              </div>
              <h3 className="font-serif font-bold text-sm">{t('profileDetails')}</h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {t('profileDetailsDesc')}
            </p>
          </div>

          {/* Form edit column */}
          <div className="md:col-span-2 bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm space-y-6" style={{ borderColor: 'var(--border)' }}>
            
            {profileSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-emerald-500 flex items-center gap-2">
                <Check size={14} />
                <span>{profileSuccess === 'Profile details saved successfully!' ? t('profileSuccess') : profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              
              {/* Profile Picture / Avatar selector */}
              <div className="flex flex-col gap-3 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">Profile Picture / Avatar</label>
                <div className="flex items-center gap-4">
                  {/* Current Avatar Preview */}
                  {avatar && (avatar.startsWith('http') || avatar.startsWith('/') || avatar.includes('.')) ? (
                    <img 
                      src={resolveMediaUrl(avatar)} 
                      alt="Avatar Preview" 
                      className="w-16 h-16 rounded-2xl object-cover border bg-[var(--bg-elevated)]"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-lg text-white bg-gradient-to-br from-red-700 to-red-900 shadow-md">
                      {avatar || name.slice(0, 2).toUpperCase() || '??'}
                    </div>
                  )}
                  
                  {/* Upload & URL section */}
                  <div className="flex-1 space-y-2">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handlePhotoFileChange}
                    />
                    {/* Upload button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all hover:scale-[1.01] active:scale-95 cursor-pointer disabled:opacity-50"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(138,30,36,0.06)' }}
                    >
                      {uploadingPhoto ? (
                        <><Loader size={13} className="animate-spin" /><span>Uploading...</span></>
                      ) : (
                        <><Camera size={13} /><span>Upload Photo</span></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Predefined selection grid */}
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAvatar(opt.url)}
                      className={`relative rounded-xl overflow-hidden border p-1 bg-white hover:scale-105 active:scale-95 transition-all ${
                        avatar === opt.url ? 'border-red-500 border-2' : 'border-stone-850'
                      }`}
                      style={{ borderColor: avatar === opt.url ? 'var(--primary)' : undefined }}
                    >
                      <img src={opt.url} alt={opt.name} className="w-full h-auto" />
                      <span className="absolute bottom-0 inset-x-0 text-[7px] text-center bg-black/60 text-white truncate py-0.5">{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('fullName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your display name..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-800 dark:text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('shortBio')}</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  required
                  placeholder="Tell others about yourself..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none text-stone-800 dark:text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('communityOrigin')}</label>
                <input
                  type="text"
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  required
                  placeholder="e.g. Sawa community, Coastal origin..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-800 dark:text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              {/* DOB & Role Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDateOfBirth(val);
                      if (val) {
                        const calculatedAge = calculateAge(val);
                        setRole(calculatedAge >= 40 ? 'Elder' : 'Youth');
                      }
                    }}
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-800 dark:text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">Calculated Age & Role</label>
                  <input
                    type="text"
                    value={dateOfBirth ? `${calculateAge(dateOfBirth)} years old (${role === 'Elder' ? t('senior', 'Elder') : role === 'Youth' ? t('youth', 'Youth') : role})` : 'Select DOB...'}
                    readOnly
                    disabled
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-600 dark:text-stone-400 cursor-not-allowed opacity-75"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>
              </div>

              {/* Language toggler */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('languagesSpoken')}</label>
                <div className="flex gap-3 mt-1">
                  {['English', 'French'].map(lang => {
                    const isSelected = selectedLangs.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          isSelected ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-600 dark:text-stone-400'
                        }`}
                        style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border)' }}
                      >
                        {isSelected && <Check size={14} />}
                        {lang === 'English' ? t('english') : t('french')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interests Preferences list */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('interestsPreferences')}</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORIES.map(cat => {
                    const isSelected = selectedCats.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                          isSelected ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' : 'bg-transparent text-stone-600 dark:text-stone-400'
                        }`}
                        style={{ borderColor: isSelected ? 'var(--primary)' : 'var(--border)' }}
                      >
                        {t('cat_' + cat, cat)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-red-950/20 flex items-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingProfile ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      <span>{t('savingProfile')}</span>
                    </>
                  ) : (
                    <span>{t('saveChanges')}</span>
                  )}
                </button>
              </div>

            </form>

          </div>

        </div>

        {/* Separator line */}
        <hr className="opacity-10" style={{ borderColor: 'var(--border)' }} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Password help description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500">
                <Lock size={16} />
              </div>
              <h3 className="font-serif font-bold text-sm">{t('security')}</h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {t('securityDesc')}
            </p>
          </div>

          {/* Password change form */}
          <div className="md:col-span-2 bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm space-y-6" style={{ borderColor: 'var(--border)' }}>
            
            {passwordSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-emerald-500 flex items-center gap-2">
                <Check size={14} />
                <span>{passwordSuccess === 'Password changed successfully!' ? t('passwordSuccess') : passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('newPassword')}</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-4 pr-10 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-800 dark:text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-300 focus:outline-none cursor-pointer flex items-center justify-center"
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">{t('confirmNewPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-4 pr-10 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-stone-800 dark:text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-300 focus:outline-none cursor-pointer flex items-center justify-center"
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword || !newPassword.trim()}
                  className="px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-red-950/20 flex items-center gap-2 hover:scale-[1.01] transition-transform cursor-pointer disabled:opacity-40 disabled:scale-100"
                  style={{ background: 'var(--primary)' }}
                >
                  {savingPassword ? (
                    <>
                      <Loader className="animate-spin" size={14} />
                      <span>{t('updatingPassword')}</span>
                    </>
                  ) : (
                    <span>{t('changePassword')}</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>

        {/* Separator line */}
        <hr className="opacity-10" style={{ borderColor: 'var(--border)' }} />

        {/* Theme Settings Section */}
        {setDarkMode && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in md:hidden">
              
              {/* Theme Settings help description */}
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500">
                    {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <h3 className="font-serif font-bold text-sm">{t('themePreferences')}</h3>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  {t('themePreferencesDesc')}
                </p>
              </div>

              {/* Theme switcher control card */}
              <div className="md:col-span-2 bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-left">
                    <h4 className="text-xs font-bold text-stone-800 dark:text-white">{t('darkTheme')}</h4>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">
                      Enable a darker interface to reduce eye strain in low-light environments.
                    </p>
                  </div>
                  
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      darkMode ? 'bg-red-500' : 'bg-stone-300 dark:bg-stone-800'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        darkMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Separator line */}
            <hr className="opacity-10 md:hidden" style={{ borderColor: 'var(--border)' }} />
          </>
        )}

        {/* Danger Zone: Account Deletion */}
        <div className="bg-red-500/5 rounded-2xl border border-red-500/20 p-5 flex flex-col gap-3 text-left">
          <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
            <Trash2 size={16} />
            <h4>Danger Zone</h4>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Permanently delete your profile and wipe all related documents including stories, posts, private messages, pairing requests, and rewards. This action cannot be undone.
          </p>
          <div className="mt-1">
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {deletingAccount ? (
                <>
                  <Loader className="animate-spin" size={13} />
                  <span>Deleting Account...</span>
                </>
              ) : (
                <span>Delete Account</span>
              )}
            </button>
          </div>
        </div>

        {/* UI Language Selection Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
          
          {/* UI Language help description */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
                <Globe size={16} />
              </div>
              <h3 className="font-serif font-bold text-sm">{t('uiLanguage')}</h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {t('uiLanguageDesc')}
            </p>
          </div>

          {/* UI Language select dropdown or buttons */}
          <div className="md:col-span-2 bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  i18n.changeLanguage('en');
                  localStorage.setItem('ui-language', 'en');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  i18n.language === 'en' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-600 dark:text-stone-400'
                }`}
                style={{ borderColor: i18n.language === 'en' ? 'var(--primary)' : 'var(--border)' }}
              >
                {i18n.language === 'en' && <Check size={14} />}
                {t('english')}
              </button>
              <button
                type="button"
                onClick={() => {
                  i18n.changeLanguage('fr');
                  localStorage.setItem('ui-language', 'fr');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  i18n.language === 'fr' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-600 dark:text-stone-400'
                }`}
                style={{ borderColor: i18n.language === 'fr' ? 'var(--primary)' : 'var(--border)' }}
              >
                {i18n.language === 'fr' && <Check size={14} />}
                {t('french')}
              </button>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <hr className="opacity-10" style={{ borderColor: 'var(--border)' }} />

        {currentUser.role === 'Admin' && onNavigate && (
          <div className="pt-4 md:hidden">
            <button
              onClick={() => onNavigate('admin')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-xs font-bold rounded-2xl text-white transition-colors shadow-md cursor-pointer"
              style={{ background: 'var(--primary)' }}
            >
              <ShieldAlert size={16} />
              Open Admin Console
            </button>
          </div>
        )}

        {onLogout && (
          <div className="pt-4 md:hidden">
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 text-xs font-bold rounded-2xl text-white bg-red-600 hover:bg-red-500 transition-colors shadow-md cursor-pointer"
            >
              {t('logOut')}
            </button>
          </div>
        )}

        <Suspense fallback={null}>
          <CustomDialog
            isOpen={dialogConfig.isOpen}
            type={dialogConfig.type}
            title={dialogConfig.title}
            message={dialogConfig.message}
            confirmLabel={dialogConfig.confirmLabel}
            cancelLabel={dialogConfig.cancelLabel}
            onConfirm={dialogConfig.onConfirm}
            onCancel={dialogConfig.onCancel}
          />
        </Suspense>

      </div>

    </div>
  );
}
