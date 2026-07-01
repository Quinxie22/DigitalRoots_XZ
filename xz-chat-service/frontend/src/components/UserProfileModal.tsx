import { useState, useEffect } from 'react';
import { X, Globe, MessageSquare, Award, Loader, Heart, FileText, Image as ImageIcon, BookOpen } from 'lucide-react';
import { resolveMediaUrl } from '../api';
import { getFeed, getStories, getArticles, resolveContentUrl } from '../contentApi';
import { useTranslation } from 'react-i18next';

interface UserProfileModalProps {
  userId: string;
  currentUserId?: string;
  onClose: () => void;
  onStartChat?: (otherUserId: string) => void;
}

export default function UserProfileModal({ userId, currentUserId, onClose, onStartChat }: UserProfileModalProps) {
  const { t } = useTranslation();
  const isSelf = userId === currentUserId;
  const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  const user = dynamicUsers.find((u) => u.id === userId || u._id === userId);

  type ActivityTab = 'posts' | 'liked';
  const [activeTab, setActiveTab] = useState<ActivityTab>('posts');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [likedContent, setLikedContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
        if (!token) return;

        const [feedRes, storiesRes, articlesRes] = await Promise.all([
          getFeed(token, 1, 100).catch(() => ({ posts: [] })),
          getStories(token, 1, 100).catch(() => ({ stories: [] })),
          getArticles(token, 1, 100).catch(() => ({ articles: [] })),
        ]);

        // Posts authored by user
        const posts: any[] = (feedRes.posts || []).filter(
          (p: any) => p.authorId === userId || p.author === userId || p.userId === userId
        );
        setUserPosts(posts);

        // Content liked / commented by user
        const liked: any[] = [];
        (feedRes.posts || []).forEach((p: any) => {
          const hasLiked = p.reactions?.some((r: any) => r.userId === userId || r.user === userId);
          const hasCommented = p.comments?.some((c: any) => c.userId === userId || c.user === userId);
          if (hasLiked || hasCommented) {
            liked.push({ type: 'Post', action: hasLiked ? 'Liked' : 'Commented on', title: p.title || p.content?.slice(0, 60) || 'Post', mediaUrl: p.mediaUrl || '', id: p._id || p.id });
          }
        });
        (storiesRes.stories || []).forEach((s: any) => {
          if (s.likes?.includes(userId)) {
            liked.push({ type: 'Story', action: 'Liked', title: s.title || 'Story', mediaUrl: s.coverImage || '', id: s._id || s.id });
          }
        });
        (articlesRes.articles || []).forEach((a: any) => {
          const hasLiked = a.likes?.includes(userId);
          const hasCommented = a.comments?.some((c: any) => c.userId === userId);
          if (hasLiked || hasCommented) {
            liked.push({ type: 'Article', action: hasLiked ? 'Liked' : 'Commented on', title: a.title || 'Article', mediaUrl: '', id: a._id || a.id });
          }
        });
        setLikedContent(liked);
      } catch (err) {
        console.error('Failed to load profile activity:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [userId]);

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
        <div className="bg-[var(--bg-card)] border rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center" style={{ borderColor: 'var(--border)' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400"><X size={16} /></button>
          <p className="text-xs text-stone-400 py-6">{t('profileNotFound')}</p>
        </div>
      </div>
    );
  }

  const avatarValue = user.avatar || '';
  const isImage = avatarValue.startsWith('http') || avatarValue.startsWith('/') || avatarValue.includes('.');
  const initials = (user.initials || user.name.slice(0, 2)).toUpperCase();
  const gradients = ['from-red-700 to-red-900', 'from-purple-700 to-purple-900', 'from-rose-600 to-pink-900', 'from-blue-700 to-blue-900', 'from-emerald-700 to-teal-900', 'from-amber-600 to-orange-800'];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorGradient = gradients[hash % gradients.length];
  const translatedRole = user.role === 'Elder' ? t('senior') : user.role === 'Youth' ? t('youth') : user.role;

  const typeIcon = (type: string) => {
    if (type === 'Story') return <FileText size={10} />;
    if (type === 'Article') return <BookOpen size={10} />;
    return <ImageIcon size={10} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border rounded-3xl max-w-sm w-full shadow-2xl relative overflow-hidden flex flex-col"
        style={{ borderColor: 'var(--border)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400 z-10"><X size={16} /></button>

        {/* Decorative accent */}
        <div className={`absolute top-0 inset-x-0 h-2 bg-gradient-to-r ${colorGradient}`} />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Avatar + name + role */}
          <div className="flex flex-col items-center text-center mt-6 px-6 pb-4">
            {isImage ? (
              <img src={resolveMediaUrl(avatarValue)} alt={user.name} className="w-20 h-20 rounded-3xl object-cover shadow-lg border border-opacity-10 mb-4" style={{ borderColor: 'var(--border)' }} />
            ) : (
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br shadow-lg mb-4 ${colorGradient}`}>{initials}</div>
            )}
            <h3 className="text-lg font-bold text-stone-850 dark:text-white">{user.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {!isSelf && user.role && (
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded bg-red-105/10 border border-red-500/20" style={{ color: 'var(--primary)' }}>{translatedRole}</span>
              )}
              {user.community && (
                <span className="text-[10px] text-stone-400 border border-stone-800 px-2 py-0.5 rounded-md bg-[var(--bg-elevated)]">{user.community}</span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 mt-4 text-center">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{userPosts.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-stone-500">Posts</p>
              </div>
              <div className="w-px h-6 bg-[var(--border)]" />
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{likedContent.length}</p>
                <p className="text-[9px] uppercase tracking-wider text-stone-500">Interactions</p>
              </div>
              {user.legacyCredits !== undefined && (
                <>
                  <div className="w-px h-6 bg-[var(--border)]" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{user.legacyCredits}</p>
                    <p className="text-[9px] uppercase tracking-wider text-stone-500">Credits</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bio + meta */}
          <div className="px-6 space-y-4">
            <div className="bg-[var(--bg-elevated)] p-4 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">{t('profileAbout')}</span>
              <p className="text-xs leading-relaxed italic text-[var(--text-secondary)]">"{user.bio || t('profileNoBio')}"</p>
            </div>

            {user.languages && user.languages.length > 0 && (
              <div>
                <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">{t('profileSpokenLanguages')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.languages.map((l: string) => (
                    <span key={l} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--bg-card)] border font-semibold flex items-center gap-1 hover:scale-105 transition-transform cursor-pointer" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                      <Globe size={11} className="text-stone-500" />{l === 'English' ? t('english') : l === 'French' ? t('french') : l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {user.contentPreferences && user.contentPreferences.length > 0 && (
              <div>
                <span className="text-[9px] uppercase font-extrabold tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">{t('profileInterests')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.contentPreferences.map((p: string) => (
                    <span key={p} className="text-[9px] px-2.5 py-0.5 rounded border font-bold uppercase tracking-wider hover:scale-105 transition-transform cursor-pointer" style={{ background: 'rgba(138, 30, 36, 0.08)', borderColor: 'rgba(138, 30, 36, 0.15)', color: 'var(--primary)' }}>{p}</span>
                  ))}
                </div>
              </div>
            )}

            {user.badges && user.badges.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Award size={14} className="text-amber-500" />
                <span className="font-medium text-[var(--text-secondary)]">{user.badges.length} {t('profileBadgesEarned')}</span>
              </div>
            )}
          </div>

          {/* Activity Tabs */}
          <div className="mt-5 px-6 pb-6">
            <div className="flex border-b mb-3" style={{ borderColor: 'var(--border)' }}>
              {(['posts', 'liked'] as ActivityTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 pb-2 text-[11px] font-bold transition-colors border-b-2 flex items-center justify-center gap-1"
                  style={{
                    borderColor: activeTab === tab ? 'var(--primary)' : 'transparent',
                    color: activeTab === tab ? 'var(--primary)' : undefined,
                  }}
                >
                  {tab === 'liked' && <Heart size={10} />}
                  {tab === 'posts' ? 'Posts' : 'Activity'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-stone-400">
                <Loader className="animate-spin" size={14} /><span>Loading...</span>
              </div>
            ) : activeTab === 'posts' ? (
              userPosts.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4 italic">No posts yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {userPosts.map((post: any, idx: number) => {
                    const media = post.mediaUrl ? resolveContentUrl(post.mediaUrl) : '';
                    return (
                      <div key={post._id || post.id || idx} className="aspect-square rounded-xl overflow-hidden relative group cursor-pointer" style={{ background: 'var(--bg-elevated)' }}>
                        {media ? (
                          post.mediaType === 'video'
                            ? <video src={media} className="w-full h-full object-cover" muted />
                            : <img src={media} alt={post.title || 'Post'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                            <FileText size={18} className="text-stone-500 mb-1" />
                            <p className="text-[9px] text-stone-400 leading-tight line-clamp-3">{post.content?.slice(0, 50) || post.title || ''}</p>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-[10px] font-bold">
                          <div className="flex items-center gap-0.5"><Heart size={11} />{post.reactions?.length || post.likes?.length || 0}</div>
                          <div className="flex items-center gap-0.5"><MessageSquare size={11} />{post.comments?.length || 0}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              likedContent.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-4 italic">No activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {likedContent.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(138,30,36,0.1)', color: 'var(--primary)' }}>
                        {typeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>{item.action} · {item.type}</p>
                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate mt-0.5">{item.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Send Message CTA */}
        {onStartChat && !isSelf && user.role !== 'Admin' && (
          <div className="px-6 pb-5 flex-shrink-0 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => { onStartChat(user._id || user.id); onClose(); }}
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] transition-transform"
              style={{ background: 'var(--primary)' }}
            >
              <MessageSquare size={13} />
              {t('profileSendMessage')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
