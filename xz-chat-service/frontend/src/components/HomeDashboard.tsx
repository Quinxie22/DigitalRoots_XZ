import { useState, useEffect, useRef } from 'react';
import { BookOpen, Award, ArrowRight, Play, Heart, Star, ChevronLeft, ChevronRight, Eye, MessageSquare, Share2, Bookmark, Image, Video, Plus, X, Loader, AlertCircle, Bell, FileText } from 'lucide-react';
import { getStories, getFeed, createTextPost, createMediaPost, resolveContentUrl, likePostComment, addPostComment, deletePostComment } from '../contentApi';
import { resolveMediaUrl } from '../api';
import type { User } from '../types';

interface HomeDashboardProps {
  currentUser: User;
  token: string;
  onNavigate: (tab: 'home' | 'messages' | 'archive' | 'wisdom' | 'settings') => void;
  onPlayStory: (story: any) => void;
  onViewProfile: (userId: string) => void;
  onShowNotifications?: () => void;
}

const MEMOIR_PROMPTS = [
  "Tell us about a time when you felt completely at home. Was it a typical place, or a person you were with?",
  "What is the most valuable traditional wisdom your parents or grandparents passed down to you?",
  "Share a story of a major community event or ceremony that you participated in during your youth.",
  "Describe a traditional recipe or meal that represents your heritage, and the memories associated with it.",
  "What was the first technology or modern invention you remember seeing, and how did it change your community?",
];

// Helper to resolve user initials & colors dynamically
function getUserAvatarDetails(userId: string, userName: string) {
  const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  const found = dynamicUsers.find((u) => u.id === userId || u._id === userId || u.firebaseUid === userId || u.firebase_uid === userId);
  const avatar = found ? found.avatar : '';

  const initials = userName ? userName.slice(0, 2).toUpperCase() : '??';
  const gradients = [
    'from-red-700 to-red-900',
    'from-purple-700 to-purple-900',
    'from-rose-600 to-pink-900',
    'from-blue-700 to-blue-900',
    'from-emerald-700 to-teal-900',
    'from-amber-600 to-orange-800'
  ];
  const hash = userId ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const color = gradients[hash % gradients.length];
  return { initials, color, avatar };
}

export default function HomeDashboard({ currentUser, token, onNavigate, onPlayStory, onViewProfile, onShowNotifications }: HomeDashboardProps) {
  const [promptIndex, setPromptIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  
  // Post Creator States
  const [postText, setPostText] = useState('');
  const [postCategory, setPostCategory] = useState('Cultural');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [creatingPost, setCreatingPost] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [archivedPostIds, setArchivedPostIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('archived_posts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleArchivePostToggle = (postId: string, postObj: any) => {
    try {
      let updatedList = [...archivedPostIds];
      if (updatedList.includes(postId)) {
        updatedList = updatedList.filter(id => id !== postId);
        localStorage.removeItem(`archived_post_obj_${postId}`);
      } else {
        updatedList.push(postId);
        localStorage.setItem(`archived_post_obj_${postId}`, JSON.stringify(postObj));
      }
      setArchivedPostIds(updatedList);
      localStorage.setItem('archived_posts', JSON.stringify(updatedList));
    } catch (err) {
      console.error(err);
    }
  };

  // Reflections (Comments) States & Handlers
  const [expandedCommentsPostIds, setExpandedCommentsPostIds] = useState<string[]>([]);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  const toggleComments = (postId: string) => {
    setExpandedCommentsPostIds(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    try {
      await addPostComment(token, postId, text);
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      await loadFeedData();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this reflection?')) return;
    try {
      await deletePostComment(token, postId, commentId);
      await loadFeedData();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const loadFeedData = async () => {
    try {
      setLoading(true);
      setError('');

      try {
        const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';
        const usersRes = await fetch(`${userServiceUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersList = JSON.stringify(usersData.users || []);
          localStorage.setItem('users_list', usersList);
          sessionStorage.setItem('users_list', usersList);
        }
      } catch (err) {
        console.warn('Failed to refresh user list in loadFeedData:', err);
      }
      
      // 1. Load oral history stories / memoirs
      const storiesData = await getStories(token, 1, 10);
      const stories = (storiesData.stories || []).map((s: any) => ({
        ...s,
        feedType: 'story',
        createdAt: s.createdAt || new Date().toISOString()
      }));

      // 2. Load articles & feed posts
      const feedData = await getFeed(token, 1, 20);
      const posts = (feedData.posts || []).map((p: any) => ({
        ...p,
        feedType: 'post',
        createdAt: p.createdAt || new Date().toISOString()
      }));

      // 3. Combine and sort chronologically (newest first)
      const combined = [...stories, ...posts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setFeedItems(combined);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Could not connect to Content Service. Make sure it is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    if (file.type.startsWith('image/')) {
      setMediaType('image');
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType(null);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !mediaFile) return;

    setCreatingPost(true);
    setError('');

    try {
      if (mediaFile) {
        // Create media post (Image/Video)
        await createMediaPost(token, mediaFile, {
          content: postText,
          category: postCategory,
          title: `Post by ${currentUser.name}`,
          tags: 'social, roots'
        });
      } else {
        // Create text post
        await createTextPost(token, {
          content: postText,
          category: postCategory,
          title: `Post by ${currentUser.name}`,
          tags: ['social', 'roots']
        });
      }

      // Reset Form
      setPostText('');
      setMediaFile(null);
      setMediaType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload feed
      await loadFeedData();
    } catch (err: any) {
      console.error('Post creation error:', err);
      setError('Failed to share post. Try again.');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleNextPrompt = () => {
    setPromptIndex((prev) => (prev + 1) % MEMOIR_PROMPTS.length);
  };

  const handlePrevPrompt = () => {
    setPromptIndex((prev) => (prev - 1 + MEMOIR_PROMPTS.length) % MEMOIR_PROMPTS.length);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-dark)]">
      
      {/* Centered timeline container matching Instagram/Facebook layout */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-24">
        
        {/* Welcome Hero Banner */}
        <header className="relative p-6 rounded-3xl overflow-hidden glass border border-white/5 flex flex-col justify-between shadow-lg">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-80 h-80 rounded-full opacity-5 blur-[100px] pointer-events-none"
               style={{ background: 'var(--primary)' }} />
          
          <div className="flex justify-between items-start relative z-10 w-full">
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase font-bold tracking-widest text-red-500 font-sans" style={{ color: 'var(--primary)' }}>
                Welcome back,
              </span>
              <h2 className="text-2xl font-black font-serif tracking-tight">{currentUser.name}</h2>
            </div>
            {/* Notification Bell Icon */}
            <button 
              onClick={() => onShowNotifications?.()}
              className="relative p-2 rounded-xl border bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] hover:scale-105 active:scale-95 transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
              title="Notifications"
            >
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-white dark:border-stone-900 animate-pulse" />
            </button>
          </div>
          <div className="relative z-10 mt-1">
            <p className="text-xs max-w-lg leading-relaxed text-stone-405" style={{ color: 'var(--text-secondary)' }}>
              Welcome to the Digital Roots platform. Connect with mentors, explore archives, and share ancestral stories in the unified scroll feed.
            </p>
          </div>

          {/* Points & Badges Section */}
          <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-stone-200 dark:border-stone-850 w-full relative z-10 select-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Star size={14} className="fill-amber-500 text-amber-500" />
              <span className="text-xs font-bold">
                {currentUser.legacyCredits ?? 0} Legacy Credits
              </span>
            </div>
            
            {currentUser.badges && currentUser.badges.length > 0 ? (
              currentUser.badges.map((badge, idx) => (
                <div key={idx} className="flex items-center gap-1.25 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-xs font-bold">
                  <Award size={13} />
                  <span>{badge}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-1.25 px-3 py-1.5 rounded-xl bg-stone-500/5 border border-stone-200 dark:border-stone-850 text-stone-450 text-xs">
                <Award size={13} />
                <span>No badges earned yet</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4 relative z-10">
            <button 
              onClick={() => onNavigate('archive')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs bg-red-650 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-red-950/20 cursor-pointer"
              style={{ background: 'var(--primary)' }}>
              Start Recording
              <ArrowRight size={12} />
            </button>
            
            <button 
              onClick={() => onNavigate('wisdom')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
              Browse Wisdom Hub
            </button>
          </div>
        </header>

        {/* Storytelling Prompt Card */}
        <section className="p-5 rounded-3xl bg-[var(--bg-card)] border border-opacity-5 relative shadow-sm"
                 style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between border-b pb-3 mb-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-101/10 text-red-500" style={{ color: 'var(--primary)' }}>
                <Award size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-stone-700 dark:text-stone-300">Storytelling Prompt</h3>
                <p className="text-[9px] text-stone-600 dark:text-stone-500">spark an oral history memoir session</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handlePrevPrompt} className="p-1 rounded-lg border hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
                <ChevronLeft size={12} />
              </button>
              <span className="text-[10px] font-mono font-bold text-stone-600 dark:text-stone-400">
                {promptIndex + 1} / {MEMOIR_PROMPTS.length}
              </span>
              <button onClick={handleNextPrompt} className="p-1 rounded-lg border hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          <div className="py-2.5 px-4 bg-[var(--bg-elevated)] rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-medium italic leading-relaxed text-stone-700 dark:text-stone-300 text-center font-serif py-1">
              "{MEMOIR_PROMPTS[promptIndex]}"
            </p>
          </div>
        </section>

        {/* Dynamic Post Creator Box */}
        <div className="bg-[var(--bg-card)] border rounded-3xl p-5 shadow-sm space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            {(() => {
              const details = getUserAvatarDetails(currentUser.id, currentUser.name);
              return (
                <div 
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br cursor-pointer select-none overflow-hidden ${details.color}`}
                  onClick={() => onViewProfile(currentUser.id)}
                >
                  {details.avatar && (details.avatar.startsWith('http') || details.avatar.startsWith('/') || details.avatar.includes('.')) ? (
                    <img src={resolveMediaUrl(details.avatar)} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    details.initials
                  )}
                </div>
              );
            })()}
            <div className="flex-1">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder={`Share an ancestral memory or ask a question, ${currentUser.name.split(' ')[0]}...`}
                className="w-full bg-transparent border-none outline-none text-xs resize-none text-[var(--text-primary)] h-12 pt-2 leading-relaxed"
              />
            </div>
          </div>

          {/* Media preview */}
          {mediaFile && (
            <div className="relative rounded-2xl overflow-hidden border bg-black max-h-56 flex items-center justify-center" style={{ borderColor: 'var(--border)' }}>
              <button 
                onClick={() => { setMediaFile(null); setMediaType(null); }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black text-white z-10"
              >
                <X size={14} />
              </button>
              {mediaType === 'image' ? (
                <img src={URL.createObjectURL(mediaFile)} alt="preview" className="max-h-56 object-cover w-full" />
              ) : (
                <video src={URL.createObjectURL(mediaFile)} controls className="max-h-56 w-full" />
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-2.5">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-bold text-stone-400 hover:text-white transition-colors"
              >
                <Image size={14} className="text-emerald-500" />
                Photo / Video
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden" 
              />

              <select 
                value={postCategory}
                onChange={(e) => setPostCategory(e.target.value)}
                className="bg-[var(--bg-elevated)] border text-[10px] px-2 py-0.5 rounded outline-none text-stone-700 dark:text-stone-300 font-semibold cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="Cultural">Cultural</option>
                <option value="Educational">Educational</option>
                <option value="Traditional">Traditional</option>
                <option value="History">History</option>
              </select>
            </div>

            <button
              onClick={handleCreatePost}
              disabled={creatingPost || (!postText.trim() && !mediaFile)}
              className="px-4 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-transform disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              {creatingPost ? <Loader className="animate-spin" size={12} /> : null}
              Share Post
            </button>
          </div>
        </div>

        {/* Chronological Scrollable Feed */}
        <div className="space-y-6">
          
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-stone-400">
              <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
              <span className="text-xs">Streaming your social feed...</span>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="py-24 text-center text-xs text-stone-500 bg-[var(--bg-card)] border border-dashed rounded-3xl p-6">
              <p className="font-semibold">Your timeline is empty.</p>
              <p className="text-[10px] mt-1 text-stone-500">Record a memoir or write a post to start the conversation!</p>
            </div>
          ) : (
            feedItems.map((item) => {
              const isPost = item.feedType === 'post';
              const isStory = item.feedType === 'story';
              
              const authorId = isPost ? item.authorId : (item.elderId || item.authorId);
              const authorName = isPost ? item.authorName : (item.elderName || item.authorName || 'Elder');
              const authorRole = isPost ? item.authorRole : 'Elder';
              const { initials, color, avatar } = getUserAvatarDetails(authorId, authorName);
              const timeString = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              
              const isLiked = item.likes?.includes(currentUser.id);
              const isBookmarked = item.bookmarks?.includes(currentUser.id);
 
              return (
                <article 
                  key={isPost ? (item.postId || item.knowledgeId) : item.storyId}
                  className="bg-[var(--bg-card)] border rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow group"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Card Header (Profile + metadata) */}
                  <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br cursor-pointer select-none overflow-hidden ${color}`}
                        onClick={() => onViewProfile(authorId)}
                      >
                        {avatar && (avatar.startsWith('http') || avatar.startsWith('/') || avatar.includes('.')) ? (
                          <img src={resolveMediaUrl(avatar)} alt={authorName} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 
                            className="font-bold text-xs hover:underline cursor-pointer text-stone-850 dark:text-stone-200"
                            onClick={() => onViewProfile(authorId)}
                          >
                            {authorName}
                          </h4>
                          <span className="text-[8px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-stone-850 text-stone-400 border border-stone-700">
                            {authorRole}
                          </span>
                        </div>
                        <p className="text-[9px] text-stone-500 mt-0.5">{timeString} • {item.category || item.culturalCategory || 'Cultural'}</p>
                      </div>
                    </div>

                    <span className="text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded bg-red-105/10 text-red-500 border border-red-500/20" style={{ color: 'var(--primary)' }}>
                      {isPost ? 'Wisdom Post' : 'Memoir Audio'}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4">
                    {item.title && (
                      <h3 className="font-serif font-black text-base leading-snug text-stone-900 dark:text-stone-100">{item.title}</h3>
                    )}

                    {isPost && item.content && (
                      <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{item.content}</p>
                    )}

                    {isStory && item.description && (
                      <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{item.description}</p>
                    )}

                    {/* Image Render */}
                    {isPost && item.type === 'image' && item.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border bg-black/40" style={{ borderColor: 'var(--border)' }}>
                        <img 
                          src={resolveContentUrl(item.mediaUrl)} 
                          alt="Post attachment" 
                          className="w-full object-cover max-h-[380px]" 
                        />
                      </div>
                    )}

                    {/* Video Render */}
                    {isPost && item.type === 'video' && item.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--border)' }}>
                        <video 
                          src={resolveContentUrl(item.mediaUrl)} 
                          controls 
                          preload="metadata"
                          className="w-full object-contain max-h-[380px]" 
                        />
                      </div>
                    )}

                    {/* Audio memoir render (Visualizer player layout) */}
                    {isStory && (
                      <div className="space-y-3">
                        {/* Audio memoir render (Visualizer player layout) */}
                        {(item.mediaType === 'audio' || (!item.mediaType && item.audioUrl)) && item.audioUrl && (
                          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
                            <button 
                              onClick={() => onPlayStory(item)}
                              className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-stone-900 shadow-md hover:scale-105 transition-all flex-shrink-0"
                            >
                              <Play size={16} className="fill-stone-900 ml-0.5" />
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Oral History Session</p>
                              <p className="text-xs text-stone-750 dark:text-stone-300 truncate mt-0.5">Duration: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')} mins</p>
                            </div>
                            
                            <button 
                              onClick={() => onNavigate('archive')}
                              className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline"
                            >
                              Read Transcript
                            </button>
                          </div>
                        )}

                        {/* Image memoir render */}
                        {item.mediaType === 'image' && item.mediaUrl && (
                          <div className="rounded-2xl overflow-hidden border bg-black/40" style={{ borderColor: 'var(--border)' }}>
                            <img 
                              src={resolveContentUrl(item.mediaUrl)} 
                              alt={item.title || "Memoir Image"} 
                              className="w-full object-cover max-h-[380px]" 
                            />
                          </div>
                        )}

                        {/* Video memoir render */}
                        {item.mediaType === 'video' && item.mediaUrl && (
                          <div className="rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--border)' }}>
                            <video 
                              src={resolveContentUrl(item.mediaUrl)} 
                              controls 
                              preload="metadata"
                              className="w-full object-contain max-h-[380px]" 
                            />
                          </div>
                        )}

                        {/* Document memoir render */}
                        {item.mediaType === 'document' && item.mediaUrl && (
                          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0">
                                <FileText size={20} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] text-stone-450 font-bold uppercase tracking-wider">Historical Document</p>
                                <p className="text-xs text-stone-750 dark:text-stone-300 truncate font-semibold mt-0.5">
                                  {item.title || "Document Archive"}
                                </p>
                              </div>
                            </div>
                            
                            <a 
                              href={resolveContentUrl(item.mediaUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline flex-shrink-0"
                            >
                              Open File
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Engagement Controls Footer */}
                  <div className="px-5 py-3 border-t flex items-center justify-between text-[var(--text-muted)] text-xs" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex gap-4">
                      {/* Likes count display */}
                      <span className="flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform hover:text-[var(--text-primary)]">
                        <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                        <span>{item.likes?.length || 0}</span>
                      </span>
                      
                      <span className="flex items-center gap-1 cursor-default">
                        <Eye size={14} />
                        <span>{item.views || 0}</span>
                      </span>

                      {item.comments && (
                        <button 
                          onClick={() => toggleComments(isPost ? (item.postId || item.knowledgeId) : item.storyId)}
                          className={`flex items-center gap-1 hover:text-[var(--primary)] hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                            expandedCommentsPostIds.includes(isPost ? (item.postId || item.knowledgeId) : item.storyId) ? 'text-[var(--primary)] font-bold' : ''
                          }`}
                        >
                          <MessageSquare size={14} />
                          <span>{item.comments.length}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Share tracker mock */}
                      <span className="flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform hover:text-[var(--text-primary)]" title="Shares count">
                        <Share2 size={13} />
                        <span>{item.shares || 0}</span>
                      </span>

                      <button 
                        onClick={() => handleArchivePostToggle(isPost ? (item.postId || item.knowledgeId) : item.storyId, item)}
                        className="p-1 rounded hover:bg-[var(--bg-elevated)] hover:scale-110 transition-all cursor-pointer"
                        title="Archive post to personal tab"
                      >
                        <Bookmark 
                          size={14} 
                          className={archivedPostIds.includes(isPost ? (item.postId || item.knowledgeId) : item.storyId) ? "fill-amber-500 text-amber-500" : ""} 
                        />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Comments/Reflections Section */}
                  {expandedCommentsPostIds.includes(isPost ? (item.postId || item.knowledgeId) : item.storyId) && (
                    <div className="px-5 pb-5 pt-3 border-t bg-[var(--bg-elevated)]/20 space-y-4" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                        <h4 className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                          Reflections ({item.comments?.length || 0})
                        </h4>
                      </div>

                      {/* Comments list */}
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {(!item.comments || item.comments.length === 0) ? (
                          <p className="text-[11px] text-[var(--text-muted)] italic py-2">No reflections shared yet. Be the first to share your thoughts!</p>
                        ) : (
                          item.comments.map((comment: any, idx: number) => {
                            const commentDetails = getUserAvatarDetails(comment.userId, comment.userName);
                            const commentTime = new Date(comment.timestamp || comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const isCommentAuthor = comment.userId === currentUser.id;

                            return (
                              <div key={comment._id || comment.commentId || idx} className="flex gap-2.5 items-start text-xs group/comment">
                                <div 
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br cursor-pointer select-none overflow-hidden flex-shrink-0 ${commentDetails.color}`}
                                  onClick={() => onViewProfile(comment.userId)}
                                >
                                  {commentDetails.avatar && (commentDetails.avatar.startsWith('http') || commentDetails.avatar.startsWith('/') || commentDetails.avatar.includes('.')) ? (
                                    <img src={resolveMediaUrl(commentDetails.avatar)} alt={comment.userName} className="w-full h-full object-cover" />
                                  ) : (
                                    commentDetails.initials
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 bg-[var(--bg-card)] p-2.5 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-[11px] hover:underline cursor-pointer text-[var(--text-primary)]" onClick={() => onViewProfile(comment.userId)}>
                                        {comment.userName}
                                      </span>
                                      <span className="text-[9px] text-[var(--text-muted)]">{commentTime}</span>
                                    </div>
                                    {isCommentAuthor && (
                                      <button
                                        onClick={() => handleDeleteComment(isPost ? (item.postId || item.knowledgeId) : item.storyId, comment._id || comment.commentId)}
                                        className="opacity-0 group-hover/comment:opacity-100 p-0.5 rounded text-red-500 hover:bg-red-500/10 transition-all cursor-pointer flex items-center justify-center"
                                        title="Delete reflection"
                                      >
                                        <X size={12} />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add comment Form */}
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const pId = isPost ? (item.postId || item.knowledgeId) : item.storyId;
                          handleAddComment(pId);
                        }} 
                        className="flex gap-2 items-center"
                      >
                        <input
                          type="text"
                          placeholder="Share a reflection..."
                          value={commentTexts[isPost ? (item.postId || item.knowledgeId) : item.storyId] || ''}
                          onChange={(e) => {
                            const pId = isPost ? (item.postId || item.knowledgeId) : item.storyId;
                            setCommentTexts(prev => ({ ...prev, [pId]: e.target.value }));
                          }}
                          className="flex-grow px-3 py-2 text-xs rounded-xl outline-none border transition-colors bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border)] focus:border-[var(--primary)]"
                        />
                        <button
                          type="submit"
                          disabled={submittingComment[isPost ? (item.postId || item.knowledgeId) : item.storyId] || !commentTexts[isPost ? (item.postId || item.knowledgeId) : item.storyId]?.trim()}
                          className="px-4 py-2 rounded-xl text-white font-bold text-xs hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:scale-100 flex-shrink-0"
                          style={{ background: 'var(--primary)' }}
                        >
                          Reflect
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })
          )}

        </div>

      </div>

    </div>
  );
}
