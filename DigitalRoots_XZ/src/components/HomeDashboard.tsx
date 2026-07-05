import { useState, useEffect, useRef } from 'react';
import { BookOpen, Award, ArrowRight, Play, Heart, Star, Eye, MessageSquare, Share2, Bookmark, Image, Video, Plus, X, Loader, AlertCircle, FileText, Headphones, Camera, Film, AlignLeft, ShieldAlert, Trash2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  getStories, getFeed, getArticles, createTextPost, createMediaPost, 
  resolveContentUrl, likePostComment, addPostComment, deletePostComment, 
  getStoryDetails, getArticleDetails, likeStory, unlikeStory, 
  likeArticle, unlikeArticle, addPostReaction, removePostReaction, 
  sharePost, getPost, flagPost, deletePost 
} from '../contentApi';
import { resolveMediaUrl } from '../api';
import type { User } from '../types';

interface HomeDashboardProps {
  currentUser: User;
  token: string;
  onNavigate: (tab: any) => void;
  onPlayStory: (story: any) => void;
  onViewProfile: (userId: string) => void;
  onShowNotifications?: () => void;
}

const CATEGORIES = [
  'Cultural', 'Traditional', 'History', 'Educational', 'Tech',
  'Career', 'Business', 'Finance', 'Health', 'Sports',
  'Travel', 'Music', 'Arts', 'Community', 'Environment'
];

function isItemInCategory(item: any, filterCategory: string): boolean {
  const filter = filterCategory.toLowerCase();
  
  // Media type filters
  if (filter === 'audio memoir') return item.feedType === 'story' && (!item.mediaType || item.mediaType === 'audio');
  if (filter === 'photo') return (item.feedType === 'story' && item.mediaType === 'image') || (item.feedType === 'post' && item.type === 'image');
  if (filter === 'video') return (item.feedType === 'story' && item.mediaType === 'video') || (item.feedType === 'post' && item.type === 'video');
  if (filter === 'article') return item.feedType === 'article';
  
  const itemCategory = (item.category || '').toLowerCase();
  const itemCulturalCategory = (item.culturalCategory || '').toLowerCase();
  
  const checkAlias = (catName: string) => {
    const c = catName.toLowerCase();
    if (filter === 'tech' || filter === 'technology' || filter === 'technical') {
      return c === 'tech' || c === 'technology' || c === 'technical';
    }
    if (filter === 'educational' || filter === 'education') {
      return c === 'educational' || c === 'education';
    }
    if (filter === 'cultural' || filter === 'culture') {
      return c === 'cultural' || c === 'culture';
    }
    if (filter === 'traditional' || filter === 'traditions') {
      return c === 'traditional' || c === 'traditions';
    }
    return c === filter;
  };

  // 1. If post or article has category matching filter
  if (itemCategory && checkAlias(itemCategory)) return true;

  const itemCategories = item.categories || [];
  if (itemCategories.some((c: string) => checkAlias(c))) return true;
  
  // 2. Dynamic mapping for oral stories / memoirs (using culturalCategory)
  if (itemCulturalCategory) {
    if (filter === 'cultural' || filter === 'culture') {
      return ['tale', 'recipe', 'proverb', 'ritual', 'traditional_song', 'craft', 'mythology'].includes(itemCulturalCategory);
    }
    if (filter === 'traditional' || filter === 'traditions') {
      return ['proverb', 'ritual', 'traditional_song', 'craft', 'medicine'].includes(itemCulturalCategory);
    }
    if (filter === 'history') {
      return itemCulturalCategory === 'history';
    }
    if (filter === 'career' || filter === 'educational' || filter === 'education') {
      return itemCulturalCategory === 'life_lesson';
    }
    if (filter === 'music') {
      return itemCulturalCategory === 'traditional_song';
    }
    if (filter === 'recipe' || filter === 'food') {
      return itemCulturalCategory === 'recipe';
    }
    if (itemCulturalCategory === filter) return true;
  }
  
  // 3. Tags matching logic fallback
  const tagsMatch = (item.tags || []).some((t: string) => {
    const tag = t.toLowerCase();
    if (tag === filter) return true;
    if (filter === 'tech' || filter === 'technology') return tag === 'tech' || tag === 'technology';
    return tag.includes(filter);
  });
  
  return tagsMatch;
}


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

// Returns a label + icon for any media type
function getMediaTypeMeta(feedType: string, mediaType?: string, type?: string): { label: string; Icon: any; color: string } {
  if (feedType === 'article') return { label: 'Article', Icon: AlignLeft, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
  if (feedType === 'story') {
    if (mediaType === 'video') return { label: 'Video Memoir', Icon: Film, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    if (mediaType === 'image') return { label: 'Photo Memoir', Icon: Camera, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (mediaType === 'document') return { label: 'Document', Icon: FileText, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Audio Memoir', Icon: Headphones, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
  }
  // post
  if (type === 'video') return { label: 'Video Post', Icon: Film, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
  if (type === 'image') return { label: 'Photo Post', Icon: Camera, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  return { label: 'Wisdom Post', Icon: AlignLeft, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
}

export default function HomeDashboard({ currentUser, token, onNavigate, onPlayStory, onViewProfile, onShowNotifications }: HomeDashboardProps) {
  const { t } = useTranslation();
  const currentUserId = currentUser.id || (currentUser as any)._id || '';
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  
  // Post Creator States
  const [postText, setPostText] = useState('');
  const [postCategories, setPostCategories] = useState<string[]>(['Cultural']);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video'; item: any } | null>(null);

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

  const toggleComments = async (postId: string) => {
    const isExpanding = !expandedCommentsPostIds.includes(postId);
    if (isExpanding) {
      // Optimistically increment views locally
      setFeedItems(prev => prev.map(fi => 
        (fi.postId === postId || fi.knowledgeId === postId || fi.storyId === postId)
          ? { ...fi, views: (fi.views || 0) + 1, viewCount: (fi.viewCount || 0) + 1 }
          : fi
      ));

      const feedItem = feedItems.find(item => (item.postId === postId || item.knowledgeId === postId || item.storyId === postId));
      if (feedItem) {
        try {
          if (feedItem.feedType === 'post') {
            getPost(token, postId).catch(() => {});
          } else if (feedItem.feedType === 'article') {
            getArticleDetails(token, postId).catch(() => {});
          } else if (feedItem.feedType === 'story') {
            getStoryDetails(token, postId).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to register content view:', err);
        }
      }
    }
    setExpandedCommentsPostIds(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  const handleLikeToggle = async (item: any) => {
    const isPost = item.feedType === 'post';
    const isArticle = item.feedType === 'article';
    const isStory = item.feedType === 'story';

    // ── Optimistic UI update ──────────────────────────────────────────────────
    // Update local state immediately so the heart fills/unfills without waiting
    // for a server round-trip through the potentially-cached feed endpoint.
    setFeedItems(prev => prev.map(fi => {
      if (isPost && fi.postId === item.postId) {
        const isLiked = fi.reactions?.find((r: any) => r.type === 'like')?.userIds.includes(currentUserId);
        const updatedReactions = fi.reactions ? fi.reactions.map((r: any) => {
          if (r.type !== 'like') return r;
          const userIds = isLiked
            ? r.userIds.filter((id: string) => id !== currentUserId)
            : [...r.userIds, currentUserId];
          return { ...r, userIds };
        }) : [{ type: 'like', userIds: [currentUserId] }];
        // Ensure 'like' reaction exists even if reactions array was empty
        const hasLikeReaction = updatedReactions.some((r: any) => r.type === 'like');
        if (!hasLikeReaction && !isLiked) {
          updatedReactions.push({ type: 'like', userIds: [currentUserId] });
        }
        return { ...fi, reactions: updatedReactions };
      }
      if ((isArticle && (fi.knowledgeId === item.knowledgeId || fi.postId === item.postId)) ||
          (isStory && fi.storyId === item.storyId)) {
        const isLiked = fi.likes?.includes(currentUserId);
        const likes = isLiked
          ? (fi.likes || []).filter((id: string) => id !== currentUserId)
          : [...(fi.likes || []), currentUserId];
        return { ...fi, likes };
      }
      return fi;
    }));

    // ── Server call (background) ──────────────────────────────────────────────
    try {
      if (isPost) {
        const isLiked = item.reactions?.find((r: any) => r.type === 'like')?.userIds.includes(currentUserId);
        if (isLiked) {
          await removePostReaction(token, item.postId);
        } else {
          await addPostReaction(token, item.postId, 'like');
        }
      } else if (isArticle) {
        const isLiked = item.likes?.includes(currentUserId);
        if (isLiked) {
          await unlikeArticle(token, item.knowledgeId || item.postId);
        } else {
          await likeArticle(token, item.knowledgeId || item.postId);
        }
      } else if (isStory) {
        const isLiked = item.likes?.includes(currentUserId);
        if (isLiked) {
          await unlikeStory(token, item.storyId);
        } else {
          await likeStory(token, item.storyId);
        }
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert optimistic update on failure by reloading
      await loadFeedData();
    }
  };

  const handleTrackView = async (item: any) => {
    const id = item.postId || item.knowledgeId || item.storyId;
    if (!id) return;
    
    // Optimistic view count increment
    setFeedItems(prev => prev.map(fi => {
      const match = (fi.postId === id || fi.knowledgeId === id || fi.storyId === id);
      if (match) {
        if (fi.feedType === 'story') {
          return { ...fi, viewCount: (fi.viewCount || 0) + 1 };
        } else {
          return { ...fi, views: (fi.views || 0) + 1 };
        }
      }
      return fi;
    }));

    // Server-side view registration in background
    try {
      if (item.feedType === 'post') {
        getPost(token, id).catch(() => {});
      } else if (item.feedType === 'article') {
        getArticleDetails(token, id).catch(() => {});
      } else if (item.feedType === 'story') {
        getStoryDetails(token, id).catch(() => {});
      }
    } catch {}
  };


  const handleSharePost = async (item: any) => {
    try {
      if (item.feedType === 'post') {
        await sharePost(token, item.postId);
        // In-place share count update — no re-sort
        setFeedItems(prev => prev.map(fi =>
          fi.postId === item.postId ? { ...fi, shares: (fi.shares || 0) + 1 } : fi
        ));
      }
      const shareUrl = `${window.location.origin}/content/${item.postId || item.storyId || item.knowledgeId}`;
      await navigator.clipboard.writeText(shareUrl);
      alert(t('homeArchivedAlert'));
    } catch (err) {
      console.error('Failed to share:', err);
    }
  };

  const handleFlagPost = async (item: any) => {
    if (item.feedType !== 'post') return;
    if (!window.confirm('Are you sure you want to flag this post as inappropriate?')) return;
    try {
      await flagPost(token, item.postId);
      // In-place flag update — no re-sort
      setFeedItems(prev => prev.map(fi =>
        fi.postId === item.postId ? { ...fi, isFlagged: true } : fi
      ));
      alert('Content successfully flagged for admin review.');
    } catch (err) {
      console.error('Failed to flag post:', err);
      alert('Error flagging content. Please try again.');
    }
  };

  const handleDeletePost = async (item: any) => {
    if (item.feedType !== 'post') return;
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(token, item.postId);
      // Remove from local state — no re-sort
      setFeedItems(prev => prev.filter(fi => fi.postId !== item.postId));
      alert('Post successfully deleted.');
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert('Error deleting post. Please try again.');
    }
  };
 
  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    setSubmittingComment(prev => ({ ...prev, [postId]: true }));
    try {
      const result = await addPostComment(token, postId, text);
      // Append comment in-place — no re-sort
      const newComment = result.comment;
      if (newComment) {
        setFeedItems(prev => prev.map(fi => {
          if (fi.postId === postId || fi.knowledgeId === postId || fi.storyId === postId) {
            return { ...fi, comments: [...(fi.comments || []), newComment] };
          }
          return fi;
        }));
      }
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
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
      // Remove comment in-place — no re-sort
      setFeedItems(prev => prev.map(fi => {
        if (fi.postId === postId || fi.knowledgeId === postId || fi.storyId === postId) {
          return { ...fi, comments: (fi.comments || []).filter((c: any) => (c._id || c.commentId) !== commentId) };
        }
        return fi;
      }));
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
      
      // 1. Load oral history stories / memoirs (all media types)
      const storiesData = await getStories(token, 1, 20);
      const stories = (storiesData.stories || []).map((s: any) => ({
        ...s,
        feedType: 'story',
        createdAt: s.createdAt || new Date().toISOString()
      }));

      // 2. Load ranked social posts from feed service
      const feedData = await getFeed(token, 1, 30);
      const posts = (feedData.posts || []).map((p: any) => ({
        ...p,
        feedType: 'post',
        createdAt: p.createdAt || new Date().toISOString()
      }));

      // 3. Load published knowledge articles from Wisdom Hub
      let articles: any[] = [];
      try {
        const articlesData = await getArticles(token, 1, 20);
        articles = (articlesData.articles || []).map((a: any) => ({
          ...a,
          feedType: 'article',
          // Normalize ID so engagement controls work uniformly
          postId: a.knowledgeId,
          createdAt: a.createdAt || new Date().toISOString()
        }));
      } catch (err) {
        console.warn('Failed to load articles for feed:', err);
      }

      // Get the list of users to look up details for authors
      const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
      const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];

      // 4. Combine and sort by scored ranking first, then chronologically (newest first)
      const combined = [...stories, ...posts, ...articles].map((item) => {
        let score = item.feedScore || 0;

        // Interest Category Preference Match (+50)
        let matchesPref = false;
        if (currentUser.contentPreferences && currentUser.contentPreferences.length > 0) {
          for (const pref of currentUser.contentPreferences) {
            if (isItemInCategory(item, pref)) {
              matchesPref = true;
              break;
            }
          }
        }
        if (matchesPref) {
          score += 50;
        }

        // Language Match (+30)
        const itemLang = item.language || 'English';
        if (currentUser.languages && currentUser.languages.some(lang => {
          const l1 = lang.toLowerCase();
          const l2 = itemLang.toLowerCase();
          return l1 === l2 || l1.startsWith(l2) || l2.startsWith(l1);
        })) {
          score += 30;
        }

        // Community Match (+25)
        const authorId = item.authorId || item.elderId || '';
        const authorUser = dynamicUsers.find(u => u.id === authorId || u._id === authorId || u.firebaseUid === authorId || u.firebase_uid === authorId);
        const itemCommunity = item.authorCommunity || item.community || authorUser?.community;
        if (currentUser.community && itemCommunity && currentUser.community.toLowerCase() === itemCommunity.toLowerCase()) {
          score += 25;
        }

        return { ...item, feedScore: score };
      }).sort((a, b) => {
        if (b.feedScore !== a.feedScore) {
          return b.feedScore - a.feedScore;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

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
    const newFiles = Array.from(e.target.files || []).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (newFiles.length === 0) return;
    setMediaFiles(prev => {
      // Deduplicate by name+size
      const existing = new Set(prev.map(f => f.name + f.size));
      const unique = newFiles.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...unique].slice(0, 10); // max 10
    });
    // Reset input value so same file can be re-selected after removal
    e.target.value = '';
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && mediaFiles.length === 0) return;

    setCreatingPost(true);
    setError('');

    try {
      if (mediaFiles.length > 0) {
        // Create media post (Image/Video — multi-file supported)
        await createMediaPost(token, mediaFiles, {
          content: postText,
          category: postCategories[0],
          categories: postCategories,
          title: `Post by ${currentUser.name}`,
          tags: 'social, roots'
        });
      } else {
        // Create text post
        await createTextPost(token, {
          content: postText,
          category: postCategories[0],
          categories: postCategories,
          title: `Post by ${currentUser.name}`,
          tags: ['social', 'roots']
        });
      }

      // Reset Form
      setPostText('');
      setPostCategories(['Cultural']);
      setMediaFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload feed — legitimate full refresh after creation
      await loadFeedData();
    } catch (err: any) {
      console.error('Post creation error:', err);
      setError('Failed to share post. Try again.');
    } finally {
      setCreatingPost(false);
    }
  };


  // Build filter chip list: 'All' + user's interests + content types
  const interestChips = ['All', ...(currentUser.contentPreferences || []).slice(0, 8), 'Audio Memoir', 'Photo', 'Video', 'Article'];
  const uniqueChips = Array.from(new Set(interestChips));

  // Apply active filter locally — no network call
  const displayedFeed = activeFilter === 'All'
    ? feedItems
    : feedItems.filter((item) => isItemInCategory(item, activeFilter));

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-dark)]">
      
      {/* Centered timeline container matching Instagram/Facebook layout */}
      <div className="max-w-2xl mx-auto px-2 xs:px-4 py-4 xs:py-8 space-y-4 xs:space-y-8 pb-24">
        
        {/* Welcome Hero Banner */}
        <header className="relative p-4 xs:p-6 rounded-2xl xs:rounded-3xl overflow-hidden glass border border-white/5 flex flex-col justify-between shadow-lg">
          <div className="absolute top-1/2 right-10 -translate-y-1/2 w-80 h-80 rounded-full opacity-5 blur-[100px] pointer-events-none"
               style={{ background: 'var(--primary)' }} />
                   <div className="flex justify-between items-start relative z-10 w-full">
            <div className="space-y-1.5">
              <span className="text-[9px] uppercase font-bold tracking-widest text-red-500 font-sans" style={{ color: 'var(--primary)' }}>
                {t('homeWelcomeBack')}
              </span>
              <h2 className="text-xl xs:text-2xl font-black font-serif tracking-tight">{currentUser.name}</h2>
            </div>
          </div>
          <div className="relative z-10 mt-1">
            <p className="text-xs max-w-lg leading-relaxed text-stone-405" style={{ color: 'var(--text-secondary)' }}>
              Welcome to the Digital Roots platform. Connect across generations, seek mentorship, and share wisdom and life experiences in the unified scroll feed.
            </p>
          </div>

          {/* Points & Badges Section */}
          <div className="flex flex-wrap gap-2.5 mt-4 pt-4 border-t border-stone-200 dark:border-stone-850 w-full relative z-10 select-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Star size={14} className="fill-amber-500 text-amber-500" />
              <span className="text-xs font-bold">
                {currentUser.legacyCredits ?? 0} {t('homeCreditsLabel')}
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
                <span>{t('homeNoBadges')}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4 relative z-10">
            <button 
              onClick={() => onNavigate('archive')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs bg-red-650 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-red-950/20 cursor-pointer"
              style={{ background: 'var(--primary)' }}>
              {t('homeStartRecording')}
              <ArrowRight size={12} />
            </button>
            
            <button 
              onClick={() => onNavigate('wisdom')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
              {t('homeBrowseWisdom')}
            </button>
          </div>
        </header>


        {/* Dynamic Post Creator Box */}
        <div className="bg-[var(--bg-card)] border rounded-2xl xs:rounded-3xl p-3 xs:p-5 shadow-sm space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            {(() => {
              const details = getUserAvatarDetails(currentUserId, currentUser.name);
              return (
                <div 
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br cursor-pointer select-none overflow-hidden ${details.color}`}
                  onClick={() => onViewProfile(currentUserId)}
                >
                  {details.avatar && !imgError['me'] && (details.avatar.startsWith('http') || details.avatar.startsWith('/') || details.avatar.includes('.')) ? (
                    <img 
                      src={resolveMediaUrl(details.avatar)} 
                      alt={currentUser.name} 
                      className="w-full h-full object-cover" 
                      onError={() => setImgError(prev => ({ ...prev, me: true }))}
                    />
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
                placeholder={`${t('homeSharePlaceholder')}, ${currentUser.name.split(' ')[0]}...`}
                className="w-full bg-transparent border-none outline-none text-xs resize-none text-[var(--text-primary)] h-12 pt-2 leading-relaxed"
              />
            </div>
          </div>

          {/* Media previews */}
          {mediaFiles.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" style={{ borderColor: 'var(--border)' }}>
              {mediaFiles.map((file, idx) => {
                const isImage = file.type.startsWith('image/');
                const url = URL.createObjectURL(file);
                return (
                  <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border bg-black flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <button 
                      type="button"
                      onClick={() => {
                        setMediaFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black text-white z-10 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                    {isImage ? (
                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <video src={url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center animate-fade-in">
                          <Film size={16} className="text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] flex items-center gap-1.5">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Categories select pills */}
          <div className="flex flex-col gap-1.5 pt-2.5 text-left border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400">
              {t('homeSelectCategory', 'Categories')}
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-none py-0.5">
              {CATEGORIES.map(cat => {
                const isSelected = postCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (postCategories.length > 1) {
                          setPostCategories(prev => prev.filter(c => c !== cat));
                        }
                      } else {
                        setPostCategories(prev => [...prev, cat]);
                      }
                    }}
                    className={`text-[9px] px-2.5 py-1 rounded-full border transition-all cursor-pointer font-bold ${
                      isSelected 
                        ? 'text-white border-transparent scale-105' 
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white hover:bg-stone-850'
                    }`}
                    style={{ 
                      borderColor: isSelected ? 'transparent' : 'var(--border)',
                      backgroundColor: isSelected ? 'var(--primary)' : undefined
                    }}
                  >
                    {t('cat_' + cat, cat)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-2.5">
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-bold text-stone-400 hover:text-white transition-colors"
              >
                <Image size={14} className="text-emerald-500" />
                {t('homePhotoVideo')}
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden" 
              />
            </div>

            <button
              onClick={handleCreatePost}
              disabled={creatingPost || (!postText.trim() && mediaFiles.length === 0)}
              className="px-4 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-transform disabled:opacity-40"
              style={{ background: 'var(--primary)' }}
            >
              {creatingPost ? <Loader className="animate-spin" size={12} /> : null}
              {t('homeSharePostButton')}
            </button>
          </div>
        </div>

        {/* ── Interest Filter Chips ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {uniqueChips.map((chip) => {
            const getTranslatedFilterName = (filterName: string) => {
              if (filterName === 'All') return t('all', 'All');
              if (filterName === 'Audio Memoir') return t('audioMemoir', 'Audio Memoir');
              if (filterName === 'Photo') return t('photo', 'Photo');
              if (filterName === 'Video') return t('video', 'Video');
              if (filterName === 'Article') return t('article', 'Article');
              return t('cat_' + filterName, filterName);
            };
            return (
              <button
                key={chip}
                onClick={() => setActiveFilter(chip)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  activeFilter === chip
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                    : 'bg-[var(--bg-card)] text-stone-400 border-[var(--border)] hover:border-[var(--primary)]/40 hover:text-[var(--text-primary)]'
                }`}
              >
                {getTranslatedFilterName(chip)}
              </button>
            );
          })}
        </div>

        {/* Chronological Scrollable Feed */}
        <div className="space-y-6">
          
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-stone-400">
              <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
              <span className="text-xs">{t('loading')}</span>
            </div>
          ) : displayedFeed.length === 0 ? (
            <div className="py-24 text-center text-xs text-stone-500 bg-[var(--bg-card)] border border-dashed rounded-3xl p-6">
              <p className="font-semibold">
                {activeFilter === 'All' ? t('homeTimelineEmpty') : `${t('homeNoContentFilter')}${(() => {
                  if (activeFilter === 'All') return t('all', 'All');
                  if (activeFilter === 'Audio Memoir') return t('audioMemoir', 'Audio Memoir');
                  if (activeFilter === 'Photo') return t('photo', 'Photo');
                  if (activeFilter === 'Video') return t('video', 'Video');
                  if (activeFilter === 'Article') return t('article', 'Article');
                  return t('cat_' + activeFilter, activeFilter);
                })()}.`}
              </p>
              <p className="text-[10px] mt-1 text-stone-500">{activeFilter === 'All' ? t('homeTimelineEmptyDesc') : ''}</p>
            </div>
          ) : (
            displayedFeed.map((item) => {
              const isPost = item.feedType === 'post';
              const isStory = item.feedType === 'story';
              const isArticle = item.feedType === 'article';

              // ── Article card (Wisdom Hub knowledge) ──────────────
              if (isArticle) {
                const { initials: aInit, color: aColor, avatar: aAvatar } = getUserAvatarDetails(item.authorId, item.authorName);
                const aTime = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const { label: aLabel, Icon: AIcon, color: aTagColor } = getMediaTypeMeta('article');
                return (
                  <article
                    key={item.knowledgeId}
                    className="bg-[var(--bg-card)] border rounded-3xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow group cursor-pointer"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={() => {
                      getArticleDetails(token, item.knowledgeId).catch(err => console.error(err));
                      onNavigate('wisdom');
                    }}
                  >
                    {item.coverImage && (
                      <div className="h-40 overflow-hidden flex-shrink-0 relative">
                        <img src={resolveContentUrl(item.coverImage)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    )}
                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded border flex items-center gap-1 ${aTagColor}`}>
                            <AIcon size={10} /> {aLabel}
                          </span>
                          <span className="text-[9px] text-stone-500">{aTime}</span>
                        </div>
                        <h3 className="font-serif font-black text-sm leading-snug text-stone-900 dark:text-stone-100 group-hover:text-[var(--primary)] transition-colors">{item.title}</h3>
                        {item.summary && <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">{item.summary}</p>}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br overflow-hidden ${aColor}`}>
                            {aAvatar && !imgError[`author_${item.authorId || item.storyId || item.knowledgeId || item._id || ''}`] && (aAvatar.startsWith('http') || aAvatar.startsWith('/') || aAvatar.includes('.')) ? (
                              <img 
                                src={resolveMediaUrl(aAvatar)} 
                                alt={item.authorName} 
                                className="w-full h-full object-cover" 
                                onError={() => setImgError(prev => ({ ...prev, [`author_${item.authorId || item.storyId || item.knowledgeId || item._id || ''}`]: true }))}
                              />
                            ) : aInit}
                          </div>
                          <span className="text-[10px] font-semibold text-stone-500">{item.authorName}</span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--primary)] hover:underline">
                          <Eye size={11} /> {item.views || 0} · {t('wisdomReadMore')}
                          <ArrowRight size={11} />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              }

              // ── Story / Post card ────────────────────────────────
              const authorId = isPost ? item.authorId : (item.elderId || item.authorId);
              const authorName = isPost ? item.authorName : (item.elderName || item.authorName || 'Elder');
              const authorRole = isPost ? item.authorRole : 'Elder';
              const { initials, color, avatar } = getUserAvatarDetails(authorId, authorName);
              const timeString = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              const { label: mediaLabel, Icon: MediaIcon, color: mediaTagColor } = getMediaTypeMeta(item.feedType, item.mediaType, item.type);
              
              const isLiked = isPost 
                ? (item.reactions?.find((r: any) => r.type === 'like')?.userIds.includes(currentUserId))
                : (item.likes?.includes(currentUserId));
              const likesCount = isPost
                ? (item.reactions?.find((r: any) => r.type === 'like')?.userIds.length || 0)
                : (item.likes?.length || 0);
              const isBookmarked = item.bookmarks?.includes(currentUserId);
 
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
                        {avatar && !imgError[`author_${authorId || ''}`] && (avatar.startsWith('http') || avatar.startsWith('/') || avatar.includes('.')) ? (
                          <img 
                            src={resolveMediaUrl(avatar)} 
                            alt={authorName} 
                            className="w-full h-full object-cover" 
                            onError={() => setImgError(prev => ({ ...prev, [`author_${authorId || ''}`]: true }))}
                          />
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

                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded border flex items-center gap-1 ${mediaTagColor}`}>
                        <MediaIcon size={10} /> {mediaLabel}
                      </span>
                      
                      {isPost && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFlagPost(item);
                          }}
                          className={`px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold ${
                            item.isFlagged 
                              ? 'bg-red-500 text-white border-red-500 animate-pulse' 
                              : 'bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 border-red-500/20'
                          }`}
                          title="Report / Flag inappropriate post"
                        >
                          <ShieldAlert size={10} />
                          <span>{item.isFlagged ? "Reported" : "Report"}</span>
                        </button>
                      )}

                      {isPost && (authorId === currentUserId || currentUser.role === 'Admin') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePost(item);
                          }}
                          className="px-2 py-0.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-600 hover:text-white text-red-400 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                          title="Delete post"
                        >
                          <Trash2 size={10} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
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

                    {/* Multi-media / Single-media Post Attachment Render */}
                    {isPost && (item.mediaUrls && item.mediaUrls.length > 0 ? (
                      <div className="space-y-2">
                        {item.mediaUrls.length === 1 ? (
                          // Single attachment
                          item.mediaUrls[0].match(/\.(mp4|webm|mov|ogg)$/i) || item.type === 'video' ? (
                            <div className="rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--border)' }}>
                              <video 
                                src={resolveContentUrl(item.mediaUrls[0])} 
                                controls 
                                preload="metadata"
                                className="w-full object-contain max-h-[380px]"
                                onPlay={() => handleTrackView(item)}
                              />
                            </div>
                          ) : (
                            <div 
                              className="rounded-2xl overflow-hidden border bg-black/40 cursor-pointer" 
                              style={{ borderColor: 'var(--border)' }}
                              onClick={() => {
                                setLightboxMedia({ url: resolveContentUrl(item.mediaUrls[0]), type: 'image', item });
                                handleTrackView(item);
                              }}
                            >
                              <img 
                                src={resolveContentUrl(item.mediaUrls[0])} 
                                alt="Post attachment" 
                                className="w-full object-cover max-h-[380px]" 
                              />
                            </div>
                          )
                        ) : (
                          // Grid Gallery for 2+ attachments
                          <div className={`grid gap-2 ${item.mediaUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2 xs:grid-cols-3'}`}>
                            {item.mediaUrls.map((url: string, index: number) => {
                              const isVideo = url.match(/\.(mp4|webm|mov|ogg)$/i);
                              return (
                                <div 
                                  key={index}
                                  className="relative aspect-square rounded-xl overflow-hidden border bg-black/40 cursor-pointer group/media hover:opacity-95 transition-opacity" 
                                  style={{ borderColor: 'var(--border)' }}
                                  onClick={() => {
                                    setLightboxMedia({ url: resolveContentUrl(url), type: isVideo ? 'video' : 'image', item });
                                    handleTrackView(item);
                                  }}
                                >
                                  {isVideo ? (
                                    <div className="w-full h-full relative">
                                      <video src={resolveContentUrl(url)} className="w-full h-full object-cover pointer-events-none" preload="metadata" />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover/media:bg-black/50 transition-colors">
                                        <Play size={16} fill="white" className="text-white" />
                                      </div>
                                    </div>
                                  ) : (
                                    <img 
                                      src={resolveContentUrl(url)} 
                                      alt={`Attachment ${index + 1}`} 
                                      className="w-full h-full object-cover" 
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Fallback for single mediaUrl
                      <>
                        {item.type === 'image' && item.mediaUrl && (
                          <div 
                            className="rounded-2xl overflow-hidden border bg-black/40 cursor-pointer" 
                            style={{ borderColor: 'var(--border)' }}
                            onClick={() => {
                              setLightboxMedia({ url: resolveContentUrl(item.mediaUrl), type: 'image', item });
                              handleTrackView(item);
                            }}
                          >
                            <img 
                              src={resolveContentUrl(item.mediaUrl)} 
                              alt="Post attachment" 
                              className="w-full object-cover max-h-[380px]" 
                            />
                          </div>
                        )}

                        {item.type === 'video' && item.mediaUrl && (
                          <div className="rounded-2xl overflow-hidden border bg-black" style={{ borderColor: 'var(--border)' }}>
                            <video 
                              src={resolveContentUrl(item.mediaUrl)} 
                              controls 
                              preload="metadata"
                              className="w-full object-contain max-h-[380px]"
                              onPlay={() => handleTrackView(item)}
                            />
                          </div>
                        )}
                      </>
                    ))}

                    {/* Audio memoir render (Visualizer player layout) */}
                    {isStory && (
                      <div className="space-y-3">
                        {/* Audio memoir render (Visualizer player layout) */}
                        {(item.mediaType === 'audio' || (!item.mediaType && item.audioUrl)) && item.audioUrl && (
                          <div className="p-4 rounded-2xl bg-[var(--bg-elevated)] border flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
                            <button 
                              onClick={async () => {
                                onPlayStory(item);
                                try {
                                  await getStoryDetails(token, item.storyId);
                                  await loadFeedData();
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-stone-900 shadow-md hover:scale-105 transition-all flex-shrink-0"
                            >
                              <Play size={16} className="fill-stone-900 ml-0.5" />
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">{t('homeOralHistorySession')}</p>
                              <p className="text-xs text-stone-750 dark:text-stone-300 truncate mt-0.5">{t('homeDurationMins')}: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')} mins</p>
                            </div>
                            
                            <button 
                              onClick={async () => {
                                try {
                                  await getStoryDetails(token, item.storyId);
                                  await loadFeedData();
                                } catch (err) {
                                  console.error(err);
                                }
                                onNavigate('archive');
                              }}
                              className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:underline"
                            >
                              {t('homeReadTranscript')}
                            </button>
                          </div>
                        )}

                        {/* Image memoir render */}
                        {item.mediaType === 'image' && item.mediaUrl && (
                          <div 
                            className="rounded-2xl overflow-hidden border bg-black/40 cursor-pointer" 
                            style={{ borderColor: 'var(--border)' }}
                            onClick={() => {
                              setLightboxMedia({ url: resolveContentUrl(item.mediaUrl), type: 'image', item });
                              handleTrackView(item);
                            }}
                          >
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
                              onPlay={async () => {
                                try {
                                  await getStoryDetails(token, item.storyId);
                                  await loadFeedData();
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
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
                              onClick={async () => {
                                try {
                                  await getStoryDetails(token, item.storyId);
                                  await loadFeedData();
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                            >
                              {t('homeOpenFile')}
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
                      <span 
                        onClick={() => handleLikeToggle(item)}
                        className="flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 transition-transform hover:text-[var(--text-primary)]"
                      >
                        <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                        <span>{likesCount}</span>
                      </span>
                      
                      <span className="flex items-center gap-1 cursor-default">
                        <Eye size={14} />
                        <span>{item.views || item.viewCount || 0}</span>
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
                      <span 
                        onClick={() => handleSharePost(item)}
                        className="flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform hover:text-[var(--text-primary)]" 
                        title="Shares count"
                      >
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

                      {isPost && (
                        <button 
                          onClick={() => handleFlagPost(item)}
                          className="p-1 rounded hover:bg-[var(--bg-elevated)] hover:scale-110 text-stone-500 hover:text-red-500 transition-all cursor-pointer"
                          title="Flag / Report this post as inappropriate"
                        >
                          <ShieldAlert 
                            size={14} 
                            className={item.isFlagged ? "text-red-500 fill-red-500/20" : ""} 
                          />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Comments/Reflections Section */}
                  {expandedCommentsPostIds.includes(isPost ? (item.postId || item.knowledgeId) : item.storyId) && (
                    <div className="px-5 pb-5 pt-3 border-t bg-[var(--bg-elevated)]/20 space-y-4" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                        <h4 className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                          {t('homeReflectionsTitle')} ({item.comments?.length || 0})
                        </h4>
                      </div>

                      {/* Comments list */}
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {(!item.comments || item.comments.length === 0) ? (
                          <p className="text-[11px] text-[var(--text-muted)] italic py-2">{t('homeNoReflections')}</p>
                        ) : (
                          item.comments.map((comment: any, idx: number) => {
                            const commentDetails = getUserAvatarDetails(comment.userId, comment.userName);
                            const commentTime = new Date(comment.timestamp || comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            const currentUserId = currentUser?.id;
                            const isCommentAuthor = comment.userId === currentUserId;

                            return (
                              <div key={comment._id || comment.commentId || idx} className="flex gap-2.5 items-start text-xs group/comment">
                                <div 
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br cursor-pointer select-none overflow-hidden flex-shrink-0 ${commentDetails.color}`}
                                  onClick={() => onViewProfile(comment.userId)}
                                >
                                  {commentDetails.avatar && !imgError[`comment_${comment.commentId || idx}`] && (commentDetails.avatar.startsWith('http') || commentDetails.avatar.startsWith('/') || commentDetails.avatar.includes('.')) ? (
                                    <img 
                                      src={resolveMediaUrl(commentDetails.avatar)} 
                                      alt={comment.userName} 
                                      className="w-full h-full object-cover" 
                                      onError={() => setImgError(prev => ({ ...prev, [`comment_${comment.commentId || idx}`]: true }))}
                                    />
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
                          placeholder={t('homeReflectionPlaceholder')}
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
                          {t('homeReflectButton')}
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

      {/* FULL-SCREEN LIGHTBOX MODAL */}
      {lightboxMedia && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-between text-white animate-fade-in"
          onClick={() => setLightboxMedia(null)}
        >
          {/* Lightbox Header */}
          <div 
            className="p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <h4 className="font-bold text-sm truncate">{lightboxMedia.item.title || 'Media Preview'}</h4>
              <p className="text-[10px] text-stone-400 mt-0.5">By {lightboxMedia.item.authorName || lightboxMedia.item.elderName || 'Elder'}</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Direct Download Action */}
              <a 
                href={lightboxMedia.url} 
                download 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center justify-center cursor-pointer"
                title="Download file"
              >
                <Download size={18} />
              </a>
              
              <button 
                onClick={() => setLightboxMedia(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lightbox Media Container */}
          <div className="flex-grow flex items-center justify-center p-4">
            {lightboxMedia.type === 'image' ? (
              <img 
                src={lightboxMedia.url} 
                alt="Fullscreen Attachment" 
                className="max-w-[95vw] max-h-[80vh] object-contain rounded-xl shadow-2xl select-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video 
                src={lightboxMedia.url} 
                controls 
                autoPlay
                className="max-w-[95vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Lightbox Footer */}
          <div className="p-4 text-center text-xs text-stone-400 bg-gradient-to-t from-black/80 to-transparent">
            {lightboxMedia.item.summary || lightboxMedia.item.description || 'Digital Roots Memoir Archive'}
          </div>
        </div>
      )}
    </div>
  );
}
