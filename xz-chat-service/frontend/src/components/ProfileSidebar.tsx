import { useEffect, useState, useCallback, useRef } from 'react';
import { ShieldAlert, ImageIcon, FileText, Film, X, ChevronLeft, ChevronRight, Music, ArrowRight } from 'lucide-react';
import type { Message, User } from '../types';
import { getArchives, uploadFile, resolveMediaUrl } from '../api';
import { socket } from '../socket';

interface ProfileSidebarProps {
  threadId: string;
  currentUser: User;
  otherUser: {
    id: string;
    name: string;
    initials: string;
    color: string;
    role?: string;
    bio?: string;
    community?: string;
    languages?: string[];
    legacyCredits?: number;
    badges?: string[];
    avatar?: string;
  };
  onReportClick: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

// Interest tags map to match Figma and give customized feels
const COLLEAGUE_INTERESTS: Record<string, string[]> = {
  'user-arthur': ['Gardening', 'Philosophy', 'Classic Literature'],
  'user-sarah': ['AI Ethics', 'Archival Science', 'Human-Computer Interaction'],
  'user-tessa': ['Creative Writing', 'Genealogy', 'Classical Music'],
  'user-felix': ['East African History', 'Oral Storytelling', 'Community Dev'],
};

export default function ProfileSidebar({ threadId, currentUser, otherUser, onReportClick, onJumpToMessage }: ProfileSidebarProps) {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [filesTab, setFilesTab] = useState<'media' | 'documents'>('media');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      const data = await getArchives(currentUser.id, threadId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load archives in ProfileSidebar:', e);
    } finally {
      setLoading(false);
    }
  }, [threadId, currentUser.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Listen to incoming messages to refresh shared media if a file is uploaded
  useEffect(() => {
    const handleNewMessage = (msg: Message) => {
      if (msg.fileMetadata && msg.threadId === threadId) {
        load();
      }
    };
    socket.on('new-message', handleNewMessage);
    return () => {
      socket.off('new-message', handleNewMessage);
    };
  }, [load, threadId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !threadId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(currentUser.id, threadId, file);
      }
      await load();
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const mediaItems = items.filter((m) => m.type === 'image' || m.type === 'video');
  const documentItems = items.filter((m) => m.type !== 'image' && m.type !== 'video');
  const interests = COLLEAGUE_INTERESTS[otherUser.id] || ['History', 'Memories', 'Mentorship'];

  // Show 3 items in sidebar if total > 5, otherwise show all (up to 5)
  const SIDEBAR_LIMIT = items.length > 5 ? 3 : 5;
  const sidebarItems = items.slice(0, SIDEBAR_LIMIT);
  const hasMore = items.length > SIDEBAR_LIMIT;

  const FileIcon = ({ type }: { type: string }) => {
    if (type === 'image') return <ImageIcon size={14} />;
    if (type === 'video') return <Film size={14} />;
    return <FileText size={14} />;
  };

  const handleItemClick = (msg: Message) => {
    if (onJumpToMessage) {
      setShowAllFiles(false);
      onJumpToMessage(msg.messageId);
    }
  };

  return (
    <div className="flex flex-col h-full w-[280px] flex-shrink-0 border-l border-opacity-10"
         style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center">
        
        {/* Profile Avatar Frame */}
        <div className="relative mb-4 mt-2">
          <div className="w-24 h-24 rounded-full p-1 border-2" style={{ borderColor: 'var(--primary)' }}>
            <div className={`w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-white bg-gradient-to-br overflow-hidden ${otherUser.color}`}>
              {otherUser.avatar && (otherUser.avatar.startsWith('http') || otherUser.avatar.startsWith('/') || otherUser.avatar.includes('.')) ? (
                <img src={resolveMediaUrl(otherUser.avatar)} alt={otherUser.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                otherUser.initials
              )}
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <h3 className="text-lg font-bold text-center" style={{ color: 'var(--text-primary)' }}>
          {otherUser.name}
        </h3>
        <p className="text-[10px] font-extrabold uppercase tracking-widest mt-0.5 text-center" style={{ color: 'var(--primary)' }}>
          {otherUser.role || 'ARCHIVE MEMBER'}
        </p>

        {otherUser.bio && (
          <p className="text-xs text-stone-500 dark:text-stone-400 text-center mt-3 leading-relaxed px-2">
            "{otherUser.bio}"
          </p>
        )}

        {/* Community & Spoken Languages */}
        <div className="flex flex-col items-center gap-1 mt-4 text-[11px] text-stone-500 dark:text-stone-400 font-medium">
          {otherUser.community && (
            <span>Origin: <strong className="text-stone-700 dark:text-stone-300">{otherUser.community}</strong></span>
          )}
          {otherUser.languages && otherUser.languages.length > 0 && (
            <span>Speaks: <strong className="text-stone-700 dark:text-stone-300">{otherUser.languages.join(', ')}</strong></span>
          )}
        </div>

        {/* Legacy Credits and Badges widget */}
        <div className="w-full grid grid-cols-2 gap-2 mt-5 px-1">
          <div className="flex flex-col items-center p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider scale-90">Credits</span>
            <span className="text-lg font-black text-red-500 mt-1" style={{ color: 'var(--primary)' }}>{otherUser.legacyCredits || 0}</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider scale-90">Badges</span>
            <span className="text-xs font-bold text-stone-750 dark:text-stone-200 mt-2 truncate max-w-full text-center">
              {otherUser.badges && otherUser.badges.length > 0 ? `${otherUser.badges.length} Earned` : 'None yet'}
            </span>
          </div>
        </div>

        {otherUser.badges && otherUser.badges.length > 0 && (
          <div className="w-full mt-4 flex flex-wrap justify-center gap-1.5 px-2">
            {otherUser.badges.map((b: string, i: number) => (
              <span key={i} className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/25">
                🏆 {b}
              </span>
            ))}
          </div>
        )}

        {/* Divider */}
        <hr className="w-full my-5 opacity-30" style={{ borderColor: 'var(--border)' }} />

        {/* Interests Section */}
        <div className="w-full flex flex-col items-start">
          <h4 className="text-[11px] font-bold tracking-wider uppercase mb-2 text-stone-500 dark:text-stone-400">
            Interests
          </h4>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest, idx) => (
              <span key={idx} 
                    className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                {interest}
              </span>
            ))}
          </div>
        </div>

        {/* Divider */}
        <hr className="w-full my-6 opacity-30" style={{ borderColor: 'var(--border)' }} />

        {/* Shared Media Section */}
        <div className="w-full flex flex-col items-start flex-1 min-h-[200px]">
          <div className="w-full flex justify-between items-center mb-3">
            <h4 className="text-[11px] font-bold tracking-wider uppercase text-stone-500 dark:text-stone-400">
              Shared Media
            </h4>
            
            {/* Quick Upload Action */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[11px] font-semibold flex items-center gap-1 transition-colors hover:opacity-85"
              style={{ color: 'var(--primary)' }}>
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-2 w-full">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-square rounded-xl animate-pulse"
                     style={{ background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 w-full opacity-40 text-center">
              <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>No shared assets in this timeline</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 w-full">
                {sidebarItems.map((msg, idx) => {
                  const url = msg.fileMetadata?.thumbnailUrl || msg.fileMetadata?.url || '';
                  const isImage = msg.type === 'image';
                  const isVideo = msg.type === 'video';

                  return (
                    <div
                      key={msg.messageId}
                      onClick={() => handleItemClick(msg)}
                      className="relative rounded-xl overflow-hidden cursor-pointer aspect-square bg-[#eaeaea] dark:bg-[#1a1a24] border border-black/5 hover:scale-[1.04] transition-transform"
                    >
                      {isImage && url ? (
                        <img src={resolveMediaUrl(url)} alt="shared" className="w-full h-full object-cover" />
                      ) : isVideo && url ? (
                        <video src={resolveMediaUrl(url)} className="w-full h-full object-cover" muted />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1.5">
                          <FileIcon type={msg.type} />
                          <span className="text-[8px] truncate max-w-full text-center mt-1 text-stone-500" style={{ fontSize: '7px' }}>
                            {msg.fileMetadata?.fileName || 'File'}
                          </span>
                        </div>
                      )}

                      {/* Overlay for +N on the last grid item */}
                      {idx === sidebarItems.length - 1 && hasMore && (
                        <div 
                          className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-sm font-bold cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setShowAllFiles(true); }}
                        >
                          +{items.length - SIDEBAR_LIMIT}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* View All Button */}
              {hasMore && (
                <button
                  onClick={() => setShowAllFiles(true)}
                  className="w-full mt-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all hover:opacity-85 border"
                  style={{ color: 'var(--primary)', borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
                >
                  View All Shared Files ({items.length})
                  <ArrowRight size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Report Connection Button Footer */}
      <div className="p-4 border-t border-opacity-10" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onReportClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/30 text-red-500 dark:text-red-400 font-semibold text-xs transition-all hover:bg-red-500/5 active:scale-[0.98]">
          <ShieldAlert size={15} />
          Report Connection
        </button>
      </div>

      {/* ── Lightbox Overlay (for media preview) ── */}
      {lightbox !== null && mediaItems[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}
          onClick={() => setLightbox(null)}>

          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <X size={20} />
          </button>

          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <ChevronLeft size={20} />
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} className="max-w-3xl max-h-[80vh] rounded-2xl overflow-hidden">
            {mediaItems[lightbox].type === 'image' ? (
              <img
                src={resolveMediaUrl(mediaItems[lightbox].fileMetadata?.url || '')}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : (
              <video
                src={resolveMediaUrl(mediaItems[lightbox].fileMetadata?.url || '')}
                controls
                autoPlay
                className="max-w-full max-h-[80vh]"
              />
            )}
          </div>

          {lightbox < mediaItems.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <ChevronRight size={20} />
            </button>
          )}

          <p className="absolute bottom-4 text-sm text-stone-400">
            {lightbox + 1} / {mediaItems.length}
          </p>
        </div>
      )}

      {/* ── Shared Files Directory Modal ── */}
      {showAllFiles && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
          onClick={() => setShowAllFiles(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] rounded-3xl flex flex-col overflow-hidden border shadow-2xl mx-4"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Shared Files Directory</h3>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{items.length} files shared with {otherUser.name}</p>
              </div>
              <button
                onClick={() => setShowAllFiles(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--bg-elevated)] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b px-6" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setFilesTab('media')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all border-b-2 ${
                  filesTab === 'media'
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                <ImageIcon size={14} />
                Images & Videos ({mediaItems.length})
              </button>
              <button
                onClick={() => setFilesTab('documents')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all border-b-2 ${
                  filesTab === 'documents'
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                }`}
              >
                <FileText size={14} />
                Documents & Audio ({documentItems.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {filesTab === 'media' ? (
                mediaItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-40">
                    <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>No images or videos shared yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2.5">
                    {mediaItems.map((msg) => {
                      const url = msg.fileMetadata?.thumbnailUrl || msg.fileMetadata?.url || '';
                      const isImage = msg.type === 'image';
                      return (
                        <div
                          key={msg.messageId}
                          onClick={() => handleItemClick(msg)}
                          className="relative rounded-xl overflow-hidden cursor-pointer aspect-square bg-[#eaeaea] dark:bg-[#1a1a24] border border-black/5 hover:scale-[1.03] active:scale-[0.98] transition-all group"
                        >
                          {isImage && url ? (
                            <img src={resolveMediaUrl(url)} alt="shared" className="w-full h-full object-cover" />
                          ) : (
                            <video src={resolveMediaUrl(url)} className="w-full h-full object-cover" muted />
                          )}
                          {/* Hover overlay with "Go to" indicator */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <ArrowRight size={12} /> Jump to chat
                            </span>
                          </div>
                          {/* Type badge */}
                          {msg.type === 'video' && (
                            <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-md px-1 py-0.5">
                              <Film size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                documentItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-40">
                    <FileText size={24} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>No documents or audio files shared yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentItems.map((msg) => {
                      const fileName = msg.fileMetadata?.fileName || 'Unknown File';
                      const isAudio = msg.type === 'audio' || msg.type === 'voice';
                      const formattedDate = new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                      return (
                        <button
                          key={msg.messageId}
                          onClick={() => handleItemClick(msg)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-[var(--bg-elevated)] transition-all text-left group active:scale-[0.99]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isAudio ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {isAudio ? <Music size={18} /> : <FileText size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                              {fileName}
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {formattedDate} · {isAudio ? 'Audio' : 'Document'}
                            </p>
                          </div>
                          <ArrowRight size={14} className="text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
