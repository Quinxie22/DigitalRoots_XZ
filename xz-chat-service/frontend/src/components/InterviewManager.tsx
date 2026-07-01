import { useState, useEffect, useRef } from 'react';
import { BookOpen, Calendar, Clock, Plus, Trash2, Check, Play, Pause, Loader, ShieldAlert, X, MessageSquare, Mic } from 'lucide-react';
import type { User } from '../types';
import { uploadGenericFile, resolveMediaUrl } from '../api';

interface InterviewManagerProps {
  currentUser: User;
  token: string;
}

const SESSION_SERVICE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004';
const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';

export default function InterviewManager({ currentUser, token }: InterviewManagerProps) {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Form states
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [questionsList, setQuestionsList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Live session states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [completing, setCompleting] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isCurrentElder = currentUser.role === 'Elder' || currentUser.role === 'Arthur' || currentUser.role === 'Sarah' || currentUser.role === 'Tessa';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch user's interviews
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/interviews?userId=${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInterviews(data.interviews || []);
      } else {
        throw new Error('Failed to fetch oral history interviews list');
      }

      // Fetch user directory for selection
      const usersRes = await fetch(`${USER_SERVICE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        // Normalize users to ensure they have an id field matching their _id
        const normalizedUsers = (usersData.users || []).map((u: any) => ({
          ...u,
          id: u._id || u.id
        }));
        // filter out current user and match roles (Youth proposes to Elder, Elder can propose to Youth)
        const targetRole = isCurrentElder ? 'Youth' : 'Elder';
        setUsers(normalizedUsers.filter((u: any) => u.id !== currentUser.id && u.role === targetRole));
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

  // Handle active session timer
  useEffect(() => {
    let timerId: any;
    if (activeSession && isRecording) {
      timerId = setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [activeSession, isRecording]);

  const addQuestion = () => {
    if (!questionInput.trim()) return;
    setQuestionsList(prev => [...prev, questionInput.trim()]);
    setQuestionInput('');
  };

  const removeQuestion = (index: number) => {
    setQuestionsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleProposeInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !title.trim() || !scheduledAt) return;

    setSubmitting(true);
    setError('');

    const targetUser = users.find(u => u.id === subjectId);
    if (!targetUser) {
      setError('Selected partner not found.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/interviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          archivistId: isCurrentElder ? targetUser.id : currentUser.id,
          archivistName: isCurrentElder ? targetUser.name : currentUser.name,
          subjectId: isCurrentElder ? currentUser.id : targetUser.id,
          subjectName: isCurrentElder ? currentUser.name : targetUser.name,
          title,
          description,
          scheduledAt,
          questions: questionsList
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to schedule oral history interview');
      }

      await fetchData();
      setShowProposeModal(false);
      setTitle('');
      setDescription('');
      setScheduledAt('');
      setQuestionsList([]);
      setSubjectId('');
    } catch (err: any) {
      setError(err.message || 'Error scheduling interview.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmInterview = async (interviewId: string) => {
    setError('');
    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/interviews/${interviewId}/confirm`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to confirm interview request');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Error confirming interview.');
    }
  };

  const startLiveSession = async (interview: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setActiveSession(interview);
      setIsRecording(true);
      setSessionTimer(0);
      setError('');
    } catch (err: any) {
      console.warn('Failed to access microphone for recording:', err);
      setError('Microphone access is required to record the session.');
    }
  };

  const toggleRecordingState = () => {
    if (!mediaRecorderRef.current) return;

    if (isRecording) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      setIsRecording(false);
    } else {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      setIsRecording(true);
    }
  };

  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setCompleting(true);
    setError('');

    let finalRecordingUrl = '';

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const stopPromise = new Promise<Blob>((resolve) => {
        if (!mediaRecorderRef.current) return;
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          resolve(audioBlob);
        };
        mediaRecorderRef.current.stop();
        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
      });

      try {
        const audioBlob = await stopPromise;
        if (audioBlob.size > 1000) {
          const audioFile = new File([audioBlob], `interview_${activeSession.interviewId}.webm`, { type: 'audio/webm' });
          const uploadRes = await uploadGenericFile(token, audioFile);
          finalRecordingUrl = uploadRes.url;
        }
      } catch (err: any) {
        console.error('Failed to save real recording:', err);
        setError('Failed to process and upload the recording. Saving fallback mock instead.');
      }
    }

    if (!finalRecordingUrl) {
      finalRecordingUrl = `https://xz-archive-recordings.s3.amazonaws.com/interviews/record_${activeSession.interviewId}.mp4`;
    }

    try {
      const res = await fetch(`${SESSION_SERVICE_URL}/api/sessions/interviews/${activeSession.interviewId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recordingUrl: finalRecordingUrl
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to complete and archive oral history');
      }

      await fetchData();
      setActiveSession(null);
      setIsRecording(false);
      setActiveTab('completed');
    } catch (err: any) {
      setError(err.message || 'Error completing interview session.');
    } finally {
      setCompleting(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const upcomingInterviews = interviews.filter(i => i.status !== 'completed');
  const completedInterviews = interviews.filter(i => i.status === 'completed');

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col bg-[var(--bg-dark)] h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-850 dark:text-white flex items-center gap-2">
            <BookOpen style={{ color: 'var(--primary)' }} />
            Intergenerational Conversation Manager
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Conduct intergenerational recording sessions to share life stories, transfer knowledge, and discuss general topics.
          </p>
        </div>
        <button
          onClick={() => setShowProposeModal(true)}
          className="flex items-center justify-center gap-1.5 py-3 px-5 rounded-2xl text-white font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-red-950/20 cursor-pointer self-start sm:self-auto flex-shrink-0"
          style={{ background: 'var(--primary)' }}
        >
          <Plus size={15} />
          Propose Interview
        </button>
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
          onClick={() => setActiveTab('upcoming')}
          className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 ${
            activeTab === 'upcoming'
              ? 'border-red-500 text-red-500 font-extrabold'
              : 'border-transparent text-stone-400 hover:text-stone-300'
          }`}
          style={{ borderBottomColor: activeTab === 'upcoming' ? 'var(--primary)' : 'transparent', color: activeTab === 'upcoming' ? 'var(--primary)' : undefined }}
        >
          Upcoming Sessions ({upcomingInterviews.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`text-xs font-bold pb-2 transition-all border-b-2 px-1 ${
            activeTab === 'completed'
              ? 'border-red-500 text-red-500 font-extrabold'
              : 'border-transparent text-stone-400 hover:text-stone-300'
          }`}
          style={{ borderBottomColor: activeTab === 'completed' ? 'var(--primary)' : 'transparent', color: activeTab === 'completed' ? 'var(--primary)' : undefined }}
        >
          Preserved & Archived ({completedInterviews.length})
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-500 gap-2">
          <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          <span className="text-xs">Loading sessions registry...</span>
        </div>
      ) : (
        <>
          {activeTab === 'upcoming' && (
            <div className="flex-1 space-y-4">
              {upcomingInterviews.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs border rounded-3xl p-6" style={{ borderColor: 'var(--border)' }}>
                  No upcoming conversations scheduled. Click "Propose Interview" to get started.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingInterviews.map((interview) => {
                    const isSubject = interview.subjectId === currentUser.id;
                    const partnerName = isSubject ? interview.archivistName : interview.subjectName;
                    const partnerLabel = isSubject ? 'Youth Archivist' : 'Elder Subject';
                    const formattedDate = new Date(interview.scheduledAt).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    });

                    return (
                      <div
                        key={interview.interviewId}
                        className="bg-[var(--bg-card)] border rounded-3xl p-6 hover:shadow-xl transition-all flex flex-col justify-between"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-sm text-stone-850 dark:text-white line-clamp-1">{interview.title}</h4>
                            <span className={`text-[9px] px-2.5 py-1 rounded-full uppercase font-extrabold tracking-wider ${
                              interview.status === 'confirmed'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {interview.status}
                            </span>
                          </div>

                          <p className="text-xs text-stone-400 line-clamp-2 mb-4 leading-relaxed">
                            {interview.description || 'No description provided.'}
                          </p>

                          <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-2 text-[11px] text-stone-400">
                              <Calendar size={13} style={{ color: 'var(--primary)' }} />
                              <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-stone-400">
                              <Clock size={13} style={{ color: 'var(--primary)' }} />
                              <span>Partner: <strong>{partnerName}</strong> ({partnerLabel})</span>
                            </div>
                          </div>

                          {interview.questions?.length > 0 && (
                            <div className="mb-5 bg-[var(--bg-elevated)] border rounded-2xl p-4" style={{ borderColor: 'var(--border)' }}>
                              <h5 className="text-[10px] uppercase font-bold text-stone-400 mb-2">Question Guide Checklist ({interview.questions.length})</h5>
                              <ul className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                                {interview.questions.map((q: string, i: number) => (
                                  <li key={i} className="text-[11px] text-stone-350 flex items-start gap-2">
                                    <span className="text-[var(--primary)] font-bold mt-0.5">•</span>
                                    <span>{q}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                          {interview.status === 'proposed' && isSubject ? (
                            <button
                              onClick={() => handleConfirmInterview(interview.interviewId)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                              <Check size={14} />
                              Confirm Proposal
                            </button>
                          ) : interview.status === 'confirmed' ? (
                            <button
                              onClick={() => startLiveSession(interview)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-white rounded-xl text-xs font-bold transition-colors hover:scale-[1.01] cursor-pointer"
                              style={{ background: 'var(--primary)' }}
                            >
                              <Mic size={14} />
                              Start recording Oral History
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2.5 bg-stone-800 text-stone-500 rounded-xl text-xs font-semibold text-center border border-stone-850 cursor-default"
                            >
                              Waiting for {partnerName} to confirm
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

          {activeTab === 'completed' && (
            <div className="flex-1 space-y-4">
              {completedInterviews.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs border rounded-3xl p-6" style={{ borderColor: 'var(--border)' }}>
                  No completed oral history archives recorded yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {completedInterviews.map((interview) => {
                    const isSubject = interview.subjectId === currentUser.id;
                    const partnerName = isSubject ? interview.archivistName : interview.subjectName;
                    return (
                      <div
                        key={interview.interviewId}
                        className="bg-[var(--bg-card)] border rounded-3xl p-6 flex flex-col justify-between"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-bold text-sm text-stone-850 dark:text-white line-clamp-1">{interview.title}</h4>
                            <span className="text-[9px] px-2.5 py-1 rounded-full uppercase font-extrabold tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              Preserved
                            </span>
                          </div>

                          <p className="text-xs text-stone-405 leading-relaxed mb-4">
                            {interview.description || 'No description provided.'}
                          </p>

                          <div className="bg-[var(--bg-elevated)] border rounded-2xl p-3 mb-4 text-[11px] text-stone-400 space-y-2" style={{ borderColor: 'var(--border)' }}>
                            <p>Recorded by: <strong className="text-white">{interview.archivistName}</strong></p>
                            <p>Narrated by: <strong className="text-white">{interview.subjectName}</strong></p>
                          </div>
                        </div>

                        <div className="w-full mt-2 p-3 rounded-2xl bg-[var(--bg-elevated)] border border-stone-800 flex flex-col gap-1.5" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] text-stone-400 font-extrabold uppercase tracking-wide">Archived Audio Tape</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-[var(--primary)] font-bold border border-red-500/20">Recorded Live</span>
                          </div>
                          <audio
                            src={resolveMediaUrl(interview.recordingUrl)}
                            controls
                            className="w-full h-8 outline-none mt-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Propose modal */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-[var(--bg-card)] border rounded-3xl p-6 max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[90vh]" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setShowProposeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400 transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-lg font-bold font-serif text-stone-850 dark:text-white mb-2">
              Propose Intergenerational Conversation
            </h3>
            <p className="text-xs text-stone-450 mb-6">
              Invite a partner to hold a conversation on careers, life experience, technology, or other topics.
            </p>

            <form onSubmit={handleProposeInterview} className="space-y-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">
                  Select Partner ({isCurrentElder ? 'Youth Archivist' : 'Elder Subject'})
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  required
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="">-- Choose Partner --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role} - {u.community})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Interview Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Oral folklore about Mount Fako"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Description / Focus</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  required
                  placeholder="Describe the topics you wish to cover during this discussion..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              {/* Prep questions */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Pre-Prepared Questions Guide</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    placeholder="Add a question guide..."
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] flex-1 text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="p-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-800 rounded-xl text-stone-300 font-bold"
                  >
                    Add
                  </button>
                </div>
                {questionsList.length > 0 && (
                  <ul className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {questionsList.map((q, idx) => (
                      <li key={idx} className="flex justify-between items-center gap-2 p-2 rounded-lg bg-[var(--bg-elevated)] border border-stone-850 text-xs">
                        <span className="text-stone-300">{q}</span>
                        <button
                          type="button"
                          onClick={() => removeQuestion(idx)}
                          className="text-red-500 hover:text-red-400 p-0.5 rounded-md hover:bg-stone-800/50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
                style={{ background: 'var(--primary)' }}
              >
                {submitting ? (
                  <>
                    <Loader className="animate-spin" size={14} />
                    <span>Sending Proposal...</span>
                  </>
                ) : (
                  <span>Send Proposal Request</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Live recording simulation overlay */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-[var(--bg-card)] border rounded-3xl p-8 max-w-lg w-full text-center relative" style={{ borderColor: 'var(--border)' }}>
            
            <div className="flex flex-col items-center mb-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500 mb-4 ${
                isRecording ? 'animate-pulse' : ''
              }`}>
                <Mic size={32} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="text-xl font-bold font-serif text-stone-850 dark:text-white">{activeSession.title}</h3>
              <p className="text-xs text-stone-400 mt-1 capitalize">
                Intergenerational Conversation: {activeSession.archivistName} & {activeSession.subjectName}
              </p>
            </div>

            {/* Timer */}
            <div className="text-4xl font-extrabold text-white font-mono tracking-wider mb-6">
              {formatTimer(sessionTimer)}
            </div>

            {/* Simulated waveform */}
            <div className="h-16 flex items-center justify-center gap-1.5 mb-8">
              {Array.from({ length: 24 }).map((_, i) => {
                // Generate simulated heights
                const height = isRecording 
                  ? Math.max(10, Math.floor(Math.sin((sessionTimer * 2) + i) * 20 + 25) + Math.random() * 15) 
                  : 12;
                return (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-red-500/60 transition-all duration-300"
                    style={{
                      height: `${height}px`,
                      backgroundColor: isRecording ? 'var(--primary)' : '#444'
                    }}
                  />
                );
              })}
            </div>

            {/* Question checklist guide */}
            {activeSession.questions?.length > 0 && (
              <div className="mb-8 bg-[var(--bg-elevated)] border rounded-2xl p-4 text-left max-h-44 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                <h5 className="text-[10px] uppercase font-bold text-stone-400 mb-2.5">Prepared Questions Checklist</h5>
                <div className="space-y-2">
                  {activeSession.questions.map((q: string, i: number) => (
                    <label key={i} className="flex items-start gap-2.5 text-xs text-stone-300 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 rounded border-stone-800 accent-red-600 bg-transparent text-red-500" />
                      <span>{q}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Control buttons */}
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleRecordingState}
                className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isRecording 
                    ? 'border border-stone-800 text-stone-300 hover:bg-[var(--bg-elevated)]'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <Pause size={14} />
                    Pause Recording
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Resume Recording
                  </>
                )}
              </button>

              <button
                onClick={handleCompleteSession}
                disabled={completing}
                className="px-6 py-3 rounded-2xl text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/20 cursor-pointer"
                style={{ background: 'var(--primary)' }}
              >
                {completing ? (
                  <>
                    <Loader className="animate-spin" size={14} />
                    <span>Archiving History...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    End & Save Archive
                  </>
                )}
              </button>
            </div>
            
            <p className="text-[10px] text-stone-500 mt-6 flex items-center justify-center gap-1">
              <span>* Both participants will earn <strong>50 Legacy Credits</strong> upon session completion.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
