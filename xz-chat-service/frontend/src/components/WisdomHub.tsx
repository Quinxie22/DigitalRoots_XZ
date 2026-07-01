import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Heart, Bookmark, Eye, ArrowRight, Loader, Plus, X, BookOpen, AlertCircle, Check, ShieldAlert } from 'lucide-react';
import { getArticles, searchArticles, getSavedBookmarks, likeArticle, bookmarkArticle, unbookmarkArticle, createArticle, publishArticle, createAdminUser, resolveContentUrl, getArticleDetails, addArticleComment, deleteArticleComment } from '../contentApi';
import type { User } from '../types';

interface WisdomHubProps {
  currentUser: User;
  token: string;
}

const CATEGORIES = [
  'Cultural', 'Traditional', 'History', 'Educational', 'Tech',
  'Career', 'Business', 'Finance', 'Health', 'Sports',
  'Travel', 'Music', 'Arts', 'Community', 'Environment'
];

export default function WisdomHub({ currentUser, token }: WisdomHubProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Tab views inside WisdomHub
  const [currentView, setCurrentView] = useState<'explore' | 'bookmarks' | 'create' | 'moderation' | 'manage-admins'>('explore');
  
  // Selected article for reading details
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Create article form states
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Educational');
  const [newTags, setNewTags] = useState('');
  const [newLanguage, setNewLanguage] = useState('en');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Admin creation form states
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState('');
  const [adminError, setAdminError] = useState('');

  // Article creation success banner
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Fetch articles based on query & category
  const fetchArticles = async (query = '', category = '', isPending = false) => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (isPending) {
        response = await getArticles(token, 1, 50, category, '', false);
      } else if (query.trim()) {
        response = await searchArticles(token, query.trim(), category);
      } else {
        response = await getArticles(token, 1, 50, category, '');
      }
      setArticles(response.articles || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch articles. Make sure the Content Service is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectArticle = async (art: any) => {
    setSelectedArticle(art);
    try {
      const res = await getArticleDetails(token, art.knowledgeId);
      if (res.success && res.article) {
        setSelectedArticle(res.article);
        setArticles(prev => prev.map(a => a.knowledgeId === art.knowledgeId ? res.article : a));
      }
    } catch (err) {
      console.error('Failed to fetch article details:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle || !commentText.trim()) return;
    try {
      setSubmittingComment(true);
      const res = await addArticleComment(token, selectedArticle.knowledgeId, commentText.trim());
      if (res.success && res.comment) {
        const updatedArticle = {
          ...selectedArticle,
          comments: [...(selectedArticle.comments || []), res.comment]
        };
        setSelectedArticle(updatedArticle);
        setArticles(prev => prev.map(a => a.knowledgeId === selectedArticle.knowledgeId ? updatedArticle : a));
        setCommentText('');
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedArticle) return;
    try {
      const res = await deleteArticleComment(token, selectedArticle.knowledgeId, commentId);
      if (res.success) {
        const updatedArticle = {
          ...selectedArticle,
          comments: (selectedArticle.comments || []).filter((c: any) => c._id !== commentId)
        };
        setSelectedArticle(updatedArticle);
        setArticles(prev => prev.map(a => a.knowledgeId === selectedArticle.knowledgeId ? updatedArticle : a));
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Fetch bookmarks
  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load backend bookmarks
      let backendArticles: any[] = [];
      try {
        const response = await getSavedBookmarks(token);
        backendArticles = response.articles || [];
      } catch (err) {
        console.warn('Backend bookmarks fetch error:', err);
      }

      // Load local archived posts
      const localArchivedIds = (() => {
        try {
          const saved = localStorage.getItem('archived_posts');
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();

      const localPosts = localArchivedIds.map((id: string) => {
        try {
          const item = localStorage.getItem(`archived_post_obj_${id}`);
          if (!item) return null;
          const parsed = JSON.parse(item);
          return {
            ...parsed,
            knowledgeId: parsed.postId || parsed.knowledgeId,
            coverImage: parsed.mediaUrl || parsed.coverImage,
            summary: parsed.content ? parsed.content.substring(0, 150) + '...' : 'Archive Post',
            authorName: parsed.authorName || 'Elders',
            authorRole: parsed.authorRole || 'Elder',
            bookmarks: [currentUser.id],
            isPostType: true
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      setArticles([...backendArticles, ...localPosts]);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch bookmarked articles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'explore') {
      fetchArticles(searchQuery, activeCategory, false);
    } else if (currentView === 'bookmarks') {
      fetchBookmarks();
    } else if (currentView === 'moderation') {
      fetchArticles('', '', true);
    }
  }, [currentView, activeCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArticles(searchQuery, activeCategory);
  };

  const handleLike = async (articleId: string) => {
    try {
      const response = await likeArticle(token, articleId);
      // Update local article likes count
      setArticles(prev => prev.map(a => {
        if (a.knowledgeId === articleId) {
          const isLiked = a.likes?.includes(currentUser.id);
          const newLikes = isLiked 
            ? a.likes.filter((id: string) => id !== currentUser.id)
            : [...(a.likes || []), currentUser.id];
          return { ...a, likes: newLikes };
        }
        return a;
      }));
      if (selectedArticle && selectedArticle.knowledgeId === articleId) {
        const isLiked = selectedArticle.likes?.includes(currentUser.id);
        const newLikes = isLiked 
          ? selectedArticle.likes.filter((id: string) => id !== currentUser.id)
          : [...(selectedArticle.likes || []), currentUser.id];
        setSelectedArticle({ ...selectedArticle, likes: newLikes });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookmarkToggle = async (article: any) => {
    const isBookmarked = article.bookmarks?.includes(currentUser.id);
    try {
      if (article.isPostType) {
        try {
          const saved = localStorage.getItem('archived_posts');
          let list = saved ? JSON.parse(saved) : [];
          if (list.includes(article.knowledgeId)) {
            list = list.filter((id: string) => id !== article.knowledgeId);
            localStorage.removeItem(`archived_post_obj_${article.knowledgeId}`);
          } else {
            list.push(article.knowledgeId);
            localStorage.setItem(`archived_post_obj_${article.knowledgeId}`, JSON.stringify(article));
          }
          localStorage.setItem('archived_posts', JSON.stringify(list));
        } catch (e) {
          console.error(e);
        }
        if (currentView === 'bookmarks') {
          fetchBookmarks();
        } else {
          setArticles(prev => prev.map(a => {
            if (a.knowledgeId === article.knowledgeId) {
              const newBookmarks = isBookmarked
                ? a.bookmarks.filter((id: string) => id !== currentUser.id)
                : [...(a.bookmarks || []), currentUser.id];
              return { ...a, bookmarks: newBookmarks };
            }
            return a;
          }));
        }
      } else {
        if (isBookmarked) {
          await unbookmarkArticle(token, article.knowledgeId);
        } else {
          await bookmarkArticle(token, article.knowledgeId);
        }

        setArticles(prev => prev.map(a => {
          if (a.knowledgeId === article.knowledgeId) {
            const newBookmarks = isBookmarked
              ? a.bookmarks.filter((id: string) => id !== currentUser.id)
              : [...(a.bookmarks || []), currentUser.id];
            return { ...a, bookmarks: newBookmarks };
          }
          return a;
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !newSummary.trim()) return;

    try {
      setCreating(true);
      setError('');
      
      const tagsArray = newTags.split(',').map(t => t.trim()).filter(Boolean);

      await createArticle(token, newFile, {
        title: newTitle,
        content: newContent,
        summary: newSummary,
        category: newCategory,
        tags: tagsArray,
        language: newLanguage,
      });

      // Clear form & transition back to explore tab
      setNewTitle('');
      setNewSummary('');
      setNewContent('');
      setNewTags('');
      setNewFile(null);
      setUploadSuccess(true); // Show success banner
      setCurrentView('explore');
      fetchArticles('', '', false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create article');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim()) return;
    
    try {
      setAdminCreating(true);
      setAdminSuccess('');
      setAdminError('');
      
      await createAdminUser(token, {
        name: adminName,
        email: adminEmail,
        password: adminPassword
      });
      
      setAdminSuccess(`Administrator "${adminName}" created successfully!`);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
    } catch (err: any) {
      console.error(err);
      setAdminError(err.message || 'Failed to create administrator user.');
    } finally {
      setAdminCreating(false);
    }
  };

  const handleApproveArticle = async (knowledgeId: string, publish: boolean) => {
    try {
      setError('');
      await publishArticle(token, knowledgeId, publish);
      // Remove from list or toggle local state
      setArticles(prev => prev.filter(a => a.knowledgeId !== knowledgeId));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update article publication status.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-dark)]">
      
      {/* Tab Navigation Header */}
      <header className="md:h-16 py-4 md:py-0 flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-8 gap-4 md:gap-0 border-b"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0 w-full md:w-auto">
          <h2 className="text-base sm:text-lg font-bold font-serif whitespace-nowrap">{t('wisdomTitle')}</h2>
          
          <div className="flex gap-1 bg-[var(--bg-elevated)] p-1 rounded-xl border overflow-x-auto scrollbar-none max-w-full" style={{ borderColor: 'var(--border)' }}>
            <button 
              onClick={() => { setCurrentView('explore'); setUploadSuccess(false); }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${currentView === 'explore' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              {t('exploreLibrary', 'Explore Library')}
            </button>
            <button 
              onClick={() => { setCurrentView('bookmarks'); setUploadSuccess(false); }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${currentView === 'bookmarks' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
              {t('savedBookmarks', 'Saved Bookmarks')}
            </button>
            {currentUser.role === 'Admin' && (
              <>
                <button 
                  onClick={() => { setCurrentView('moderation'); setUploadSuccess(false); }}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${currentView === 'moderation' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                  {t('moderationQueue', 'Moderation Queue')}
                </button>
                <button 
                  onClick={() => { setCurrentView('manage-admins'); setUploadSuccess(false); }}
                  className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${currentView === 'manage-admins' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>
                  {t('manageAdmins', 'Manage Admins')}
                </button>
              </>
            )}
          </div>
        </div>

        <button 
          onClick={() => setCurrentView('create')}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all self-end md:self-auto flex-shrink-0"
          style={{ background: 'var(--primary)' }}>
          <Plus size={14} />
          {t('wisdomWriteArticle')}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto px-8 py-6 relative">

        {uploadSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2 animate-fade-in">
            <AlertCircle size={16} />
            <span>Article submitted successfully! It is now pending Administrator approval before it is published to the public library.</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {currentView === 'create' ? (
          /* WRITE ARTICLE FORM */
          <div className="max-w-2xl mx-auto bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-serif font-bold mb-4">Draft New Wisdom Article</h3>
            
            <form onSubmit={handleCreateArticleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Title</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={200}
                  required
                  placeholder="e.g., The Art of Patience in a Digital Age"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Category</label>
                  <select 
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)]"
                    style={{ borderColor: 'var(--border)' }}>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {t('cat_' + cat, cat)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Language</label>
                  <select 
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)]"
                    style={{ borderColor: 'var(--border)' }}>
                    <option value="en">English</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Brief Summary (Figma max 500 chars)</label>
                <textarea 
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  maxLength={500}
                  required
                  rows={2}
                  placeholder="Provide a concise description for the preview cards..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full resize-none"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Article Body (Supports formatting)</label>
                <textarea 
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                  rows={6}
                  placeholder="Write the full wisdom article content here..."
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full font-sans leading-relaxed"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Tags (comma-separated)</label>
                <input 
                  type="text" 
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="folklore, ritual, advice, family"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Cover Image Upload (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="submit" 
                  disabled={creating}
                  className="flex-1 py-3 rounded-2xl text-white font-bold text-xs hover:scale-[1.01] active:scale-[0.99] transition-all"
                  style={{ background: 'var(--primary)' }}>
                  {creating ? 'Publishing article...' : 'Publish Article'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setCurrentView('explore')}
                  className="px-6 py-3 rounded-2xl bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-200 font-bold text-xs">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : currentView === 'moderation' ? (
          /* MODERATION QUEUE VIEW */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-serif font-bold text-base">Pending Knowledge Library Articles</h3>
                <p className="text-[10px] text-stone-400">Approve or reject wisdom articles written by members before they enter the public library</p>
              </div>
            </div>

            <div className="space-y-4">
              {articles.length === 0 ? (
                <div className="py-24 text-center text-xs text-stone-400">
                  Moderation queue is empty. There are no articles currently awaiting review.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {articles.map((art) => (
                    <article 
                      key={art.knowledgeId} 
                      className="rounded-3xl border bg-[var(--bg-card)] overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                      style={{ borderColor: 'var(--border)' }}>
                      
                      <div className="h-40 bg-gradient-to-br from-stone-850 to-stone-900 relative overflow-hidden flex items-center justify-center">
                        {art.coverImage ? (
                          <img src={resolveContentUrl(art.coverImage)} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen size={48} className="text-stone-700 opacity-20" />
                        )}
                        <span className="absolute top-4 left-4 text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/25">
                          {art.category}
                        </span>
                      </div>

                      <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm leading-snug line-clamp-2 pr-2" style={{ color: 'var(--text-primary)' }}>
                            {art.title}
                          </h4>
                          <p className="text-[10px] text-stone-400">By {art.authorName} • {art.authorRole}</p>
                          <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-3 pt-2">
                            {art.summary}
                          </p>
                        </div>

                        <div className="flex gap-2 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                          <button 
                            onClick={() => handleApproveArticle(art.knowledgeId, true)}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                            Approve
                          </button>
                          <button 
                            onClick={() => handleApproveArticle(art.knowledgeId, false)}
                            className="flex-1 py-2 bg-red-650 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                            Reject
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : currentView === 'manage-admins' ? (
          /* MANAGE ADMINS VIEW */
          <div className="max-w-md mx-auto bg-[var(--bg-card)] border rounded-3xl p-6 shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-serif font-bold mb-2">Register Administrator</h3>
            <p className="text-xs text-stone-400 mb-6">Create a secure system administrator account. Only existing admins can perform this action.</p>
            
            {adminSuccess && (
              <div className="mb-4 p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 text-xs text-emerald-500 text-left">
                {adminSuccess}
              </div>
            )}
            {adminError && (
              <div className="mb-4 p-3.5 rounded-xl border border-red-500/25 bg-red-500/5 text-xs text-red-500 text-left">
                {adminError}
              </div>
            )}

            <form onSubmit={handleCreateAdminSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Full Name</label>
                <input 
                  type="text" 
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  placeholder="e.g. Sarah Connor"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Email Address</label>
                <input 
                  type="email" 
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@domain.com"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-400">Secure Password</label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] w-full text-white"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={adminCreating}
                className="w-full py-3 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
                style={{ background: 'var(--primary)' }}>
                {adminCreating ? 'Creating Administrator account...' : 'Create Admin Account'}
              </button>
            </form>
          </div>
        ) : (
          /* DISCOVER & BOOKMARKS VIEW */
          <div className="space-y-6">
            
            {/* Search inputs bar */}
            {currentView === 'explore' && (
              <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-xl">
                <div className="flex-1 flex items-center px-4 py-2.5 rounded-2xl border bg-[var(--bg-card)] focus-within:ring-1 focus-within:ring-red-500/20"
                     style={{ borderColor: 'var(--border)' }}>
                  <Search size={16} className="text-stone-400 mr-2 flex-shrink-0" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('wisdomSearchPlaceholder')}
                    className="outline-none border-none bg-transparent text-xs w-full"
                  />
                </div>
                
                <select 
                  value={activeCategory}
                  onChange={(e) => {
                    setActiveCategory(e.target.value);
                  }}
                  className="px-4 py-2.5 rounded-2xl border outline-none text-xs bg-[var(--bg-card)] select-none cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}>
                  <option value="">{t('allCategories', 'All Categories')}</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {t('cat_' + cat, cat)}
                    </option>
                  ))}
                </select>

                <button 
                  type="submit"
                  className="px-6 rounded-2xl text-white text-xs font-bold"
                  style={{ background: 'var(--primary)' }}>
                  {t('search', 'Search')}
                </button>
              </form>
            )}

            {/* Articles Listings Grid */}
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-2 text-stone-400">
                <Loader className="animate-spin" size={24} />
                <span className="text-xs">{t('loading')}</span>
              </div>
            ) : articles.length === 0 ? (
              <div className="py-24 text-center text-xs text-stone-400 bg-[var(--bg-card)] border border-dashed rounded-3xl p-8 max-w-lg mx-auto">
                <AlertCircle size={24} className="mx-auto mb-3 text-stone-450" />
                <h4 className="font-bold mb-1">{t('wisdomNoArticles')}</h4>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((art) => {
                  const isLiked = art.likes?.includes(currentUser.id);
                  const isBookmarked = art.bookmarks?.includes(currentUser.id);

                  return (
                    <article 
                      key={art.knowledgeId} 
                      className="rounded-3xl border bg-[var(--bg-card)] overflow-hidden shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
                      style={{ borderColor: 'var(--border)' }}>
                      
                      {/* Optional cover image */}
                      <div className="h-40 bg-gradient-to-br from-stone-850 to-stone-900 relative overflow-hidden flex items-center justify-center">
                        {art.coverImage ? (
                          <img src={resolveContentUrl(art.coverImage)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <BookOpen size={48} className="text-stone-700 opacity-20" />
                        )}
                        <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                          <span className="text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-md">
                            {art.category}
                          </span>
                          
                          {/* Approval Status Badge */}
                          {(currentUser.role === 'Admin' || art.authorId === currentUser.id) && (
                            <span className={`text-[8px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border backdrop-blur-md ${
                              art.isPublished 
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                            }`}>
                              {art.isPublished ? 'Published' : 'Pending Approval'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm leading-snug line-clamp-2 pr-2 group-hover:text-red-500 transition-colors"
                              style={{ color: 'var(--text-primary)' }}>
                            {art.title}
                          </h4>
                          <p className="text-[10px] text-stone-400">By {art.authorName} • {art.authorRole}</p>
                          <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-3 pt-2">
                            {art.summary}
                          </p>
                        </div>

                        {/* Likes & Bookmarks engagement controls */}
                        <div className="flex items-center justify-between border-t pt-4 text-stone-400 text-xs" style={{ borderColor: 'var(--border)' }}>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => handleLike(art.knowledgeId)}
                              className="flex items-center gap-1 hover:text-red-500 transition-colors group/like">
                              <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : "group-hover/like:scale-110 transition-transform"} />
                              <span>{art.likes?.length || 0}</span>
                            </button>
                            <span className="flex items-center gap-1"><Eye size={14} /> {art.views || 0}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleBookmarkToggle(art)}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <Bookmark size={14} className={isBookmarked ? "fill-amber-500 text-amber-500" : ""} />
                            </button>
                            <button 
                              onClick={() => handleSelectArticle(art)}
                              className="flex items-center gap-0.5 text-xs font-bold text-red-500 dark:text-red-400 hover:underline">
                              {t('wisdomReadMore')} <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>

                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ARTICLE READING DETAIL MODAL */}
      {selectedArticle && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative" style={{ borderColor: 'var(--border)' }}>
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedArticle(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white z-10 transition-colors">
              <X size={16} />
            </button>

            {/* Optional Cover image */}
            {selectedArticle.coverImage && (
              <div className="h-48 flex-shrink-0 w-full overflow-hidden relative">
                <img src={resolveContentUrl(selectedArticle.coverImage)} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-grow overflow-y-auto p-8 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-650"
                        style={{ color: 'var(--primary)' }}>
                    {selectedArticle.category}
                  </span>
                  <span className="text-xs text-stone-400">Language: {selectedArticle.language}</span>
                </div>
                <h3 className="text-2xl font-bold font-serif leading-tight">{selectedArticle.title}</h3>
                <p className="text-xs text-stone-400">By {selectedArticle.authorName} ({selectedArticle.authorRole}) • Published {new Date(selectedArticle.createdAt).toLocaleDateString()}</p>
              </div>

              {/* Rich text article content body */}
              <div className="text-sm leading-relaxed text-stone-600 dark:text-stone-300 font-sans space-y-4 whitespace-pre-wrap border-t pt-4"
                   style={{ borderColor: 'var(--border)' }}>
                {selectedArticle.content}
              </div>

              {/* Comments Section */}
              <div className="border-t pt-6 mt-6 space-y-4" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-sm font-bold font-serif" style={{ color: 'var(--text-primary)' }}>
                  {t('homeReflectionsTitle')} ({selectedArticle.comments?.length || 0})
                </h4>

                {/* Comment list */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {(!selectedArticle.comments || selectedArticle.comments.length === 0) ? (
                    <p className="text-xs italic text-stone-400">{t('homeNoReflections')}</p>
                  ) : (
                    selectedArticle.comments.map((comment: any) => {
                      const isCommentAuthor = comment.userId === currentUser.id;
                      const isAdmin = currentUser.role === 'Admin';
                      return (
                        <div key={comment._id || comment.timestamp} className="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border text-xs text-stone-600 dark:text-stone-300 flex justify-between items-start gap-4" style={{ borderColor: 'var(--border)' }}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[10px] text-stone-705 dark:text-stone-200">{comment.userName}</span>
                              <span className="text-[9px] text-stone-455">{new Date(comment.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-stone-600 dark:text-stone-350 pr-4 leading-relaxed">{comment.text}</p>
                          </div>
                          {(isCommentAuthor || isAdmin) && (
                            <button
                              onClick={() => handleDeleteComment(comment._id)}
                              className="text-[10px] text-red-500 hover:underline hover:text-red-400 font-bold self-start mt-0.5">
                              {t('delete', 'Delete')}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t('homeReflectionPlaceholder')}
                    required
                    className="flex-1 px-4 py-2.5 rounded-xl border outline-none text-xs bg-[var(--bg-elevated)] text-stone-850 dark:text-white"
                    style={{ borderColor: 'var(--border)' }}
                  />
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all"
                    style={{ background: 'var(--primary)' }}>
                    {submittingComment ? t('loading') : t('homeReflectButton')}
                  </button>
                </form>
              </div>
            </div>

            {/* Engagement status bar in modal footer */}
            <div className="p-4 border-t flex items-center justify-between bg-[var(--bg-elevated)]" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-6 text-stone-400 text-xs">
                <button 
                  onClick={() => handleLike(selectedArticle.knowledgeId)}
                  className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
                  <Heart size={16} className={selectedArticle.likes?.includes(currentUser.id) ? "fill-red-500 text-red-500" : ""} />
                  <span className="font-bold">{selectedArticle.likes?.length || 0} {t('homeComments', 'likes')}</span>
                </button>
                <span className="flex items-center gap-1.5"><Eye size={16} /> {selectedArticle.views || 0} {t('homeViews', 'views')}</span>
              </div>
              <button 
                onClick={() => handleBookmarkToggle(selectedArticle)}
                className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300 hover:underline">
                <Bookmark size={16} className={selectedArticle.bookmarks?.includes(currentUser.id) ? "fill-amber-500 text-amber-500" : ""} />
                <span>{selectedArticle.bookmarks?.includes(currentUser.id) ? t('wisdomBookmarked') : t('wisdomSaveToList')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
