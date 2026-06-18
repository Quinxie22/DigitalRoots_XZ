import { useState, useEffect } from 'react';
import { Users, Award, Sparkles, Check, X, Loader, ShieldAlert, ArrowRight, MessageSquare, BookOpen } from 'lucide-react';
import type { User } from '../types';
import InterviewManager from './InterviewManager';
import { resolveMediaUrl } from '../api';

interface MentoringHubProps {
  currentUser: User;
  token: string;
  onStartChat?: (otherUserId: string) => void;
  onViewProfile?: (userId: string) => void;
}

const SESSION_SERVICE_URL = import.meta.env.VITE_SESSION_SERVICE_URL || 'http://localhost:3008';

export default function MentoringHub({ currentUser, token, onStartChat, onViewProfile }: MentoringHubProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [pairs, setPairs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'matches' | 'pairings' | 'interviews'>('matches');

  // Request proposal form state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [pairingType, setPairingType] = useState<'cultural' | 'digital'>('cultural');
  const [skillFocus, setSkillFocus] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const isCurrentElder = currentUser.role === 'Elder' || currentUser.role === 'Arthur' || currentUser.role === 'Sarah' || currentUser.role === 'Tessa';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch matches
      const matchesRes = await fetch(`${SESSION_SERVICE_URL}/api/sessions/mentoring/matches?userId=${currentUser.id}&role=${currentUser.role}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData.matches || []);
      } else {
        throw new Error('Failed to load mentorship recommendations');
      }

      // 2. Fetch active/pending pairings
      const pairsRes = await fetch(`${SESSION_SERVICE_URL}/api/sessions/mentoring/pairs?userId=${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (pairsRes.ok) {
        const pairsData = await pairsRes.json();
        setPairs(pairsData.pairs || []);
      } else {
        throw new Error('Failed to load active pairings');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Connecting to session service failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, token]);

  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !skillFocus.trim()) return;

    setSendingRequest(true);
    setError('');

    // If current user is Elder, they are the mentor, matched user is mentee
    // If current user is Youth, they are the mentee, matched user is mentor
    const mentorId = isCurrentElder ? currentUser.id : selectedUser.id;
    const mentorName = isCurrentElder ? currentUser.name : selectedUser.name;
    const menteeId = isCurrentElder ? selectedUser.id : currentUser.id;
    const menteeName = isCurrentElder ? selectedUser.name : currentUser.name;

    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/mentoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          mentorId,
          mentorName,
          menteeId,
          menteeName,
          pairingType,
          skillFocus,
          requestedById: currentUser.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit pairing request');
      }

      // Refresh pairs
      await fetchData();
      setSelectedUser(null);
      setSkillFocus('');
      setActiveTab('pairings');
    } catch (err: any) {
      setError(err.message || 'Error submitting mentoring request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAcceptPairing = async (pairingId: string) => {
    setError('');
    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/mentoring/${pairingId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to accept pairing');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error accepting pairing.');
    }
  };

  const handleCancelPairing = async (pairingId: string) => {
    if (!window.confirm('Are you sure you want to cancel or end this mentorship connection?')) return;
    setError('');
    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/mentoring/${pairingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to cancel pairing');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error cancelling pairing connection.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col bg-[var(--bg-dark)] h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold font-serif text-stone-850 dark:text-white flex items-center gap-2">
            <Users style={{ color: 'var(--primary)' }} />
            Intergenerational Mentoring Hub
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Build meaningful mentorship pairings to transfer ancestral knowledge and digital skills.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b pb-3 mb-6" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('matches')}
          className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 hover:scale-105 cursor-pointer ${
            activeTab === 'matches'
              ? 'text-red-500 font-extrabold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
          style={{ borderBottomColor: activeTab === 'matches' ? 'var(--primary)' : 'transparent', color: activeTab === 'matches' ? 'var(--primary)' : undefined }}
        >
          Matched {isCurrentElder ? 'Mentees (Youth)' : 'Mentors (Elders)'}
        </button>
        <button
          onClick={() => setActiveTab('pairings')}
          className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 relative hover:scale-105 cursor-pointer ${
            activeTab === 'pairings'
              ? 'text-red-500 font-extrabold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
          style={{ borderBottomColor: activeTab === 'pairings' ? 'var(--primary)' : 'transparent', color: activeTab === 'pairings' ? 'var(--primary)' : undefined }}
        >
          My Pairings
          {pairs.filter(p => p.status === 'requested' && ((isCurrentElder && p.mentorId === currentUser.id) || (!isCurrentElder && p.menteeId === currentUser.id))).length > 0 && (
            <span className="absolute -top-1.5 -right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" style={{ backgroundColor: 'var(--primary)' }} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('interviews')}
          className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 hover:scale-105 cursor-pointer ${
            activeTab === 'interviews'
              ? 'text-red-500 font-extrabold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
          style={{ borderBottomColor: activeTab === 'interviews' ? 'var(--primary)' : 'transparent', color: activeTab === 'interviews' ? 'var(--primary)' : undefined }}
        >
          Oral History Sessions
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-2">
          <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          <span className="text-xs">Finding matches and pairings...</span>
        </div>
      ) : (
        <>
          {activeTab === 'matches' && (
            <div className="flex-1">
              {matches.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs border rounded-3xl p-6" style={{ borderColor: 'var(--border)' }}>
                  No complementary matches found. Try expanding your profile preferences or spoken languages.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {matches.map(({ user, score, sharedInterests }) => {
                    const avatarValue = user.avatar || '';
                    const isImage = typeof avatarValue === 'string' && (avatarValue.startsWith('http') || avatarValue.startsWith('/') || avatarValue.includes('.'));
                    const initials = (user.initials || (user.name || '').slice(0, 2)).toUpperCase();
                    const isAlreadyPaired = pairs.some(p => 
                      p.status !== 'completed' && 
                      ((p.mentorId === currentUser.id && p.menteeId === user.id) || 
                       (p.menteeId === currentUser.id && p.mentorId === user.id))
                    );
                    return (
                       <div
                        key={user.id}
                        className="bg-[var(--bg-card)] border rounded-3xl p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all flex flex-col justify-between"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-stone-850 to-stone-900 flex items-center justify-center font-bold text-white border text-sm cursor-pointer hover:scale-105 transition-transform overflow-hidden" 
                                style={{ borderColor: 'var(--border)' }}
                                onClick={() => onViewProfile?.(user.id)}
                              >
                                {isImage ? (
                                  <img src={resolveMediaUrl(avatarValue)} alt={user.name} className="w-full h-full object-cover" />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div>
                                <h4 
                                  className="font-bold text-sm text-stone-850 dark:text-white cursor-pointer hover:underline"
                                  onClick={() => onViewProfile?.(user.id)}
                                >
                                  {user.name}
                                </h4>
                                <p className="text-[10px] text-stone-400 capitalize">{user.role} • {user.community || 'General'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-extrabold uppercase">
                              <Sparkles size={11} />
                              <span>{score}% Match</span>
                            </div>
                          </div>

                          <p className="text-xs text-stone-400 leading-relaxed mb-4 italic">
                            "{user.bio || 'No bio provided.'}"
                          </p>                           <div className="flex flex-wrap gap-1.5 mb-4">
                            {user.languages?.map((l: string) => (
                              <span key={l} className="text-[9px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] border font-semibold hover:scale-105 cursor-pointer transition-all" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                                {l}
                              </span>
                            ))}
                          </div>

                          {sharedInterests && sharedInterests.length > 0 && (
                            <div className="mb-4">
                              <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-400 block mb-1">Shared Interests</span>
                              <div className="flex flex-wrap gap-1.5">
                                {sharedInterests.map((interest: string) => (
                                  <span key={interest} className="text-[9px] px-2.5 py-0.5 rounded border font-bold uppercase tracking-wider hover:scale-105 cursor-pointer transition-all" style={{ background: 'rgba(138, 30, 36, 0.08)', borderColor: 'rgba(138, 30, 36, 0.15)', color: 'var(--primary)' }}>
                                    {interest}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                          {onStartChat && user.role !== 'Admin' && (
                            <button
                              onClick={() => onStartChat(user.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.01] cursor-pointer"
                              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                            >
                              <MessageSquare size={13} />
                              Chat
                            </button>
                          )}
                          {isAlreadyPaired ? (
                            <span className="flex-1 text-center text-xs font-semibold py-2.5 text-stone-500 bg-[var(--bg-elevated)] border rounded-xl" style={{ borderColor: 'var(--border)' }}>
                              Pending / Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold hover:scale-[1.01] transition-transform cursor-pointer"
                              style={{ background: 'var(--primary)' }}
                            >
                              Connect
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pairings' && (
            <div className="flex-1 space-y-4">
              {pairs.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs border rounded-3xl p-6" style={{ borderColor: 'var(--border)' }}>
                  You do not have any active or requested mentoring pairings.
                </div>
              ) : (
                <div className="space-y-4">
                  {pairs.map(pair => {
                    const isMentor = pair.mentorId === currentUser.id;
                    const partnerId = isMentor ? pair.menteeId : pair.mentorId;
                    const partnerName = (isMentor ? pair.menteeName : pair.mentorName) || 'Unknown Partner';
                    const partnerRole = isMentor ? 'Youth Mentee' : 'Elder Mentor';
                    const isPendingAction = pair.status === 'requested' && pair.requestedById !== currentUser.id;

                    const usersJson = sessionStorage.getItem('users_list');
                    const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
                    const foundPartner = dynamicUsers.find((u) => u.id === partnerId || u._id === partnerId);
                    
                    const avatarValue = foundPartner ? foundPartner.avatar : '';
                    const isImage = typeof avatarValue === 'string' && (avatarValue.startsWith('http') || avatarValue.startsWith('/') || avatarValue.includes('.'));
                    const isPartnerAdmin = foundPartner?.role === 'Admin';

                    return (
                      <div
                        key={pair.pairingId}
                        className="bg-[var(--bg-card)] border rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-stone-850 to-stone-900 border border-stone-800 flex items-center justify-center text-xs font-bold text-stone-400 cursor-pointer hover:scale-105 transition-transform overflow-hidden"
                            onClick={() => onViewProfile?.(partnerId)}
                          >
                            {isImage ? (
                              <img src={resolveMediaUrl(avatarValue)} alt={partnerName} className="w-full h-full object-cover" />
                            ) : (
                              partnerName.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 
                                className="font-bold text-sm text-stone-850 dark:text-white cursor-pointer hover:underline"
                                onClick={() => onViewProfile?.(isMentor ? pair.menteeId : pair.mentorId)}
                              >
                                {partnerName}
                              </h4>
                              <span className="text-[10px] text-stone-400 capitalize bg-[var(--bg-elevated)] px-2 py-0.5 rounded border border-stone-800">
                                {partnerRole}
                              </span>
                            </div>
                            <p className="text-xs text-stone-450 mt-1">
                              Focus: <strong className="text-stone-300 capitalize">{pair.pairingType} pairing</strong> — "{pair.skillFocus}"
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {pair.status === 'requested' ? (
                            isPendingAction ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcceptPairing(pair.pairingId)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Check size={13} />
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleCancelPairing(pair.pairingId)}
                                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-red-500/20 cursor-pointer"
                                >
                                  <X size={13} />
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full font-bold">
                                  Pending Partner Approval
                                </span>
                                <button
                                  onClick={() => handleCancelPairing(pair.pairingId)}
                                  className="p-2 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-500 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                  title="Cancel Request"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full font-bold flex items-center gap-1">
                                <Award size={12} />
                                Active Partnership
                              </span>
                              {onStartChat && !isPartnerAdmin && (
                                <button
                                  onClick={() => onStartChat(isMentor ? pair.menteeId : pair.mentorId)}
                                  className="p-2 border rounded-xl hover:bg-[var(--bg-elevated)] text-stone-300 transition-colors cursor-pointer flex items-center justify-center"
                                  style={{ borderColor: 'var(--border)' }}
                                  title="Chat with partner"
                                >
                                  <MessageSquare size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleCancelPairing(pair.pairingId)}
                                className="p-2 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-500 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                                title="End Partnership"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'interviews' && (
            <div className="flex-1">
              <InterviewManager currentUser={currentUser} token={token} />
            </div>
          )}
        </>
      )}

      {/* Propose pairing Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-[var(--bg-card)] border rounded-3xl p-6 max-w-md w-full shadow-xl relative" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-bold font-serif text-stone-850 dark:text-white mb-2">
              Propose Mentorship Pairing
            </h3>
            <p className="text-xs text-stone-400 mb-6">
              Establish a connection with <strong className="text-stone-300">{selectedUser.name}</strong>.
            </p>

            <form onSubmit={handleRequestPairing} className="space-y-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Pairing Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPairingType('cultural')}
                    className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                      pairingType === 'cultural' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-400'
                    }`}
                    style={{ borderColor: pairingType === 'cultural' ? 'var(--primary)' : 'var(--border)' }}
                  >
                    Cultural Heritage
                  </button>
                  <button
                    type="button"
                    onClick={() => setPairingType('digital')}
                    className={`flex-1 py-3 rounded-xl border text-xs font-bold transition-all ${
                      pairingType === 'digital' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-stone-400'
                    }`}
                    style={{ borderColor: pairingType === 'digital' ? 'var(--primary)' : 'var(--border)' }}
                  >
                    Digital Literacy
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Skill / Knowledge Focus</label>
                <textarea
                  value={skillFocus}
                  onChange={(e) => setSkillFocus(e.target.value)}
                  required
                  rows={3}
                  placeholder={
                    pairingType === 'cultural'
                      ? 'Describe what cultural traditions, local folklore, or regional dialects you want to learn or teach...'
                      : 'Describe what digital tasks (e.g. video creation, online research, microservice config) you want to learn or teach...'
                  }
                  className="px-4 py-3 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <button
                type="submit"
                disabled={sendingRequest}
                className="w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
                style={{ background: 'var(--primary)' }}
              >
                {sendingRequest ? (
                  <>
                    <Loader className="animate-spin" size={14} />
                    <span>Sending Proposal...</span>
                  </>
                ) : (
                  <span>Send Proposal</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
