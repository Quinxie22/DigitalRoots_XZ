import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Square, Trash2, Check, X, Loader, Search, FileText, Download, Award, Shield, CheckSquare, Square as UncheckedSquare, AlertCircle, Heart, BookOpen } from 'lucide-react';
import { getStories, uploadStory, likeStory, unlikeStory, approveStory, rejectStory, bulkApproveStories, deleteStory, getTranscription, translateTranscript, getStoryDetails, getArticles, resolveContentUrl } from '../contentApi';
import type { User } from '../types';
import { useTranslation } from 'react-i18next';

interface MemoryArchiveProps {
  currentUser: User;
  token: string;
  autoPlayStory: any | null;
  onClearAutoPlay: () => void;
}

export default function MemoryArchive({ currentUser, token, autoPlayStory, onClearAutoPlay }: MemoryArchiveProps) {
  const { t } = useTranslation();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Tab views: 'archive' (feed list), 'moderation' (Admin approvals), 'record' (Elder record session), 'my_contributions' (personal uploads)
  const [activeTab, setActiveTab] = useState<'archive' | 'moderation' | 'record' | 'my_contributions'>('archive');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTag, setSearchTag] = useState('');
  
  // Audio player state
  const [playingStory, setPlayingStory] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Transcription state
  const [selectedStoryForTranscript, setSelectedStoryForTranscript] = useState<any | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [checkingTranscript, setCheckingTranscript] = useState(false);

  // Translation states
  const [displayedTranscript, setDisplayedTranscript] = useState('');
  const [activeLang, setActiveLang] = useState<'original' | 'translated'>('original');
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');

  // Elder recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordCategory, setRecordCategory] = useState('tale');
  const [recordLanguage, setRecordLanguage] = useState('en');
  const [recordTags, setRecordTags] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadMode, setUploadMode] = useState<'record' | 'file'>('record');

  // Admin moderation queue selection
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [rejectingStoryId, setRejectingStoryId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedArticleForRead, setSelectedArticleForRead] = useState<any | null>(null);

  const isElder = currentUser.role === 'Elder';
  const isAdmin = currentUser.role === 'Admin';

  const fetchArchive = async (category = '', tag = '', isPublished?: boolean, authorId?: string) => {
    try {
      setLoading(true);
      setError('');
      
      if (activeTab === 'my_contributions' && authorId) {
        const [storiesRes, articlesRes] = await Promise.all([
          getStories(token, 1, 50, category, tag, isPublished, authorId),
          getArticles(token, 1, 50, category, authorId, isPublished)
        ]);
        
        const storiesList = storiesRes.stories || [];
        const articlesList = (articlesRes.articles || []).map((art: any) => ({
          ...art,
          storyId: art.knowledgeId,
          title: art.title,
          description: art.summary,
          culturalCategory: art.category,
          elderName: art.authorName || 'Contributor',
          duration: 0,
          mediaType: 'document',
          mediaUrl: art.coverImage || '',
          isPublished: art.isPublished,
          likes: art.likes || [],
          createdAt: art.createdAt,
          isArticle: true
        }));
        
        const combined = [...storiesList, ...articlesList].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setStories(combined);
      } else {
        const response = await getStories(token, 1, 50, category, tag, isPublished, authorId);
        let list = response.stories || [];
        setStories(list);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch archive feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'archive') {
      fetchArchive(activeCategory, searchTag, true);
    } else if (activeTab === 'moderation') {
      fetchArchive('', '', false);
    } else if (activeTab === 'my_contributions') {
      fetchArchive(activeCategory, searchTag, undefined, currentUser.id);
    }
  }, [activeTab, activeCategory, searchTag]);

  // Handle autoplay story from dashboard
  useEffect(() => {
    if (autoPlayStory) {
      setActiveTab('archive');
      handlePlayPause(autoPlayStory);
      onClearAutoPlay();
    }
  }, [autoPlayStory]);

  const handlePlayPause = (story: any) => {
    if (playingStory && playingStory.storyId === story.storyId) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingStory(story);
      setIsPlaying(true);
      
      // Initialize new HTML audio element
      const audio = new Audio(story.audioUrl);
      audio.play();
      audio.onended = () => setIsPlaying(false);
      audioRef.current = audio;

      // Increment views on backend
      getStoryDetails(token, story.storyId).then((res) => {
        if (res.success && res.story) {
          setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, viewCount: res.story.viewCount } : s));
        }
      }).catch(err => console.warn('Failed to increment view count:', err));
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleLikeToggle = async (story: any) => {
    const isLiked = story.likes?.includes(currentUser.id);
    try {
      if (isLiked) {
        const response = await unlikeStory(token, story.storyId);
        setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, likes: s.likes.filter((id: string) => id !== currentUser.id) } : s));
      } else {
        const response = await likeStory(token, story.storyId);
        setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, likes: [...(s.likes || []), currentUser.id] } : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewTranscript = async (story: any) => {
    setSelectedStoryForTranscript(story);
    setTranscriptText('');
    setDisplayedTranscript('');
    setActiveLang('original');
    setTranslationError('');
    setTranscriptStatus('checking');

    // Increment views on backend
    getStoryDetails(token, story.storyId).then((res) => {
      if (res.success && res.story) {
        setStories(prev => prev.map(s => s.storyId === story.storyId ? { ...s, viewCount: res.story.viewCount } : s));
      }
    }).catch(err => console.warn('Failed to increment view count:', err));

    try {
      setCheckingTranscript(true);
      const res = await getTranscription(token, story.storyId);
      const text = res.transcript || 'No transcript text available yet.';
      setTranscriptText(text);
      setDisplayedTranscript(text);
      setTranscriptStatus(res.status || 'completed');
    } catch (err) {
      console.error(err);
      setTranscriptText('Failed to fetch transcript.');
      setDisplayedTranscript('Failed to fetch transcript.');
      setTranscriptStatus('failed');
    } finally {
      setCheckingTranscript(false);
    }
  };

  const handleTranslateClick = async () => {
    if (!selectedStoryForTranscript || translating) return;

    if (activeLang === 'translated') {
      setDisplayedTranscript(transcriptText);
      setActiveLang('original');
      return;
    }

    const sourceLanguage = selectedStoryForTranscript.language || 'en';
    const targetLanguage = sourceLanguage === 'fr' ? 'en' : 'fr';

    try {
      setTranslating(true);
      setTranslationError('');
      const response = await translateTranscript(token, selectedStoryForTranscript.storyId, targetLanguage);
      if (response.success && response.translatedText) {
        setDisplayedTranscript(response.translatedText);
        setActiveLang('translated');
      } else {
        setTranslationError('Translation service returned invalid response.');
      }
    } catch (err) {
      console.error(err);
      setTranslationError('Failed to translate transcript.');
    } finally {
      setTranslating(false);
    }
  };

  // Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Could not start microphone recording. Check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  const handleUploadStorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioBlob || !recordTitle.trim()) return;

    try {
      setUploading(true);
      setError('');
      await uploadStory(token, audioBlob, {
        title: recordTitle,
        description: recordDescription,
        culturalCategory: recordCategory,
        language: recordLanguage,
        tags: recordTags,
        duration: recordingSeconds,
      });

      setUploadSuccess(true);
      // Clear & switch
      setRecordTitle('');
      setRecordDescription('');
      setRecordTags('');
      setAudioBlob(null);
      setActiveTab('archive');
      fetchArchive('', '', false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload story');
    } finally {
      setUploading(false);
    }
  };

  // Moderation Logic
  const handleApprove = async (storyId: string) => {
    try {
      await approveStory(token, storyId);
      setStories(prev => prev.filter(s => s.storyId !== storyId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingStoryId || !rejectionReason.trim()) return;
    try {
      await rejectStory(token, rejectingStoryId, rejectionReason);
      setStories(prev => prev.filter(s => s.storyId !== rejectingStoryId));
      setRejectingStoryId(null);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedStoryIds.length === 0) return;
    try {
      await bulkApproveStories(token, selectedStoryIds);
      setStories(prev => prev.filter(s => !selectedStoryIds.includes(s.storyId)));
    } catch (err) {
      console.error(err);
    }
    setSelectedStoryIds([]);
  };

  const toggleSelectStory = (storyId: string) => {
    setSelectedStoryIds(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  // Mock stories when lists are empty to ensure beautiful demo
  const getDisplayStories = () => {
    return stories;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-dark)]">
      
      {/* Header Tabs */}
      <header className="md:h-16 py-4 md:py-0 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-8 gap-4 md:gap-0 border-b"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0 w-full md:w-auto">
          <h2 className="text-base sm:text-lg font-bold font-serif whitespace-nowrap">{t('archiveTitle')}</h2>
          
          <div className="flex gap-1 bg-[var(--bg-elevated)] p-1 rounded-xl border overflow-x-auto scrollbar-none max-w-full" style={{ borderColor: 'var(--border)' }}>
            <button 
              onClick={() => { setActiveTab('archive'); setUploadSuccess(false); }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'archive' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              {t('archiveTabListen')}
            </button>
            
            <button 
              onClick={() => { setActiveTab('my_contributions'); setUploadSuccess(false); }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'my_contributions' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              {t('archiveTabMyContributions')}
            </button>
            
            {isElder && (
              <button 
                onClick={() => { setActiveTab('record'); setUploadSuccess(false); }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'record' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                {t('archiveTabRecord')}
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => { setActiveTab('moderation'); setUploadSuccess(false); }}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'moderation' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                {t('archiveTabModeration')}
              </button>
            )}
          </div>
        </div>

        {/* Short info */}
        <div className="text-[10px] sm:text-xs text-stone-400 font-medium select-none self-end md:self-auto flex-shrink-0">
          {t('archiveRole')}: <span className="font-bold text-red-500">{currentUser.role === 'Elder' ? t('senior') : currentUser.role === 'Youth' ? t('youth') : currentUser.role}</span>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-grow overflow-y-auto px-8 py-6 relative">

        {uploadSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle size={16} />
            <span>{t('archiveUploadSuccessMsg')}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'record' ? (
          /* ELDER RECORD PANEL (Figma Layout "Recording Session") */
          <div className="max-w-xl mx-auto bg-[var(--bg-card)] border rounded-3xl p-8 shadow-sm space-y-6" style={{ borderColor: 'var(--border)' }}>
            
            {/* Toggle Switcher */}
            <div className="flex gap-2 bg-[var(--bg-elevated)] p-1 rounded-xl border animate-fade-in" style={{ borderColor: 'var(--border)' }}>
              <button 
                type="button"
                onClick={() => { setUploadMode('record'); setAudioBlob(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${uploadMode === 'record' ? 'bg-white text-stone-900 shadow-sm font-extrabold' : 'text-stone-500 dark:text-stone-400'}`}>
                {t('archiveRecordAudioLive')}
              </button>
              <button 
                type="button"
                onClick={() => { setUploadMode('file'); setAudioBlob(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${uploadMode === 'file' ? 'bg-white text-stone-900 shadow-sm font-extrabold' : 'text-stone-500 dark:text-stone-400'}`}>
                {t('archiveUploadArchiveFile')}
              </button>
            </div>

            {uploadMode === 'record' ? (
              <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-elevated)] rounded-3xl border relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {isRecording && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] font-extrabold uppercase text-red-500">{t('archiveRecordingLive')}</span>
                  </div>
                )}

                {/* Timer */}
                <div className="text-4xl font-mono font-bold mt-4 mb-2 text-stone-850 dark:text-stone-205">
                  {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-[10px] text-stone-400 mb-6 uppercase tracking-wider font-semibold">{t('homeOralHistorySession')}</p>

                {/* Simulated Recording Waveform */}
                {isRecording ? (
                  <div className="flex gap-1 items-end h-12 mb-6">
                    {[...Array(16)].map((_, i) => (
                      <span 
                        key={i} 
                        className="w-1 bg-red-500 rounded-full animate-bounce" 
                        style={{ 
                           height: `${Math.floor(Math.random() * 40) + 10}px`,
                           animationDuration: `${Math.floor(Math.random() * 500) + 300}ms`
                        }} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-12 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mb-6" />
                )}

                {/* Controls */}
                <div className="flex gap-4">
                  {!isRecording && !audioBlob ? (
                    <button 
                      type="button"
                      onClick={startRecording}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-950/20 hover:scale-[1.03] transition-all">
                      <Mic size={24} />
                    </button>
                  ) : isRecording ? (
                    <button 
                      type="button"
                      onClick={stopRecording}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-stone-800 text-white shadow-lg hover:scale-[1.03] transition-all">
                      <Square size={20} className="fill-white" />
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setAudioBlob(null)}
                        className="px-4 py-2 rounded-xl border hover:bg-black/5 text-stone-500 text-xs" style={{ borderColor: 'var(--border)' }}>
                        {t('archiveReRecord')}
                      </button>
                      <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
                        {t('archiveAudioRecorded')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* FILE UPLOAD INTERFACE */
              <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-elevated)] rounded-3xl border relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <input 
                  type="file" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAudioBlob(file);
                      setRecordTitle(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                    }
                  }}
                  accept="audio/*,video/*,image/*,application/pdf"
                  className="hidden"
                  id="archive-file-input"
                />
                <label 
                  htmlFor="archive-file-input"
                  className="w-full flex flex-col items-center justify-center p-8 bg-[var(--bg-card)] rounded-2xl border border-dashed border-stone-800 dark:border-stone-700 cursor-pointer hover:border-red-500 transition-colors"
                >
                  <FileText size={36} className="text-stone-500 mb-2" />
                  <span className="text-xs font-semibold text-stone-300 text-center truncate max-w-xs">
                    {audioBlob ? (audioBlob as File).name : t('archiveSelectFileClick')}
                  </span>
                  <span className="text-[10px] text-stone-500 mt-1">
                    {t('archiveFileSupportTypes')}
                  </span>
                </label>
              </div>
            )}

            {audioBlob && (
              <form onSubmit={handleUploadStorySubmit} className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">{t('archiveTitleLabel')}</label>
                  <input 
                    type="text" 
                    value={recordTitle}
                    onChange={(e) => setRecordTitle(e.target.value)}
                    required
                    placeholder="e.g., The Migration from the Coastal Lands"
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">{t('archiveDescriptionLabel')}</label>
                  <textarea 
                    value={recordDescription}
                    onChange={(e) => setRecordDescription(e.target.value)}
                    rows={2}
                    placeholder="Brief summary of what this memoir is about..."
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">{t('archiveCategoryLabel')}</label>
                    <select 
                      value={recordCategory}
                      onChange={(e) => setRecordCategory(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)]"
                      style={{ borderColor: 'var(--border)' }}>
                      <option value="life_lesson">Life Lesson</option>
                      <option value="history">Personal History / Memoir</option>
                      <option value="proverb">Proverb & Advice</option>
                      <option value="tale">Story or Tale</option>
                      <option value="recipe">Cooking & Recipe</option>
                      <option value="traditional_song">Music & Song</option>
                      <option value="ritual">Customs & Ritual</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">{t('archiveLanguageLabel')}</label>
                    <input 
                      type="text" 
                      value={recordLanguage}
                      onChange={(e) => setRecordLanguage(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)]"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={uploading}
                  className="w-full py-3 rounded-2xl text-white font-bold text-xs shadow-md shadow-red-950/20"
                  style={{ background: 'var(--primary)' }}>
                  {uploading ? t('archiveUploadingMsg') : t('archiveUploadTranscribeButton')}
                </button>
              </form>
            )}

          </div>
        ) : activeTab === 'moderation' ? (
          /* ADMIN MODERATION QUEUE (Figma Layout "Moderation Queue") */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-serif font-bold text-base">{t('archivePendingTitle')}</h3>
                <p className="text-[10px] text-stone-400">{t('archivePendingDesc')}</p>
              </div>

              {selectedStoryIds.length > 0 && (
                <button 
                  onClick={handleBulkApprove}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                  <Check size={14} />
                  {t('archiveBulkApprove')} ({selectedStoryIds.length})
                </button>
              )}
            </div>

            <div className="space-y-4">
              {getDisplayStories().length === 0 ? (
                <div className="py-24 text-center text-xs text-stone-400">
                  {t('archiveModerationEmpty')}
                </div>
              ) : (
                getDisplayStories().map((story) => (
                  <div key={story.storyId} 
                       className="p-5 rounded-3xl bg-[var(--bg-card)] border flex items-center justify-between gap-6"
                       style={{ borderColor: 'var(--border)' }}>
                    
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Selection Box for Bulk approval */}
                      <button 
                        onClick={() => toggleSelectStory(story.storyId)}
                        className="text-stone-400 hover:text-stone-600 flex-shrink-0">
                        {selectedStoryIds.includes(story.storyId) ? (
                          <CheckSquare size={18} className="text-red-500" style={{ color: 'var(--primary)' }} />
                        ) : (
                          <UncheckedSquare size={18} />
                        )}
                      </button>

                      {/* Cover circle */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-800 to-amber-950 flex-shrink-0 flex items-center justify-center cursor-pointer"
                           onClick={() => handlePlayPause(story)}>
                        <Play size={16} className="text-white fill-white" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-650"
                                style={{ color: 'var(--primary)' }}>
                            {story.culturalCategory}
                          </span>
                          <span className="text-[10px] text-stone-400">{t('archiveByElder')} {story.elderName}</span>
                        </div>
                        <h4 className="font-bold text-sm truncate mt-1 text-stone-850 dark:text-stone-150">{story.title}</h4>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(story.storyId)}
                        className="p-2 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 dark:hover:bg-green-900/60 border border-green-200 dark:border-green-800 text-green-600 rounded-xl">
                        <Check size={16} />
                      </button>
                      <button 
                        onClick={() => setRejectingStoryId(story.storyId)}
                        className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 text-red-650 rounded-xl">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* ARCHIVE LISTEN / FEED VIEW */
          <div className="space-y-6">
            
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <button 
                onClick={() => setActiveCategory('')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg ${activeCategory === '' ? 'bg-red-500/10 text-red-500 font-bold border border-red-500/20' : 'text-stone-500'}`}>
                {t('all', 'All')}
              </button>
              {['life_lesson', 'history', 'proverb', 'tale', 'recipe', 'traditional_song', 'ritual'].map((cat) => {
                const label = {
                  life_lesson: 'Life Lessons',
                  history: 'Memoirs & History',
                  proverb: 'Advice',
                  tale: 'Stories',
                  recipe: 'Recipes',
                  traditional_song: 'Music & Song',
                  ritual: 'Customs'
                }[cat] || cat;
                return (
                  <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${activeCategory === cat ? 'bg-red-500/10 text-red-500 font-bold border border-red-500/20' : 'text-stone-500'}`}>
                    {t('cat_' + cat, label)}
                  </button>
                );
              })}
            </div>

            {/* Tag search input */}
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-grow">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder={t('archiveTagFilterPlaceholder', 'Filter by tag/label...')}
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl outline-none border"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              {searchTag && (
                <button 
                  onClick={() => setSearchTag('')}
                  className="text-xs text-red-500 hover:underline">
                  {t('clear', 'Clear')}
                </button>
              )}
            </div>

            {/* Stories Grid */}
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-2 text-stone-400">
                <Loader className="animate-spin" size={24} />
                <span className="text-xs">{t('archiveStreamingFeed', 'Streaming memoirs feed...')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getDisplayStories().map((story) => {
                  const isStoryPlaying = playingStory?.storyId === story.storyId && isPlaying;
                  const isLiked = story.likes?.includes(currentUser.id);

                  return (
                    <div 
                      key={story.storyId} 
                      className="rounded-3xl border bg-[var(--bg-card)] overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                      style={{ borderColor: 'var(--border)' }}>
                      
                      {/* Dynamic Card Header based on mediaType */}
                      {story.isArticle ? (
                        <div className="h-32 bg-gradient-to-br from-red-950/85 to-amber-950/85 relative overflow-hidden flex flex-col items-center justify-center gap-2 border-b border-white/5 p-4 select-none">
                           <BookOpen size={28} className="text-amber-400" />
                           <span className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">
                             Article Contribution
                           </span>
                           <button 
                             onClick={() => setSelectedArticleForRead(story)}
                             className="text-[10px] font-bold text-white bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition-all cursor-pointer"
                           >
                             {t('view', 'View Content')}
                           </button>
                        </div>
                      ) : story.mediaType === 'image' && (story.mediaUrl || story.audioUrl) ? (
                        <div className="h-32 bg-black relative overflow-hidden flex items-center justify-center border-b border-white/5">
                          <img 
                            src={story.mediaUrl || story.audioUrl} 
                            alt={story.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                      ) : story.mediaType === 'video' && (story.mediaUrl || story.audioUrl) ? (
                        <div className="h-32 bg-black relative overflow-hidden flex items-center justify-center border-b border-white/5">
                          <video 
                            src={story.mediaUrl || story.audioUrl} 
                            className="w-full h-full object-contain"
                            controls
                            preload="metadata"
                          />
                        </div>
                      ) : story.mediaType === 'document' && (story.mediaUrl || story.audioUrl) ? (
                        <div className="h-32 bg-stone-900 dark:bg-stone-950 relative overflow-hidden flex flex-col items-center justify-center gap-2 border-b border-white/5 p-4">
                           <FileText size={28} className="text-red-500" />
                           <span className="text-[10px] text-stone-400 font-bold uppercase truncate max-w-full">
                             {story.title || 'Document Memoir'}
                           </span>
                           <a 
                             href={story.mediaUrl || story.audioUrl}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-[10px] font-bold text-red-400 hover:underline"
                           >
                             {t('homeOpenFile')}
                           </a>
                        </div>
                      ) : (
                        /* Default Audio Player visualizer area */
                        <div className="h-32 bg-gradient-to-br from-red-950 to-stone-900 relative overflow-hidden flex items-center justify-center">
                          <button 
                            onClick={() => handlePlayPause(story)}
                            className="w-12 h-12 rounded-full flex items-center justify-center bg-white text-stone-900 shadow-xl hover:scale-105 transition-all z-10">
                            {isStoryPlaying ? <Pause size={18} className="fill-stone-900" /> : <Play size={18} className="fill-stone-900 ml-0.5" />}
                          </button>
                          
                          {/* Fake Waveform visualizer absolute overlay */}
                          <div className="absolute bottom-2 inset-x-4 flex justify-between items-end h-8 opacity-25">
                            {[...Array(24)].map((_, i) => (
                              <span 
                                key={i} 
                                className={`w-0.5 bg-white rounded-full ${isStoryPlaying ? 'animate-pulse' : ''}`} 
                                style={{ 
                                  height: `${Math.floor(Math.sin(i) * 15) + 20}px` 
                                }} 
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Card Body */}
                      <div className="p-5 space-y-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-650"
                                    style={{ color: 'var(--primary)' }}>
                                {t('cat_' + story.culturalCategory) || story.culturalCategory}
                              </span>
                              
                              {/* Approval Status Badge */}
                              {(currentUser.role === 'Admin' || story.authorId === currentUser.id || story.elderId === currentUser.id) && (
                                <span className={`text-[8px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border backdrop-blur-sm ${
                                  story.isPublished 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                                }`}>
                                  {story.isPublished ? t('archiveStatusPublished') : t('archiveStatusPending')}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-stone-400">{Math.floor(story.duration / 60)}:{(story.duration % 60).toString().padStart(2, '0')}</span>
                          </div>

                          <h4 className="font-bold text-sm truncate mt-1 text-stone-850 dark:text-stone-150">{story.title}</h4>
                          <p className="text-[10px] text-stone-400">{t('archiveByElder')} {story.elderName}</p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-2 leading-relaxed">
                            {story.description || t('archiveNoDescription')}
                          </p>
                        </div>

                        {/* Likes & Transcript Actions */}
                        <div className="flex items-center justify-between border-t pt-4 text-stone-400 text-xs" style={{ borderColor: 'var(--border)' }}>
                          <button 
                            onClick={() => handleLikeToggle(story)}
                            className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
                            <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                            <span>{story.likes?.length || 0}</span>
                          </button>

                          {story.isArticle ? (
                            <button 
                              onClick={() => setSelectedArticleForRead(story)}
                              className="flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 hover:underline">
                              <BookOpen size={14} />
                              {t('homeReadArticle', 'Read Article')}
                            </button>
                          ) : story.mediaType === 'audio' || (!story.mediaType && story.audioUrl) ? (
                            <button 
                              onClick={() => handleViewTranscript(story)}
                              className="flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 hover:underline">
                              <FileText size={14} />
                              {t('homeReadTranscript')}
                            </button>
                          ) : (
                            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                              {t(story.mediaType || 'media') || story.mediaType || 'Media'} {t('archive') || 'Archive'}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* REJECTION REASON MODAL */}
      {rejectingStoryId && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] border rounded-3xl p-6 w-full max-w-md shadow-2xl relative" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-serif font-bold text-base mb-2">{t('archiveRejectTitle')}</h3>
            <p className="text-xs text-stone-400 mb-4">{t('archiveRejectDesc')}</p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                rows={3}
                placeholder="e.g., Audio quality has high background static, please record again in a quieter room..."
                className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none"
                style={{ borderColor: 'var(--border)' }}
              />

              <div className="flex gap-3">
                <button type="submit" className="flex-1 py-2.5 bg-red-650 text-white font-bold text-xs rounded-xl" style={{ background: 'var(--primary)' }}>
                  {t('archiveRejectButton')}
                </button>
                <button type="button" onClick={() => setRejectingStoryId(null)} className="px-5 py-2.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-200 font-bold text-xs rounded-xl">
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSCRIPTION VIEW DIALOG MODAL */}
      {selectedStoryForTranscript && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] border rounded-3xl p-6 w-full max-w-xl shadow-2xl flex flex-col max-h-[80vh]" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-start border-b pb-3 mb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-serif font-bold text-base">{selectedStoryForTranscript.title}</h3>
                <p className="text-[10px] text-stone-400">
                  {t('archiveTranscriptStatusLabel')} • Status: <span className="font-bold uppercase text-red-500">{transcriptStatus}</span>
                  {activeLang === 'translated' && <span className="text-red-500 font-bold ml-2">(TRANSLATED)</span>}
                </p>
              </div>
              <button onClick={() => setSelectedStoryForTranscript(null)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <X size={16} />
              </button>
            </div>

            {/* Translate Toolbar */}
            {transcriptStatus === 'completed' && !checkingTranscript && (
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  onClick={handleTranslateClick}
                  disabled={translating}
                  className="px-3.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 bg-[var(--bg-elevated)] border-[var(--border)] hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300"
                >
                  {translating ? (
                    <>
                      <Loader className="animate-spin text-red-500" size={12} />
                      <span>{t('archiveTranslating')}</span>
                    </>
                  ) : activeLang === 'translated' ? (
                    <span>{t('archiveShowOriginal')} ({selectedStoryForTranscript.language || 'en'})</span>
                  ) : (
                    <span>{t('archiveTranslateTo')} {selectedStoryForTranscript.language === 'fr' ? 'English (en)' : 'French (fr)'}</span>
                  )}
                </button>
                {translationError && (
                  <span className="text-[10px] text-red-500 font-semibold">{translationError}</span>
                )}
              </div>
            )}

            <div className="flex-grow overflow-y-auto bg-[var(--bg-elevated)] rounded-2xl p-4 border text-xs leading-relaxed text-stone-600 dark:text-stone-300 font-mono whitespace-pre-wrap select-text"
                 style={{ borderColor: 'var(--border)' }}>
              {checkingTranscript ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-stone-400">
                  <Loader className="animate-spin" size={18} />
                  <span>{t('archiveFetchingTranscript')}</span>
                </div>
              ) : (
                displayedTranscript
              )}
            </div>

            <div className="flex gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {transcriptStatus === 'completed' && (
                <a 
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(displayedTranscript)}`}
                  download={`transcript-${activeLang}-${selectedStoryForTranscript.storyId}.txt`}
                  className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all">
                  <Download size={14} />
                  {t('archiveDownload')} {activeLang === 'translated' ? 'Translated' : 'Original'} (.txt)
                </a>
              )}
              <button 
                onClick={() => setSelectedStoryForTranscript(null)}
                className="px-6 py-2.5 bg-red-650 text-white font-bold text-xs rounded-xl flex-shrink-0"
                style={{ background: 'var(--primary)' }}>
                {t('archiveClose')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ARTICLE READER MODAL */}
      {selectedArticleForRead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-[var(--bg-card)] border rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative space-y-4" 
            style={{ borderColor: 'var(--border)' }}
          >
            <button 
              onClick={() => setSelectedArticleForRead(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X size={20} />
            </button>

            {selectedArticleForRead.coverImage && (
              <div className="h-48 rounded-2xl overflow-hidden border bg-black/20" style={{ borderColor: 'var(--border)' }}>
                <img 
                  src={resolveContentUrl(selectedArticleForRead.coverImage)} 
                  alt={selectedArticleForRead.title} 
                  className="w-full h-full object-cover" 
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-650"
                      style={{ color: 'var(--primary)' }}>
                  {selectedArticleForRead.culturalCategory}
                </span>
                <span className="text-[10px] text-stone-400">
                  {new Date(selectedArticleForRead.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-serif font-black text-xl text-stone-900 dark:text-stone-100 leading-snug">
                {selectedArticleForRead.title}
              </h3>
              <p className="text-xs text-stone-500 font-medium">
                {t('archiveByElder')} {selectedArticleForRead.elderName}
              </p>
            </div>

            <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider mb-2">Summary</p>
              <p className="text-xs text-stone-655 dark:text-stone-350 bg-[var(--bg-elevated)] p-3.5 rounded-2xl border leading-relaxed" style={{ borderColor: 'var(--border)' }}>
                {selectedArticleForRead.description}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">Full Content</p>
              <div className="text-xs leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap font-serif bg-[var(--bg-elevated)]/50 p-4 rounded-2xl border min-h-[150px]" style={{ borderColor: 'var(--border)' }}>
                {selectedArticleForRead.content || 'No content written yet.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
