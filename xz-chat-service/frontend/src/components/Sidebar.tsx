// ─────────────────────────────────────────────────────────────────────────────
// Sidebar.tsx
// Left panel showing all conversation threads, user info, and search.
//
// HOW IT WORKS:
//   - On mount, fetches the user's threads from the backend API.
//   - Displays each thread as a contact card with the last message preview.
//   - "New Chat" button creates a thread with any other known user.
//   - Clicking a thread opens it in the main panel.
//   - Socket listens for 'new-message' events to refresh thread previews
//     in real-time without polling.
//   - Tracks online presence of users via socket events.
//   - Shows unread message count badges per thread.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { Search, MessageSquare, Video } from 'lucide-react';
import type { User, Thread } from '../types';
import { getThreads, getOrCreateThread, resolveMediaUrl } from '../api';
import { socket } from '../socket';

const ALL_USERS = [
  { id: 'user-arthur', name: 'Arthur Miller', initials: 'AM', color: 'from-red-700 to-red-900' },
  { id: 'user-sarah',  name: 'Sarah Chen',    initials: 'SC', color: 'from-purple-700 to-purple-900' },
  { id: 'user-tessa',  name: 'Tessa Elvis',   initials: 'TE', color: 'from-rose-600 to-pink-900' },
  { id: 'user-felix',  name: 'Felix Kamau',   initials: 'FK', color: 'from-blue-700 to-blue-900' },
];

function getUserInfo(userId: string) {
  if (!userId) {
    return {
      id: '',
      name: 'Unknown User',
      initials: '??',
      color: 'from-gray-650 to-gray-800',
      role: 'Youth',
      avatar: ''
    };
  }
  const usersJson = sessionStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  
  const found = dynamicUsers.find((u) => u.id === userId || u._id === userId || u.firebaseUid === userId || u.firebase_uid === userId);
  if (found) {
    const avatar = found.avatar || '';
    const initials = (found.initials || found.name.slice(0, 2)).toUpperCase();
    const gradients = [
      'from-red-700 to-red-900',
      'from-purple-700 to-purple-900',
      'from-rose-600 to-pink-900',
      'from-blue-700 to-blue-900',
      'from-emerald-700 to-teal-900',
      'from-amber-600 to-orange-800'
    ];
    const hash = userId && typeof userId === 'string' ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const color = gradients[hash % gradients.length];

    return {
      id: found._id || found.id,
      name: found.name,
      initials,
      color,
      role: found.role,
      avatar
    };
  }

  const staticUser = ALL_USERS.find((u) => u.id === userId);
  if (staticUser) {
    return {
      id: staticUser.id,
      name: staticUser.name,
      initials: staticUser.initials,
      color: staticUser.color,
      role: 'Elder',
      avatar: ''
    };
  }

  return {
    id: userId,
    name: userId,
    initials: typeof userId === 'string' && userId ? userId.slice(0, 2).toUpperCase() : '??',
    color: 'from-gray-600 to-gray-800',
    role: 'Youth',
    avatar: ''
  };
}

function getOtherParticipant(thread: Thread, myId: string) {
  const otherId = thread.participants.find((p) => p !== myId) ?? thread.participants[0];
  return getUserInfo(otherId);
}

interface SidebarProps {
  currentUser: User;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onStartCall: (threadId: string, targetUserId: string) => void;
  onlineUsers: string[];
  showNewChat: boolean;
  setShowNewChat: (show: boolean) => void;
  onViewProfile?: (userId: string) => void;
  className?: string;
}

export default function Sidebar({ currentUser, selectedThreadId, onSelectThread, onStartCall, onlineUsers, showNewChat, setShowNewChat, onViewProfile, className }: SidebarProps) {
  const [threads, setThreads]       = useState<Thread[]>([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [newTopic, setNewTopic]     = useState('');

  const load = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (token) {
        const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';
        const usersRes = await fetch(`${userServiceUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const usersList = JSON.stringify(usersData.users || []);
          sessionStorage.setItem('users_list', usersList);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh user list in Sidebar:', err);
    }

    try {
      const data = await getThreads(currentUser.id);
      setThreads(data.threads ?? []);
    } catch (e) {
      console.error('Failed to load threads:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh thread list when a new message arrives or when messages are read
  useEffect(() => {
    const handleNewMessage = () => load();
    const handleMessagesRead = () => load();
    socket.on('new-message', handleNewMessage);
    socket.on('messages-read', handleMessagesRead);
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('messages-read', handleMessagesRead);
    };
  }, [load]);

  const startNewChat = async (targetId: string) => {
    try {
      const thread = await getOrCreateThread(currentUser.id, targetId, newTopic);
      setShowNewChat(false);
      setNewTopic('');
      await load();
      onSelectThread(thread.threadId);
    } catch (e) {
      console.error('Failed to create thread:', e);
    }
  };

  const filtered = threads.filter((t) => {
    const other = getOtherParticipant(t, currentUser.id);
    return other.name.toLowerCase().includes(search.toLowerCase());
  });

  const myInfo = getUserInfo(currentUser.id);

  return (
    <aside className={`flex flex-col h-full ${className || ''}`}
           style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)', flexShrink: 0 }}>

      {/* Header */}
      <div className="p-5 flex flex-col gap-4">
        <h2 className="text-2xl font-bold font-sans tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Conversations
        </h2>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search wisdom..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* New Chat Panel */}
      {showNewChat && (
        <div className="p-3 animate-fade-in" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>START A CONVERSATION</p>
          <div className="mb-3">
            <label className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 block mb-1">Discussion Topic (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. History session, recipes..." 
              value={newTopic} 
              onChange={(e) => setNewTopic(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border outline-none"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="space-y-1">
            {(() => {
            const usersJson = sessionStorage.getItem('users_list');
            const list: any[] = usersJson ? JSON.parse(usersJson) : [];
            const mapped = list.map((u: any) => getUserInfo(u._id || u.id));
            return mapped.filter((u) => u.id !== currentUser.id && u.role !== 'Admin').map((u) => (
              <button
                key={u.id}
                onClick={() => startNewChat(u.id)}
                className="w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors hover:bg-opacity-80 mb-1"
                style={{ background: 'var(--bg-card)' }}>
                <div className="relative" onClick={(e) => { e.stopPropagation(); onViewProfile?.(u.id); }}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br cursor-pointer overflow-hidden ${u.color}`}>
                    {u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith('/') || u.avatar.includes('.')) ? (
                      <img src={resolveMediaUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.initials
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                        style={{
                          background: onlineUsers.includes(u.id) ? 'var(--online)' : '#6b7280',
                          borderColor: 'var(--bg-card)',
                        }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
              </button>
            ));
          })()}
          </div>
        </div>
      )}

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded" style={{ background: 'var(--bg-elevated)', width: '70%' }} />
                  <div className="h-2 rounded" style={{ background: 'var(--bg-elevated)', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="mt-3 text-sm font-medium"
              style={{ color: 'var(--primary)' }}>
              Start one →
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((thread) => {
              const other = getOtherParticipant(thread, currentUser.id);
              const isSelected = thread.threadId === selectedThreadId;
              const isOnline = onlineUsers.includes(other.id);
              const timeStr = thread.updatedAt
                ? new Date(thread.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              const unread = thread.unreadCount?.[currentUser.id] || 0;

              return (
                <div
                  key={thread.threadId}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150 group"
                  style={{
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                  }}
                  onClick={() => {
                    // Instantly clear unread count locally for instant responsive feedback
                    if (thread.unreadCount) {
                      thread.unreadCount[currentUser.id] = 0;
                    }
                    onSelectThread(thread.threadId);
                  }}>

                  {/* Avatar */}
                  <div className="relative flex-shrink-0" onClick={(e) => { e.stopPropagation(); onViewProfile?.(other.id); }}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br cursor-pointer overflow-hidden ${other.color}`}>
                      {other.avatar && (other.avatar.startsWith('http') || other.avatar.startsWith('/') || other.avatar.includes('.')) ? (
                        <img src={resolveMediaUrl(other.avatar)} alt={other.name} className="w-full h-full object-cover" />
                      ) : (
                        other.initials
                      )}
                    </div>
                    {/* Online dot — green for online, gray for offline */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                          style={{
                            background: isOnline ? 'var(--online)' : '#6b7280',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                            transition: 'background 0.3s ease, border-color 0.3s ease',
                          }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold truncate" style={{ color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                        {other.name}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                        {/* Unread badge */}
                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{
                                  background: isSelected ? '#ffffff' : 'var(--primary)',
                                  color: isSelected ? 'var(--primary)' : '#ffffff'
                                }}>
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                          {timeStr}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs truncate mt-0.5 font-medium" style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)' }}>
                      {thread.lastMessage?.content || 'Start a conversation...'}
                    </p>
                  </div>

                  {/* Call button (visible on hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartCall(thread.threadId, other.id);
                    }}
                    className="flex-shrink-0 w-7 h-7 rounded-lg items-center justify-center transition-all opacity-0 group-hover:opacity-100 hidden group-hover:flex"
                    style={{ background: 'var(--primary)', color: 'white' }}
                    title={`Call ${other.name}`}>
                    <Video size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current User Footer */}
      <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-xl m-2 transition-colors md:hidden"
           style={{ borderTop: '1px solid var(--border)' }}
           onClick={() => onViewProfile?.(currentUser.id)}>
        <div className="relative flex-shrink-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br overflow-hidden ${myInfo.color}`}>
            {myInfo.avatar && (myInfo.avatar.startsWith('http') || myInfo.avatar.startsWith('/') || myInfo.avatar.includes('.')) ? (
              <img src={resolveMediaUrl(myInfo.avatar)} alt={myInfo.name} className="w-full h-full object-cover" />
            ) : (
              myInfo.initials
            )}
          </div>
          {/* Online green dot indicator for self */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border bg-[var(--online)]"
                style={{ borderColor: 'var(--bg-card)' }} />
        </div>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{myInfo.name}</p>
        </div>
      </div>
    </aside>
  );
}
