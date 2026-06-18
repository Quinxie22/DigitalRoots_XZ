import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Mic, Square, Trash2, Check, X, Loader, Search, FileText, Download, Award, Shield, CheckSquare, Square as UncheckedSquare, AlertCircle, Heart } from 'lucide-react';
import { getStories, uploadStory, likeStory, unlikeStory, approveStory, rejectStory, bulkApproveStories, deleteStory, getTranscription } from '../contentApi';
import type { User } from '../types';

interface MemoryArchiveProps {
  currentUser: User;
  token: string;
  autoPlayStory: any | null;
  onClearAutoPlay: () => void;
}

export default function MemoryArchive({ currentUser, token, autoPlayStory, onClearAutoPlay }: MemoryArchiveProps) {
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

  const isElder = currentUser.role === 'Elder';
  const isAdmin = currentUser.role === 'Admin';

  const fetchArchive = async (category = '', tag = '', isPublished?: boolean, authorId?: string) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await getStories(token, 1, 50, category, tag, isPublished, authorId);
      
      let list = response.stories || [];
      setStories(list);
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
    setTranscriptStatus('checking');
    try {
      setCheckingTranscript(true);
      const res = await getTranscription(token, story.storyId);
      setTranscriptText(res.transcript || 'No transcript text available yet.');
      setTranscriptStatus(res.status || 'completed');
    } catch (err) {
      console.error(err);
      setTranscriptText('Failed to fetch transcript.');
      setTranscriptStatus('failed');
    } finally {
      setCheckingTranscript(false);
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
      setSelectedStoryIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectStory = (storyId: string) => {
    setSelectedStoryIds(prev =>
      prev.includes(storyId) ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  // Mock stories when lists are empty to ensure beautiful demo
  const getDisplayStories = () => {
    if (stories.length > 0) return stories;
    
    // Default mock lists if backend is empty
    if (activeTab === 'archive') {
      const mockList = [
        {
          storyId: 'story-mock-1',
          title: 'The Legend of the Mountain Spirits',
          description: 'A traditional folklore tale of the guardian spirits that live in the western ranges.',
          elderName: 'Elder Joseph Mbenga',
          culturalCategory: 'tale',
          duration: 345,
          likes: ['user-arthur'],
          isPublished: true,
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          tags: ['myth', 'mountain', 'spirit']
        },
        {
          storyId: 'story-mock-2',
          title: 'Wisdom of the Baobab Tree',
          description: 'Proverbs and life lessons derived from the ancestral tree at the village center.',
          elderName: 'Elder Marie Ngo',
          culturalCategory: 'proverb',
          duration: 184,
          likes: [],
          isPublished: true,
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
          tags: ['wisdom', 'proverb', 'nature']
        }
      ];

      return mockList.filter((s: any) => {
        const matchesCat = !activeCategory || s.culturalCategory === activeCategory;
        const matchesTag = !searchTag || s.tags?.some((t: string) => t.toLowerCase().includes(searchTag.toLowerCase()));
        return matchesCat && matchesTag;
      });
    } else if (activeTab === 'moderation') {
      return [
        {
          storyId: 'story-mock-pending-1',
          title: 'Oral History of the Duala Kingdom migration',
          description: 'Audio detailing the migratory paths of the Duala coastal kingdoms.',
          elderName: 'Elder Samuel Eto',
          culturalCategory: 'history',
          duration: 720,
          likes: [],
          isPublished: false,
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
          tags: ['migration', 'history']
        }
      ];
    } else if (activeTab === 'my_contributions') {
      return [
        {
          storyId: 'story-mock-my-1',
          title: 'My First Migration Memory',
          description: 'A personal account of my journey to the new settlement.',
          elderName: currentUser.name,
          authorId: currentUser.id,
          elderId: currentUser.id,
          culturalCategory: 'history',
          duration: 320,
          likes: [],
          isPublished: true,
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
          tags: ['personal', 'migration']
        },
        {
          storyId: 'story-mock-my-2',
          title: 'Traditional Coastal Recipes',
          description: 'Preserving our ancestor\'s secret spice blends for fish broth.',
          elderName: currentUser.name,
          authorId: currentUser.id,
          elderId: currentUser.id,
          culturalCategory: 'recipe',
          duration: 450,
          likes: [],
          isPublished: false,
          audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
          tags: ['recipe', 'cooking']
        }
      ];
    }
    return [];
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-dark)]">
      
      {/* Header Tabs */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-6">
          <h2 className="text-lg font-bold font-serif">Memory Archive</h2>
          
          <div className="flex gap-1 bg-[var(--bg-elevated)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <button 
              onClick={() => { setActiveTab('archive'); setUploadSuccess(false); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'archive' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              Listen Memoirs
            </button>
            
            <button 
              onClick={() => { setActiveTab('my_contributions'); setUploadSuccess(false); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'my_contributions' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              My Contributions
            </button>
            
            {isElder && (
              <button 
                onClick={() => { setActiveTab('record'); setUploadSuccess(false); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'record' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                Record Session
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => { setActiveTab('moderation'); setUploadSuccess(false); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'moderation' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                Moderation Queue
              </button>
            )}
          </div>
        </div>

        {/* Short info */}
        <div className="text-xs text-stone-400 font-medium select-none">
          Role: <span className="font-bold text-red-500">{currentUser.role}</span>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-grow overflow-y-auto px-8 py-6 relative">

        {uploadSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle size={16} />
            <span>Memoir uploaded successfully! It is now pending Administrator approval before it becomes visible in the public archives.</span>
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
                Record Audio Live
              </button>
              <button 
                type="button"
                onClick={() => { setUploadMode('file'); setAudioBlob(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${uploadMode === 'file' ? 'bg-white text-stone-900 shadow-sm font-extrabold' : 'text-stone-500 dark:text-stone-400'}`}>
                Upload Archive File
              </button>
            </div>

            {uploadMode === 'record' ? (
              <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-elevated)] rounded-3xl border relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                {isRecording && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-[10px] font-extrabold uppercase text-red-500">Recording Live</span>
                  </div>
                )}

                {/* Timer */}
                <div className="text-4xl font-mono font-bold mt-4 mb-2 text-stone-850 dark:text-stone-205">
                  {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-[10px] text-stone-400 mb-6 uppercase tracking-wider font-semibold">Oral History Session</p>

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
                        Re-record
                      </button>
                      <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-600 text-xs font-bold border border-green-500/20">
                        Audio Recorded
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
                    {audioBlob ? (audioBlob as File).name : "Click to select a file from device"}
                  </span>
                  <span className="text-[10px] text-stone-500 mt-1">
                    Supports Audio, Video, Image, and PDFs (Max 25-100MB)
                  </span>
                </label>
              </div>
            )}

            {audioBlob && (
              <form onSubmit={handleUploadStorySubmit} className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Story Title</label>
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
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Description</label>
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
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Category</label>
                    <select 
                      value={recordCategory}
                      onChange={(e) => setRecordCategory(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)]"
                      style={{ borderColor: 'var(--border)' }}>
                      <option value="tale">Tale</option>
                      <option value="proverb">Proverb</option>
                      <option value="recipe">Recipe</option>
                      <option value="life_lesson">Life Lesson</option>
                      <option value="traditional_song">Traditional Song</option>
                      <option value="history">History</option>
                      <option value="ritual">Ritual</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Language</label>
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
                  {uploading ? 'Uploading and Queueing Whisper transcription...' : 'Upload & Transcribe Story'}
                </button>
              </form>
            )}

          </div>
        ) : activeTab === 'moderation' ? (
          /* ADMIN MODERATION QUEUE (Figma Layout "Moderation Queue") */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-serif font-bold text-base">Pending Elder Wisdom</h3>
                <p className="text-[10px] text-stone-400">Approve or reject uploaded memoirs before they enter the public feed</p>
              </div>

              {selectedStoryIds.length > 0 && (
                <button 
                  onClick={handleBulkApprove}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
                  <Check size={14} />
                  Bulk Approve ({selectedStoryIds.length})
                </button>
              )}
            </div>

            <div className="space-y-4">
              {getDisplayStories().length === 0 ? (
                <div className="py-24 text-center text-xs text-stone-400">
                  Moderation queue is empty. There are no stories currently awaiting review.
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
                          <span className="text-[10px] text-stone-400">By Elder {story.elderName}</span>
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
                All
              </button>
              {['tale', 'proverb', 'recipe', 'life_lesson', 'traditional_song', 'history', 'ritual'].map((cat) => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap ${activeCategory === cat ? 'bg-red-500/10 text-red-500 font-bold border border-red-500/20' : 'text-stone-500'}`}>
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Tag search input */}
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-grow">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Filter by tag/label..."
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
                  Clear
                </button>
              )}
            </div>

            {/* Stories Grid */}
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-2 text-stone-400">
                <Loader className="animate-spin" size={24} />
                <span className="text-xs">Streaming memoirs feed...</span>
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
                      {story.mediaType === 'image' && (story.mediaUrl || story.audioUrl) ? (
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
                            Open Document
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
                                {story.culturalCategory}
                              </span>
                              
                              {/* Approval Status Badge */}
                              {(currentUser.role === 'Admin' || story.authorId === currentUser.id || story.elderId === currentUser.id) && (
                                <span className={`text-[8px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border backdrop-blur-sm ${
                                  story.isPublished 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                                }`}>
                                  {story.isPublished ? 'Published' : 'Pending Approval'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-stone-400">{Math.floor(story.duration / 60)}:{(story.duration % 60).toString().padStart(2, '0')}</span>
                          </div>

                          <h4 className="font-bold text-sm truncate mt-1 text-stone-850 dark:text-stone-150">{story.title}</h4>
                          <p className="text-[10px] text-stone-400">By Elder {story.elderName}</p>
                          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-2 leading-relaxed">
                            {story.description || 'No description provided'}
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

                          {story.mediaType === 'audio' || (!story.mediaType && story.audioUrl) ? (
                            <button 
                              onClick={() => handleViewTranscript(story)}
                              className="flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 hover:underline">
                              <FileText size={14} />
                              Read Transcript
                            </button>
                          ) : (
                            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                              {story.mediaType || 'Media'} Archive
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
            <h3 className="font-serif font-bold text-base mb-2">Reject Wisdom Upload</h3>
            <p className="text-xs text-stone-400 mb-4">Provide details on what needs to be improved or corrected for approval.</p>

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
                  Reject Story
                </button>
                <button type="button" onClick={() => setRejectingStoryId(null)} className="px-5 py-2.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-200 font-bold text-xs rounded-xl">
                  Cancel
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
                <p className="text-[10px] text-stone-400">Oral History Transcript • Status: <span className="font-bold uppercase text-red-500">{transcriptStatus}</span></p>
              </div>
              <button onClick={() => setSelectedStoryForTranscript(null)} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5">
                <X size={16} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto bg-[var(--bg-elevated)] rounded-2xl p-4 border text-xs leading-relaxed text-stone-600 dark:text-stone-300 font-mono whitespace-pre-wrap select-text"
                 style={{ borderColor: 'var(--border)' }}>
              {checkingTranscript ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-stone-400">
                  <Loader className="animate-spin" size={18} />
                  <span>Fetching Whisper transcript...</span>
                </div>
              ) : (
                transcriptText
              )}
            </div>

            <div className="flex gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {transcriptStatus === 'completed' && (
                <a 
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(transcriptText)}`}
                  download={`transcript-${selectedStoryForTranscript.storyId}.txt`}
                  className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all">
                  <Download size={14} />
                  Download Transcript (.txt)
                </a>
              )}
              <button 
                onClick={() => setSelectedStoryForTranscript(null)}
                className="px-6 py-2.5 bg-red-650 text-white font-bold text-xs rounded-xl flex-shrink-0"
                style={{ background: 'var(--primary)' }}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
