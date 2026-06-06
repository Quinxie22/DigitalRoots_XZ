// ─────────────────────────────────────────────────────────────────────────────
// SharedArchive.tsx
// The right-side panel showing shared files and images in the thread.
//
// HOW IT WORKS:
//   - Fetches all media messages (images, videos, documents) from the backend
//     via GET /api/chat/threads/:threadId/archives.
//   - Displays them in a grid. Clicking an image opens a full-screen lightbox.
//   - A drag-and-drop upload zone allows users to share new files directly.
//     Files are uploaded via POST /api/chat/threads/:threadId/upload.
//   - After uploading, a socket 'new-message' event is emitted by the server
//     automatically, causing the archive to re-fetch.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useRef } from 'react';
import { ImageIcon, FileText, Film, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Message, User } from '../types';
import { getArchives, uploadFile, resolveMediaUrl } from '../api';
import { socket } from '../socket';

interface SharedArchiveProps {
  threadId: string;
  currentUser: User;
}

export default function SharedArchive({ threadId, currentUser }: SharedArchiveProps) {
  const [items, setItems]         = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox]   = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      const data = await getArchives(currentUser.id, threadId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load archives:', e);
    } finally {
      setLoading(false);
    }
  }, [threadId, currentUser.id]);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when any new message arrives (might be a new file)
  useEffect(() => {
    socket.on('new-message', (msg: Message) => {
      if (msg.fileMetadata) load();
    });
    return () => { socket.off('new-message'); };
  }, [load]);

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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  // Only show image/video items in the lightbox
  const mediaItems = items.filter((m) => m.type === 'image' || m.type === 'video');

  const FileIcon = ({ type }: { type: string }) => {
    if (type === 'image') return <ImageIcon size={16} />;
    if (type === 'video') return <Film size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-card)', width: '280px', flexShrink: 0 }}>

      {/* Header */}
      <div className="flex items-center justify-between p-4"
           style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Shared Archive</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {items.length} file{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
          style={{ background: 'var(--primary)', color: 'white' }}
          title="Upload file">
          <Upload size={14} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className="mx-3 mt-3 rounded-2xl flex flex-col items-center justify-center py-4 transition-all duration-200 cursor-pointer"
        style={{
          border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
          background: isDragging ? 'rgba(220,38,38,0.06)' : 'transparent',
          minHeight: '72px',
        }}
        onClick={() => fileInputRef.current?.click()}>
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                 style={{ borderColor: 'var(--primary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uploading…</span>
          </div>
        ) : (
          <>
            <Upload size={18} style={{ color: isDragging ? 'var(--primary)' : 'var(--text-muted)' }} />
            <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Drop files here or click to upload
            </span>
          </>
        )}
      </div>

      {/* Archive Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-xl animate-pulse"
                   style={{ background: 'var(--bg-elevated)' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 opacity-40">
            <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>No shared files yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((msg) => {
              const url = msg.fileMetadata?.thumbnailUrl || msg.fileMetadata?.url || '';
              const isImage = msg.type === 'image';
              const isVideo = msg.type === 'video';
              const mediaIdx = mediaItems.findIndex((m) => m.messageId === msg.messageId);

              return (
                <div
                  key={msg.messageId}
                  onClick={() => (isImage || isVideo) ? setLightbox(mediaIdx) : undefined}
                  className={`relative rounded-xl overflow-hidden transition-transform hover:scale-[1.02] ${isImage || isVideo ? 'cursor-pointer' : ''}`}
                  style={{ aspectRatio: '1', background: 'var(--bg-elevated)' }}>

                  {isImage && url ? (
                    <img
                      src={resolveMediaUrl(url)}
                      alt={msg.fileMetadata?.fileName || 'image'}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo && url ? (
                    <video
                      src={resolveMediaUrl(url)}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
                      <FileIcon type={msg.type} />
                      <p className="text-xs text-center truncate w-full"
                         style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                        {msg.fileMetadata?.fileName || 'File'}
                      </p>
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5 p-1 rounded-lg"
                       style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                    <FileIcon type={msg.type} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
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

          <p className="absolute bottom-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {lightbox + 1} / {mediaItems.length}
          </p>
        </div>
      )}
    </div>
  );
}
