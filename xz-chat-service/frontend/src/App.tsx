import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Mic, Paperclip, Phone, Edit3, Check, X, 
  Play, Pause, Loader, FileText, ChevronDown, ChevronUp, Trash2,
  Home, MessageSquare, BookOpen, Users, Settings, Plus, Sun, Moon,
  MoreVertical, ShieldAlert, Smile, ArrowLeft, Bell, LogOut, Award, Info,
  Download
} from 'lucide-react';
import type { User, Message, Thread as ThreadType, Caption } from './types';
import { 
  getMessages, sendTextMessage, updateTopic, sendVoiceNote, uploadFile, resolveMediaUrl, markMessagesAsRead, deleteMessage,
  reportConnection, getOrCreateThread, deleteNotification
} from './api';
import { socket } from './socket';
import { useWebRTC } from './hooks/useWebRTC';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import CallView from './components/CallView';
import ProfileSidebar from './components/ProfileSidebar';
import HomeDashboard from './components/HomeDashboard';
import WisdomHub from './components/WisdomHub';
import MemoryArchive from './components/MemoryArchive';
import SettingsView from './components/SettingsView';
import UserProfileModal from './components/UserProfileModal';
import MentoringHub from './components/MentoringHub';
import InterviewManager from './components/InterviewManager';
import AdminConsole from './components/AdminConsole';
import { useTranslation } from 'react-i18next';

const ALL_USERS = [
  { id: 'user-arthur', name: 'Arthur Miller', initials: 'AM', color: 'from-red-700 to-red-900' },
  { id: 'user-sarah',  name: 'Sarah Chen',    initials: 'SC', color: 'from-purple-700 to-purple-900' },
  { id: 'user-tessa',  name: 'Tessa Elvis',   initials: 'TE', color: 'from-rose-600 to-pink-900' },
  { id: 'user-felix',  name: 'Felix Kamau',   initials: 'FK', color: 'from-blue-700 to-blue-900' },
];

function getUserInfo(userId: string) {
  const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
  const dynamicUsers: any[] = usersJson ? JSON.parse(usersJson) : [];
  
  const found = dynamicUsers.find((u) => u.id === userId || u._id === userId || u.firebaseUid === userId || u.firebase_uid === userId);
  if (found) {
    const initials = found.avatar || found.initials || found.name.slice(0, 2).toUpperCase();
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
      avatar: found.avatar || ''
    };
  }

  const staticUser = ALL_USERS.find((u) => u.id === userId);
  return {
    id: userId, 
    name: staticUser?.name || userId, 
    initials: staticUser?.initials || (userId && typeof userId === 'string' ? userId.slice(0, 2).toUpperCase() : '??'), 
    color: staticUser?.color || 'from-gray-600 to-gray-800',
    role: 'Elder',
    avatar: ''
  };
}

// ── Notification sound generator ──────────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* Audio context not available */ }
}

export default function App() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'archive' | 'wisdom' | 'settings' | 'mentoring' | 'interviews' | 'notifications' | 'admin'>('messages');
  const [autoplayStory, setAutoplayStory] = useState<any | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
    if (selectedThreadId) {
      setNotifications(prev => prev.filter(n => !(n.type === 'chat_message' && n.referenceId === selectedThreadId)));
    }
  }, [selectedThreadId]);
  const viewedProfileUserIdRef = useRef<string | null>(null); // keeping lines clean
  const [viewedProfileUserId, setViewedProfileUserId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('users_list');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('users_list');
    setCurrentUser(null);
    setSelectedThreadId(null);
  };
  
  // Chat messaging states
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadType | null>(null);

  // Call & Caption states
  const [showCaptions, setShowCaptions] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);

  // Discussion topic editing
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicText, setTopicText] = useState('');

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Online presence
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);

  // showNewChat panel state (lifted from Sidebar)
  const [showNewChat, setShowNewChat] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [topicError, setTopicError] = useState(false);

  // Theme states
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileSidebarModal, setShowProfileSidebarModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ type: 'image' | 'video' | 'document', url: string, name?: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const NOTIFICATION_SERVICE_URL_CLIENT = import.meta.env.VITE_NOTIFICATION_SERVICE_URL || 'http://localhost:3010';

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const res = await fetch(`${NOTIFICATION_SERVICE_URL_CLIENT}/api/notifications/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchNotifications]);

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const res = await fetch(`${NOTIFICATION_SERVICE_URL_CLIENT}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.notificationId === notificationId ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      await deleteNotification(token, notificationId);
      setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Click a notification → navigate to the relevant section + dismiss
  const handleNotificationClick = async (notification: any) => {
    const { type, referenceId, notificationId } = notification;
    const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';

    if (type === 'chat_message' && referenceId) {
      // Open the chat thread and permanently delete the notification
      setSelectedThreadId(referenceId);
      setActiveTab('messages');
      setShowNotifications(false);
      try { await deleteNotification(token, notificationId); } catch (_) {}
      setNotifications(prev => prev.filter(n => n.notificationId !== notificationId));
    } else if (type === 'mentoring_request' || type === 'mentoring_accepted' || type === 'mentoring_cancelled' || type === 'interview_proposal' || type === 'interview_confirmed') {
      setActiveTab('mentoring');
      setShowNotifications(false);
      await handleMarkNotificationRead(notificationId);
    } else if (type === 'story_approved' || type === 'story_rejected') {
      setActiveTab('archive');
      setShowNotifications(false);
      await handleMarkNotificationRead(notificationId);
    } else if (type === 'badge_awarded') {
      setActiveTab('home');
      setShowNotifications(false);
      await handleMarkNotificationRead(notificationId);
    } else {
      await handleMarkNotificationRead(notificationId);
    }
  };

  // Aggregate chat_message notifications by thread — show count + sender name
  const getDisplayNotifications = (): any[] => {
    const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
    const allUsers: any[] = usersJson ? JSON.parse(usersJson) : [];

    const messageGroups: Record<string, any[]> = {};
    const others: any[] = [];

    for (const n of notifications) {
      if (n.type === 'chat_message' && n.referenceId) {
        if (!messageGroups[n.referenceId]) messageGroups[n.referenceId] = [];
        messageGroups[n.referenceId].push(n);
      } else {
        others.push(n);
      }
    }

    const aggregated: any[] = [];
    for (const [threadId, group] of Object.entries(messageGroups)) {
      const unread = group.filter(n => !n.isRead);
      const latest = group[0];
      // Determine sender from thread participants stored in allUsers
      const participants = threadId.split('_');
      const senderId = participants.find((id: string) => id !== currentUser?.id);
      const sender = allUsers.find((u: any) => u.id === senderId || u._id === senderId || u.firebase_uid === senderId);
      const senderName = sender?.name || 'Someone';
      aggregated.push({
        ...latest,
        // Override display fields
        _displayTitle: senderName,
        _displayMessage: unread.length > 0
          ? `You have ${unread.length} unread message${unread.length > 1 ? 's' : ''} from ${senderName}`
          : `Conversation with ${senderName}`,
        _unreadCount: unread.length,
        _aggregated: true,
        _allIds: group.map(n => n.notificationId),
      });
    }

    return [...aggregated, ...others].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleReportConnection = async () => {
    if (!currentUser || !selectedThreadId || !reportReason.trim()) return;
    setReporting(true);
    try {
      await reportConnection(currentUser.id, selectedThreadId, reportReason);
      alert('Connection reported successfully.');
      setShowReportModal(false);
      setReportReason('');
    } catch (err) {
      console.error('Failed to report connection:', err);
      alert('Failed to report connection. Please try again.');
    } finally {
      setReporting(false);
    }
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messageScrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize WebRTC hook
  const {
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isInCall,
    incomingCall,
    startCall,
    endCall,
    acceptCall,
    declineCall,
    toggleMute,
    toggleVideo,
  } = useWebRTC(currentUser?.id || '', selectedThreadId || '');

  // Auto-scroll messages to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      // block:'end' ensures only the messages pane scrolls, not the outer page
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, []);

  const handleScroll = () => {
    const container = messageScrollContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 300;
    setShowScrollBottom(!isNearBottom);
  };

  const handleJumpToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Apply a temporary background highlight flash
      element.style.transition = 'background-color 0.5s ease';
      element.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'; // Highlight color (primary transparent red)
      setTimeout(() => {
        element.style.backgroundColor = '';
      }, 2000);
    } else {
      console.warn(`Message element msg-${messageId} not found in DOM`);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return;
    try {
      const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';
      const res = await fetch(`${userServiceUrl}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else if (res.status === 403) {
        // Clear session and redirect immediately
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('users_list');
        localStorage.removeItem('token');
        localStorage.removeItem('users_list');
        setCurrentUser(null);
        alert(t('accountSuspendedMsg'));
      }
    } catch (err) {
      console.warn('Failed to refresh current user profile:', err);
    }
  }, [t]);

  // Fetch the latest profile when navigating to Home
  useEffect(() => {
    if (activeTab === 'home') {
      refreshCurrentUser();
    }
  }, [activeTab, refreshCurrentUser]);

  // Auto session recovery on mount using sessionStorage or localStorage
  useEffect(() => {
    const checkSession = async () => {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token) {
        setLoadingSession(false);
        return;
      }

      try {
        const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:3006';
        const res = await fetch(`${userServiceUrl}/api/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          
          // Pre-fetch dynamic user directory
          const usersRes = await fetch(`${userServiceUrl}/api/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (usersRes.ok) {
            const usersData = await usersRes.json();
            const usersList = JSON.stringify(usersData.users || []);
            sessionStorage.setItem('users_list', usersList);
            localStorage.setItem('users_list', usersList);
          }
        } else {
          if (res.status === 403) {
            alert(t('accountSuspendedMsg'));
          }
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('users_list');
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Session auto-recovery failed:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    checkSession();
  }, [t]);

  // Connect / disconnect socket (Only dependent on currentUser to prevent reconnection on switching chat threads)
  useEffect(() => {
    if (currentUser) {
      socket.auth = { token: sessionStorage.getItem('token') || localStorage.getItem('token') || currentUser.id };
      socket.connect();

      const handleConnect = () => {
        console.log('Socket connected successfully');
      };

      socket.on('connect', handleConnect);

      return () => {
        socket.off('connect', handleConnect);
        socket.disconnect();
      };
    }
  }, [currentUser]);

  // Join thread when thread changes
  useEffect(() => {
    if (currentUser && selectedThreadId) {
      socket.emit('join-thread', selectedThreadId);
    }
  }, [selectedThreadId, currentUser]);

  // ── Real-time Notification listener ────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const handleNewNotification = (notification: any) => {
      if (notification.type === 'chat_message' && notification.referenceId === selectedThreadIdRef.current) {
        return;
      }
      setNotifications(prev => {
        if (prev.some(n => n.notificationId === notification.notificationId)) return prev;
        return [notification, ...prev];
      });
      playNotificationSound();
    };

    socket.on('new-notification', handleNewNotification);

    return () => {
      socket.off('new-notification', handleNewNotification);
    };
  }, [currentUser]);

  // ── Online Presence Tracking ──────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const handlePresenceList = (data: { onlineUsers: string[] }) => {
      setOnlineUsers(data.onlineUsers);
    };

    const handlePresenceUpdate = (data: { userId: string; status: string; onlineUsers: string[] }) => {
      setOnlineUsers(data.onlineUsers);
    };

    socket.on('presence-list', handlePresenceList);
    socket.on('presence-update', handlePresenceUpdate);

    return () => {
      socket.off('presence-list', handlePresenceList);
      socket.off('presence-update', handlePresenceUpdate);
    };
  }, [currentUser]);

  // Load message history when active thread changes
  useEffect(() => {
    if (!currentUser || !selectedThreadId) {
      setMessages([]);
      setActiveThread(null);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token');
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
        console.warn('Failed to refresh user list in loadMessages:', err);
      }

      try {
        const data = await getMessages(currentUser.id, selectedThreadId);
        const msgs = data.messages ?? [];
        setMessages(msgs);
        
        // Find current thread configuration
        const otherParticipantId = selectedThreadId.split('_').find(id => id !== currentUser.id) || '';
        setActiveThread({
          threadId: selectedThreadId,
          participants: [currentUser.id, otherParticipantId],
          threadType: 'direct',
          discussionTopic: msgs[0]?.threadTopic || 'The first road trip across the coast, 1958'
        });
        
        // Only scroll when there are messages — prevents unwanted page jump on empty threads
        if (msgs.length > 0) scrollToBottom();
        setShowScrollBottom(false);
        // Mark messages as read on the backend
        await markMessagesAsRead(currentUser.id, selectedThreadId);
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
    socket.emit('join-thread', selectedThreadId);
  }, [selectedThreadId, currentUser, scrollToBottom]);

  // Listen to incoming real-time socket events
  useEffect(() => {
    if (!currentUser) return;

    const handleNewMessage = (msg: Message) => {
      if (msg.threadId === selectedThreadId) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.messageId === msg.messageId)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();

        // If the message is from someone else, mark it as read immediately
        if (msg.senderId !== currentUser.id) {
          markMessagesAsRead(currentUser.id, selectedThreadId).catch(console.error);
          // Play notification sound for incoming messages
          playNotificationSound();
        }
      } else {
        // Message is for a different thread — play notification
        if (msg.senderId !== currentUser.id) {
          playNotificationSound();
        }
      }
    };

    const handleMessageUpdated = (msg: Message) => {
      if (msg.threadId === selectedThreadId) {
        setMessages(prev => prev.map(m => m.messageId === msg.messageId ? msg : m));
      }
    };

    const handleMessagesRead = (data: { threadId: string; readBy: string }) => {
      if (data.threadId === selectedThreadId) {
        setMessages(prev => prev.map(m => {
          if (m.senderId !== data.readBy) {
            const currentReadBy = m.readBy || [];
            const currentDeliveredTo = m.deliveredTo || [];
            return {
              ...m,
              readBy: Array.from(new Set([...currentReadBy, data.readBy])),
              deliveredTo: Array.from(new Set([...currentDeliveredTo, data.readBy])),
            };
          }
          return m;
        }));
      }
    };

    const handleMessageDeleted = (data: { threadId: string; messageId: string }) => {
      if (data.threadId === selectedThreadId) {
        setMessages(prev => prev.map(m =>
          m.messageId === data.messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted' }
            : m
        ));
      }
    };

    const handleNewCaption = (caption: Caption) => {
      const senderInfo = getUserInfo(caption.senderId);
      setCaptions(prev => [...prev, { ...caption, senderName: senderInfo.name }]);
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('new-caption', handleNewCaption);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('new-caption', handleNewCaption);
    };
  }, [selectedThreadId, currentUser, scrollToBottom]);

  // ── Typing Indicator Listeners ──────────────────────────────────
  useEffect(() => {
    if (!currentUser || !selectedThreadId) return;

    const handleUserTyping = (data: { userId: string; threadId: string }) => {
      if (data.threadId === selectedThreadId && data.userId !== currentUser.id) {
        setTypingUsers(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
      }
    };

    const handleUserStoppedTyping = (data: { userId: string; threadId: string }) => {
      if (data.threadId === selectedThreadId) {
        setTypingUsers(prev => prev.filter(u => u !== data.userId));
      }
    };

    socket.on('user-typing', handleUserTyping);
    socket.on('user-stopped-typing', handleUserStoppedTyping);

    return () => {
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stopped-typing', handleUserStoppedTyping);
      setTypingUsers([]);
    };
  }, [selectedThreadId, currentUser]);

  // Speech Recognition (Web Speech API) & Mock Caption Fallback
  useEffect(() => {
    if (isInCall && showCaptions && !isMuted && selectedThreadId) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (e: any) => {
          const text = e.results[e.results.length - 1][0].transcript;
          if (text.trim()) {
            socket.emit('send-caption', { threadId: selectedThreadId, text });
          }
        };

        rec.onerror = (err: any) => {
          console.warn('Speech Recognition error:', err);
        };

        try {
          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.error(e);
        }
      } else {
        console.warn('Web Speech API not supported. Relying on caption simulation fallback.');
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isInCall, showCaptions, isMuted, selectedThreadId]);

  // Conversation simulated caption fallback for rich demonstrations
  useEffect(() => {
    let timer: any;
    if (isInCall && showCaptions && selectedThreadId) {
      const simulatedLines = [
        "Let's check the shared archive for the layout blueprints.",
        "I just sent over the mockups, can you verify the color palette?",
        "Yes, the primary red looks spectacular under dark mode.",
        "We should discuss the transition animations next.",
        "Agreed. Subtle micro-animations make the app feel incredibly responsive.",
        "Let's finalize this call block and write down the notes.",
      ];
      let lineIndex = 0;
      
      timer = setInterval(() => {
        // Send simulated transcripts on behalf of the remote user
        socket.emit('send-caption', { threadId: selectedThreadId, text: simulatedLines[lineIndex % simulatedLines.length] });
        lineIndex++;
      }, 9000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isInCall, showCaptions, selectedThreadId]);

  // Download helper that uses the backend proxy to preserve original filenames
  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || currentUser?.id || '';
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3004'}/api/chat/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Proxy download failed, trying direct link:', error);
      const link = document.createElement('a');
      link.href = resolveMediaUrl(url);
      link.target = "_blank";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ── Typing Emission Logic ──────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!selectedThreadId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing-start', { threadId: selectedThreadId });
    }

    // Reset the "stop typing" timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing-stop', { threadId: selectedThreadId });
    }, 2000);
  };

  // Handle message text send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && pendingFiles.length === 0) return;
    if (!currentUser || !selectedThreadId) return;

    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing-stop', { threadId: selectedThreadId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    const text = inputText;
    const filesToSend = [...pendingFiles];
    setInputText('');
    setPendingFiles([]);

    try {
      // 1. Send text message if any
      if (text.trim()) {
        const message = await sendTextMessage(currentUser.id, selectedThreadId, text);
        setMessages(prev => {
          if (prev.some(m => m.messageId === message.messageId)) return prev;
          return [...prev, message];
        });
      }

      // 2. Upload and send files with optimistic staging state
      filesToSend.forEach((file) => {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const fileCategory = file.type.startsWith('image/') ? 'image' 
                          : file.type.startsWith('video/') ? 'video'
                          : file.type.startsWith('audio/') ? 'audio'
                          : 'document';

        const optimisticMsg: Message = {
          messageId: tempId,
          threadId: selectedThreadId,
          senderId: currentUser.id,
          type: fileCategory as any,
          content: `Sent ${file.name}`,
          timestamp: new Date().toISOString(),
          fileMetadata: {
            url: URL.createObjectURL(file), // Local blob URL for instant preview
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
          isUploading: true,
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        scrollToBottom();

        // Run upload in background asynchronously
        (async () => {
          try {
            const message = await uploadFile(currentUser.id, selectedThreadId, file);
            setMessages((prev) =>
              prev.map((m) => (m.messageId === tempId ? { ...message, isUploading: false } : m))
            );
          } catch (uploadErr) {
            console.error(`Failed uploading file ${file.name}:`, uploadErr);
            setMessages((prev) =>
              prev.map((m) => (m.messageId === tempId ? { ...m, isUploading: false, uploadFailed: true } : m))
            );
          }
        })();
      });
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send message flow:', err);
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser || !selectedThreadId) return;
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteMessage(currentUser.id, selectedThreadId, messageId);
      setMessages(prev => prev.map(m =>
        m.messageId === messageId
          ? { ...m, isDeleted: true, content: 'This message was deleted' }
          : m
      ));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  // Handle discussion topic update
  const handleUpdateTopic = async () => {
    if (!currentUser || !selectedThreadId || !topicText.trim()) return;
    try {
      const updated = await updateTopic(currentUser.id, selectedThreadId, topicText);
      setActiveThread(prev => prev ? { ...prev, discussionTopic: updated.discussionTopic } : null);
      setIsEditingTopic(false);
    } catch (err) {
      console.error('Failed to update discussion topic:', err);
    }
  };

  // Start recording voice note
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        // If recording was cancelled, don't upload
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return; // Discard tiny/empty records

        try {
          if (currentUser && selectedThreadId) {
            const message = await sendVoiceNote(currentUser.id, selectedThreadId, audioBlob, recordingDuration);
            setMessages(prev => {
              if (prev.some(m => m.messageId === message.messageId)) return prev;
              return [...prev, message];
            });
            scrollToBottom();
          }
        } catch (err) {
          console.error('Failed to upload voice note:', err);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.warn('Microphone permission denied or device error:', err);
    }
  };

  // Stop and send voice note
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  // Cancel and discard voice note
  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; // Empty chunks to flag discard
      mediaRecorderRef.current.stop();
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  // Handle call toggle / setup
  const handleStartCall = async (threadId: string, targetId: string) => {
    setSelectedThreadId(threadId);
    setCaptions([]);
    await startCall(targetId);
  };

  const handleEndCall = () => {
    endCall();
    setCaptions([]);
  };

  // Handle generic file attaches from the input bar shortcut
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const unique = Array.from(files).filter(f => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
    e.target.value = '';
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loadingSession) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-dark)] gap-3 text-stone-500">
        <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold">Resuming secure session...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Login 
        onLogin={async (user) => {
          setCurrentUser(user);
          try {
            const token = sessionStorage.getItem('token') || localStorage.getItem('token');
            const userServiceUrl = import.meta.env.VITE_USER_SERVICE_URL || 'http://127.0.0.1:3006';
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
            console.error('Failed to load users directory on login:', err);
          }
        }} 
      />
    );
  }

  const otherUser = selectedThreadId 
    ? getUserInfo(selectedThreadId.split('_').find(id => id !== currentUser.id) || '')
    : null;

  const otherIsOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  const displayName = otherUser 
    ? (otherUser.name.length > 12 && windowWidth <= 340 ? otherUser.name.split(' ')[0] : otherUser.name)
    : '';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[var(--bg-dark)]"
         style={{ color: 'var(--text-primary)' }}>
      
      {/* Mobile Top Header (hidden on desktop) */}
      {!(activeTab === 'messages' && selectedThreadId) && (
        <header className="md:hidden flex-shrink-0 h-14 flex items-center justify-between px-5 border-b select-none z-40"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 select-none">
            <svg className="w-7 h-7 flex-shrink-0 shadow-md" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="12" fill="url(#xzGradMobile)" />
              <path d="M11 11L29 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M29 11L23 17" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M17 23L11 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M13 15H27L13 25H27" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="xzGradMobile" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#E23E3E" />
                  <stop stopColor="#8A1E24" />
                </linearGradient>
              </defs>
            </svg>
            <div className="flex flex-col gap-0.5 xs-hide">
              <span className="text-sm font-bold tracking-tight uppercase leading-none" style={{ color: 'var(--primary)' }}>
                Digital Roots
              </span>
              <span className="text-[7px] uppercase font-bold tracking-widest text-stone-400 dark:text-stone-500 leading-none">
                Bridging Generations
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Info Icon */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-505 hover:text-stone-850 dark:text-stone-400 dark:hover:text-white transition-all hover:scale-105 cursor-pointer flex items-center justify-center"
              title="About Digital Roots"
            >
              <Info size={18} />
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`relative p-1.5 rounded-full hover:bg-[var(--bg-elevated)] transition-all hover:scale-105 cursor-pointer flex items-center justify-center ${
                activeTab === 'notifications' ? 'text-[var(--primary)]' : 'text-stone-500 hover:text-stone-850 dark:text-stone-400 dark:hover:text-white'
              }`}
              title="Notifications"
            >
              <Bell size={18} />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            {/* Current User Avatar */}
            <div 
              onClick={() => setViewedProfileUserId(currentUser.id)}
              className="relative cursor-pointer hover:scale-105 transition-transform flex-shrink-0"
              title="View My Profile"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br overflow-hidden ${getUserInfo(currentUser.id).color}`}>
                {currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('/') || currentUser.avatar.includes('.')) ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  getUserInfo(currentUser.id).initials
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Container Row */}
      <div className="flex-grow flex flex-row min-h-0 overflow-hidden relative">
        
        {/* Column 1: Leftmost Navigation Sidebar */}
        <aside className="w-64 desktop-sidebar flex flex-col justify-between p-6 border-r border-opacity-10 select-none flex-shrink-0"
             style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        
        {/* Logo Section */}
        <div className="flex items-center gap-3 mt-2 select-none">
          <svg className="w-8 h-8 flex-shrink-0 shadow-md" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="12" fill="url(#xzGradSidebar)" />
            <path d="M11 11L29 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M29 11L23 17" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M17 23L11 29" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M13 15H27L13 25H27" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="xzGradSidebar" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E23E3E" />
                <stop stopColor="#8A1E24" />
              </linearGradient>
            </defs>
          </svg>
          <div className="flex flex-col gap-0.5 animate-slide-in">
            <span className="text-[15px] font-bold tracking-tight uppercase leading-none text-stone-850 dark:text-white"
                  style={{ color: 'var(--primary)' }}>
              Digital Roots
            </span>
            <span className="text-[7.5px] uppercase font-bold tracking-widest text-stone-400 dark:text-stone-500 leading-none">
              Bridging Generations
            </span>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-1.5 mt-8 flex-1">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'home' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <Home size={16} style={{ color: activeTab === 'home' ? 'var(--primary)' : undefined }} />
            {t('home')}
          </button>
          
          <button 
            onClick={() => setActiveTab('messages')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'messages' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <MessageSquare size={16} style={{ color: activeTab === 'messages' ? 'var(--primary)' : undefined }} />
            {t('messages')}
          </button>

          <button 
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'archive' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <BookOpen size={16} style={{ color: activeTab === 'archive' ? 'var(--primary)' : undefined }} />
            {t('archive')}
          </button>

          <button 
            onClick={() => setActiveTab('wisdom')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'wisdom' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <Users size={16} style={{ color: activeTab === 'wisdom' ? 'var(--primary)' : undefined }} />
            {t('wisdom')}
          </button>

          <button 
            onClick={() => setActiveTab('mentoring')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'mentoring' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <Award size={16} style={{ color: activeTab === 'mentoring' ? 'var(--primary)' : undefined }} />
            {t('mentoring')}
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <Settings size={16} style={{ color: activeTab === 'settings' ? 'var(--primary)' : undefined }} />
            {t('settings')}
          </button>

          {currentUser.role === 'Admin' && (
            <button 
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
              }`}>
              <ShieldAlert size={16} style={{ color: activeTab === 'admin' ? 'var(--primary)' : undefined }} />
              <span>Admin Console</span>
            </button>
          )}
          
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center justify-between w-full px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
              activeTab === 'notifications'
                ? 'bg-[var(--bg-elevated)] text-[var(--primary)] shadow-sm'
                : 'text-stone-500 dark:text-stone-400 btn-hover-primary'
            }`}>
            <div className="flex items-center gap-3">
              <Bell size={16} style={{ color: activeTab === 'notifications' ? 'var(--primary)' : undefined }} />
              <span>{t('notifications')}</span>
            </div>
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                {notifications.filter(n => !n.isRead).length}
              </span>
            )}
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold rounded-xl text-left transition-colors text-stone-500 dark:text-stone-400 btn-hover-primary hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? t('lightTheme') : t('darkTheme')}
          </button>

          {/* Desktop Log Out Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl text-left transition-colors text-red-500 hover:bg-red-500/10 hover:text-red-650 mt-0.5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
            <LogOut size={16} />
            {t('logOut')}
          </button>
        </nav>

        {/* Current User Profile Card */}
        <div className="mt-auto pt-4 border-t border-opacity-10" style={{ borderColor: 'var(--border)' }}>
          {/* New Connection Action */}
          <div className="mb-4">
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-red-950/20 cursor-pointer"
              style={{ background: 'var(--primary)' }}>
              <Plus size={15} />
              New Connection
            </button>
          </div>
          
          <div 
            onClick={() => setViewedProfileUserId(currentUser.id)}
            className="flex items-center gap-3 p-2 rounded-2xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border)] transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="View my profile"
          >
            <div className="relative flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br overflow-hidden ${getUserInfo(currentUser.id).color}`}>
                {currentUser.avatar && (currentUser.avatar.startsWith('http') || currentUser.avatar.startsWith('/') || currentUser.avatar.includes('.')) ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  getUserInfo(currentUser.id).initials
                )}
              </div>
              {/* Online green dot indicator for self */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border bg-[var(--online)]"
                    style={{ borderColor: 'var(--bg-card)' }} />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-xs font-bold truncate text-[var(--text-primary)]">{currentUser.name}</p>
            </div>
          </div>
        </div>
      </aside>

      {activeTab === 'messages' && (
        <div className="flex-grow flex h-full overflow-hidden min-w-0">
          {/* Column 2: Conversations List Panel */}
          <Sidebar 
            currentUser={currentUser} 
            selectedThreadId={selectedThreadId} 
            onSelectThread={(id) => setSelectedThreadId(id)}
            onStartCall={handleStartCall}
            onlineUsers={onlineUsers}
            showNewChat={showNewChat}
            setShowNewChat={setShowNewChat}
            onViewProfile={setViewedProfileUserId}
            className={selectedThreadId ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80'}
          />

          {!selectedThreadId ? (
            /* Column 3 Placeholders: Welcome Screen on Desktop, hidden on Mobile */
            <div className="hidden md:flex flex-grow flex-col items-center justify-center bg-[var(--bg-surface)] p-8 text-center select-none">
              <div className="max-w-md space-y-6 flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-md">
                  <MessageSquare size={38} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-serif">Digital Roots</h3>
                  <p className="text-xs text-stone-400 leading-relaxed font-sans">
                    Select a connection from the list to begin sharing oral histories, exchanging traditional knowledge, and preserving generational wisdom.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                  <ShieldAlert size={12} className="text-emerald-500" />
                  <span>End-to-End Encrypted connection</span>
                </div>
              </div>
            </div>
          ) : (
            /* Column 3: Middle Main Chat/Call Window (only visible when a conversation is open) */
            <main className="flex-grow flex flex-col h-full overflow-hidden relative bg-[var(--bg-surface)]">
              {/* Active Conversation Panel */}
              <div className="flex-grow flex flex-col h-full overflow-hidden">
            
            {/* Split top call screen if call is active */}
            {isInCall && (
              <div className="relative w-full h-[55%] flex-shrink-0 border-b border-[#1f1f2e] bg-black">
                <CallView 
                  localStream={localStream}
                  remoteStream={remoteStream}
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  isInCall={isInCall}
                  threadId={selectedThreadId}
                  remoteName={otherUser?.name || 'Participant'}
                  currentUserName={currentUser.name}
                  onToggleMute={toggleMute}
                  onToggleVideo={toggleVideo}
                  onEndCall={handleEndCall}
                  onShowCaptions={() => setShowCaptions(!showCaptions)}
                  showCaptions={showCaptions}
                />

                {/* Subtitle / Caption ticker overlay */}
                {showCaptions && captions.length > 0 && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[85%] max-h-24 overflow-y-auto rounded-xl p-3 flex flex-col gap-1.5 pointer-events-none select-none z-35 font-sans"
                       style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {captions.slice(-3).map((cap, i) => (
                      <div key={i} className="text-xs flex gap-1.5 caption-enter">
                        <span className="font-semibold text-red-500 whitespace-nowrap">{cap.senderName || 'Speaker'}:</span>
                        <span className="text-gray-105">{cap.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b"
                   style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  <button 
                    onClick={() => setSelectedThreadId(null)}
                    type="button"
                    className="p-2 -ml-2 rounded-xl text-stone-550 btn-hover-primary transition-all flex items-center justify-center flex-shrink-0"
                    title="Back to conversations">
                    <ArrowLeft size={16} />
                  </button>

                  <div 
                    onClick={() => setShowProfileSidebarModal(true)}
                    className="relative cursor-pointer hover:scale-105 transition-transform flex-shrink-0"
                    title="View details"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br overflow-hidden ${otherUser?.color || 'from-stone-655 to-stone-800'}`}>
                      {otherUser?.avatar && (otherUser.avatar.startsWith('http') || otherUser.avatar.startsWith('/') || otherUser.avatar.includes('.')) ? (
                        <img src={resolveMediaUrl(otherUser.avatar)} alt={otherUser.name} className="w-full h-full object-cover" />
                      ) : (
                        otherUser?.initials || '??'
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border"
                          style={{ 
                            borderColor: 'var(--bg-card)',
                            background: otherIsOnline ? 'var(--online)' : '#6b7280'
                          }} />
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate cursor-pointer hover:underline text-xs xs:text-sm" style={{ color: 'var(--text-primary)' }} onClick={() => setViewedProfileUserId(otherUser?.id || '')}>
                        {displayName}
                      </span>
                    </div>
                    
                    {activeThread?.discussionTopic && (
                      <div className="flex items-center gap-1.5 text-[10px] mt-0.5 truncate select-none text-gray-400 xs-hide">
                        <span className="font-semibold text-red-500 whitespace-nowrap" style={{ color: 'var(--primary)' }}>TOPIC:</span>
                        {isEditingTopic ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <input
                              type="text"
                              value={topicText}
                              onChange={(e) => setTopicText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateTopic();
                                if (e.key === 'Escape') setIsEditingTopic(false);
                              }}
                              className="px-2 py-0.5 rounded outline-none border text-white text-xs flex-1 bg-[#1a1a26]"
                              style={{ borderColor: 'var(--primary)' }}
                              autoFocus
                            />
                            <button onClick={handleUpdateTopic} className="text-green-500 hover:text-green-400">
                              <Check size={13} />
                            </button>
                            <button onClick={() => setIsEditingTopic(false)} className="text-red-500 hover:text-red-400">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 truncate group cursor-pointer"
                               onClick={() => {
                                 setTopicText(activeThread?.discussionTopic || '');
                                 setIsEditingTopic(true);
                               }}>
                            <span className="truncate italic text-stone-505 dark:text-stone-400">
                              "{activeThread?.discussionTopic}"
                            </span>
                            <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-stone-400 transition-opacity" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 xs:gap-3">
                  {!isInCall && (
                    <button
                      onClick={() => handleStartCall(selectedThreadId, otherUser?.id || '')}
                      className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl flex items-center justify-center border text-stone-500 hover:text-stone-850 dark:text-stone-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all flex-shrink-0"
                      style={{ borderColor: 'var(--border)' }}
                      title="Start Call Session">
                      <Phone className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setShowProfileSidebarModal(true)}
                    className="w-8 h-8 xs:w-10 xs:h-10 rounded-xl flex items-center justify-center border text-stone-500 hover:text-stone-850 dark:text-stone-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all flex-shrink-0"
                    style={{ borderColor: 'var(--border)' }}
                    title="Actions">
                    <MoreVertical className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                  </button>
                </div>
              </div>

              {/* Mobile-only: New Connection floating overlay (when sidebar is hidden) */}
              {showNewChat && (
                <div
                  className="fixed inset-0 z-40 flex flex-col justify-end md:hidden"
                  onClick={() => { setShowNewChat(false); setNewTopic(''); setTopicError(false); }}
                >
                  <div
                    className="bg-[var(--bg-card)] border-t rounded-t-3xl p-5 shadow-2xl animate-slide-in"
                    style={{ borderColor: 'var(--border)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Connection</p>
                      <button onClick={() => { setShowNewChat(false); setNewTopic(''); setTopicError(false); }} className="p-1.5 rounded-full hover:bg-[var(--bg-elevated)] text-stone-400">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mb-3">
                      <label className="text-[10px] uppercase font-bold text-stone-500 dark:text-stone-400 block mb-1">Discussion Topic (Required)</label>
                      <input
                        type="text"
                        placeholder="e.g. History session, recipes..."
                        value={newTopic}
                        onChange={(e) => {
                          setNewTopic(e.target.value);
                          setTopicError(false);
                        }}
                        className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                          topicError ? 'border-red-500 bg-red-500/5' : ''
                        }`}
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: topicError ? undefined : 'var(--border)',
                          color: 'var(--text-primary)'
                        }}
                        autoFocus
                      />
                      {topicError && (
                        <span className="text-[9px] text-red-500 mt-1 block">A discussion topic is required to start a connection.</span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {(() => {
                        const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
                        const list: any[] = usersJson ? JSON.parse(usersJson) : [];
                        const mapped = list.map((u: any) => getUserInfo(u._id || u.id));
                        const filteredList = mapped.filter((u) => u.id !== currentUser.id && u.role !== 'Admin');

                        if (filteredList.length === 0) {
                          return <p className="text-[11px] text-stone-550 text-center py-4 italic">No available connections found.</p>;
                        }

                        return filteredList.map((u) => (
                          <button
                            key={u.id}
                            onClick={async () => {
                              if (!newTopic.trim()) {
                                setTopicError(true);
                                return;
                              }
                              try {
                                const thread = await getOrCreateThread(currentUser.id, u.id, newTopic);
                                setShowNewChat(false);
                                setNewTopic('');
                                setTopicError(false);
                                setSelectedThreadId(thread.threadId);
                              } catch (e) { console.error('Failed to create thread:', e); }
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-[var(--bg-elevated)] transition-colors"
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br overflow-hidden flex-shrink-0 ${u.color}`}>
                              {u.avatar && (u.avatar.startsWith('http') || u.avatar.startsWith('/') || u.avatar.includes('.')) ? (
                                <img src={resolveMediaUrl(u.avatar)} alt={u.name} className="w-full h-full object-cover" />
                              ) : u.initials}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Message Feed */}
 
              <div 
                ref={messageScrollContainerRef}
                onScroll={handleScroll}
                className="flex-grow overflow-y-auto px-6 py-4 space-y-4 bg-[var(--bg-dark)] relative"
              >
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-gray-500">
                    <Loader className="animate-spin" size={20} />
                    <span>Loading timeline archives...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 opacity-40">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No communication records in this timeline. Send a message below.</p>
                  </div>
                ) : (
                  (() => {
                    const grouped: { type: 'single' | 'media_group'; msg: Message; groupMsgs?: Message[] }[] = [];
                    for (let idx = 0; idx < messages.length; idx++) {
                      const m = messages[idx];
                      const isMed = (m.type === 'image' || m.type === 'video') && !m.isDeleted;
                      if (isMed) {
                        const grp: Message[] = [m];
                        let j = idx + 1;
                        while (j < messages.length) {
                          const next = messages[j];
                          const isNextMed = (next.type === 'image' || next.type === 'video') && !next.isDeleted;
                          const isSameSnd = next.senderId === m.senderId;
                          const isClose = Math.abs(new Date(next.timestamp).getTime() - new Date(m.timestamp).getTime()) < 120000;
                          if (isNextMed && isSameSnd && isClose) {
                            grp.push(next);
                            j++;
                          } else {
                            break;
                          }
                        }
                        if (grp.length >= 2) {
                          grouped.push({ type: 'media_group', msg: m, groupMsgs: grp });
                          idx = j - 1;
                        } else {
                          grouped.push({ type: 'single', msg: m });
                        }
                      } else {
                        grouped.push({ type: 'single', msg: m });
                      }
                    }

                    return grouped.map((item, i) => {
                      const msg = item.msg;
                      const isSelf = msg.senderId === currentUser.id;
                      const sender = getUserInfo(msg.senderId);
                      const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const otherParticipantId = selectedThreadId ? (selectedThreadId.split('_').find(id => id !== currentUser.id) || '') : '';
                      const isRead = msg.readBy?.includes(otherParticipantId);
                      const isDelivered = msg.deliveredTo?.includes(otherParticipantId) || isRead;

                      const msgDate = new Date(msg.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
                      const prevMsg = i > 0 ? grouped[i - 1].msg : null;
                      const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : null;
                      const showDateDivider = msgDate !== prevMsgDate;
                      const mediaUrl = msg.fileMetadata?.url ? resolveMediaUrl(msg.fileMetadata.url) : '';

                      return (
                        <div 
                          key={msg.messageId || i} 
                          id={msg.messageId ? `msg-${msg.messageId}` : undefined}
                          className="w-full flex flex-col transition-all duration-500 rounded-2xl p-1"
                        >
                          
                          {/* Date Separator */}
                          {showDateDivider && (
                            <div className="w-full flex justify-center my-6">
                              <span className="text-[11px] font-medium italic select-none" style={{ color: 'var(--text-muted)' }}>
                                {msgDate}
                              </span>
                            </div>
                          )}

                          <div className={`flex items-end gap-2.5 max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : ''} animate-fade-in group/msg`}>
                            
                            {/* Sender Avatar */}
                            {!isSelf && (
                              <div className="relative flex-shrink-0" onClick={() => setViewedProfileUserId(sender.id)}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br flex-shrink-0 cursor-pointer overflow-hidden ${sender.color}`}>
                                  {sender.avatar && (sender.avatar.startsWith('http') || sender.avatar.startsWith('/') || sender.avatar.includes('.')) ? (
                                    <img src={sender.avatar} alt={sender.name} className="w-full h-full object-cover" />
                                  ) : (
                                    sender.initials
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Bubble */}
                            <div className="flex flex-col relative">
                              {/* Delete button (own messages only, not deleted) */}
                              {isSelf && !msg.isDeleted && (
                                <button
                                  onClick={() => handleDeleteMessage(msg.messageId)}
                                  className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/10"
                                  title="Delete message">
                                  <Trash2 size={12} className="text-gray-550 hover:text-red-400" />
                                </button>
                              )}

                              <div className={`p-3.5 text-xs leading-relaxed ${msg.isDeleted ? 'opacity-50 italic' : ''} ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                                
                                {/* Rendering based on message type */}
                                {msg.isDeleted ? (
                                  <p className="text-[10px] text-gray-400 italic select-none">🚫 This message was deleted</p>
                                ) : (
                                  <>
                                    {item.type === 'media_group' && item.groupMsgs && (
                                      <div className="space-y-1">
                                        <div className="grid grid-cols-2 gap-1.5 max-w-xs">
                                          {item.groupMsgs.map((gMsg, gIdx) => {
                                            const isImg = gMsg.type === 'image';
                                            const gMediaUrl = gMsg.fileMetadata?.url ? resolveMediaUrl(gMsg.fileMetadata.url) : '';
                                            return (
                                              <div 
                                                key={gMsg.messageId || gIdx}
                                                className="relative aspect-square rounded-lg overflow-hidden border border-black/5 bg-black/5 cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setPreviewMedia({ type: gMsg.type as 'image' | 'video', url: gMediaUrl })}
                                              >
                                                {isImg ? (
                                                  <img src={gMediaUrl} alt="Attachment" className="w-full h-full object-cover" />
                                                ) : (
                                                  <div className="w-full h-full relative">
                                                    <video src={gMediaUrl} className="w-full h-full object-cover pointer-events-none" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                      <Play size={14} fill="white" className="text-white" />
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {item.type === 'single' && (
                                      <>
                                        {msg.type === 'text' && (
                                          <p className="whitespace-pre-wrap">{msg.content}</p>
                                        )}

                                        {msg.type === 'image' && mediaUrl && (
                                           <div 
                                             className="rounded-lg overflow-hidden border border-black/5 max-w-xs cursor-pointer hover:opacity-95 transition-opacity relative group/media"
                                           >
                                             <img 
                                               src={mediaUrl} 
                                               alt="Attachment" 
                                               className="w-full h-auto object-cover max-h-48" 
                                               onClick={() => !msg.isUploading && setPreviewMedia({ type: 'image', url: mediaUrl, name: msg.fileMetadata?.fileName || 'image.jpg' })}
                                             />
                                             {!msg.isUploading && (
                                               <button
                                                 type="button"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleDownloadFile(msg.fileMetadata?.url || mediaUrl, msg.fileMetadata?.fileName || 'image.jpg');
                                                 }}
                                                 className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black text-white opacity-0 group-hover/media:opacity-100 transition-opacity cursor-pointer z-10"
                                                 title="Download original file"
                                               >
                                                 <Download size={14} />
                                               </button>
                                             )}
                                             {msg.isUploading && (
                                               <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-1.5 z-20">
                                                 <Loader className="animate-spin text-white" size={18} />
                                                 <span className="text-[9px] uppercase tracking-wider font-bold">Uploading...</span>
                                               </div>
                                             )}
                                           </div>
                                         )}

                                         {msg.type === 'video' && mediaUrl && (
                                           <div 
                                             className="rounded-lg overflow-hidden border border-black/5 max-w-xs cursor-pointer relative group/media hover:opacity-95 transition-opacity"
                                           >
                                             <div className="w-full h-full relative" onClick={() => !msg.isUploading && setPreviewMedia({ type: 'video', url: mediaUrl, name: msg.fileMetadata?.fileName || 'video.mp4' })}>
                                               <video src={mediaUrl} className="w-full h-auto max-h-48 pointer-events-none" />
                                               <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors">
                                                 <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white border border-white/30 transition-transform group-hover:scale-110">
                                                   <Play size={20} fill="white" className="ml-0.5" />
                                                 </div>
                                               </div>
                                             </div>
                                             {!msg.isUploading && (
                                               <button
                                                 type="button"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleDownloadFile(msg.fileMetadata?.url || mediaUrl, msg.fileMetadata?.fileName || 'video.mp4');
                                                 }}
                                                 className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black text-white opacity-0 group-hover/media:opacity-100 transition-opacity cursor-pointer z-10"
                                                 title="Download original file"
                                               >
                                                 <Download size={14} />
                                               </button>
                                             )}
                                             {msg.isUploading && (
                                               <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-1.5 z-20">
                                                 <Loader className="animate-spin text-white" size={18} />
                                                 <span className="text-[9px] uppercase tracking-wider font-bold">Uploading...</span>
                                               </div>
                                             )}
                                           </div>
                                         )}

                                         {msg.type === 'audio' && mediaUrl && (
                                           <div className="py-1 relative rounded-lg overflow-hidden">
                                             <audio src={mediaUrl} controls className="w-full max-w-[240px] h-8" />
                                             {msg.isUploading && (
                                               <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center text-white gap-1.5 z-20">
                                                 <Loader className="animate-spin text-white" size={14} />
                                               </div>
                                             )}
                                           </div>
                                         )}

                                         {msg.type === 'document' && (
                                           <div className="relative flex flex-col gap-2 p-2.5 rounded-xl bg-black/10 dark:bg-black/30 border border-[var(--border)] min-w-[200px] max-w-[280px] overflow-hidden">
                                             <div className="flex items-center gap-2.5 min-w-0">
                                               <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                                                 <FileText size={18} />
                                               </div>
                                               <div className="text-xs text-left min-w-0 flex-1">
                                                 <p className="font-bold truncate text-[var(--text-primary)]" title={msg.fileMetadata?.fileName}>
                                                   {msg.fileMetadata?.fileName || 'Document'}
                                                 </p>
                                                 <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
                                                   {msg.fileMetadata?.fileSize ? `${(msg.fileMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                                                 </p>
                                               </div>
                                             </div>
                                             
                                             <div className="flex gap-2 mt-1 border-t pt-2 border-black/5 dark:border-white/5">
                                               <button
                                                 type="button"
                                                 disabled={msg.isUploading}
                                                 onClick={() => setPreviewMedia({ type: 'document', url: msg.fileMetadata?.url || mediaUrl, name: msg.fileMetadata?.fileName || 'Document' })}
                                                 className="flex-1 py-1 px-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[10px] font-bold text-center border border-[var(--border)] transition-colors cursor-pointer disabled:opacity-30"
                                               >
                                                 View
                                               </button>
                                               <button
                                                 type="button"
                                                 disabled={msg.isUploading}
                                                 onClick={() => handleDownloadFile(msg.fileMetadata?.url || mediaUrl, msg.fileMetadata?.fileName || 'document')}
                                                 className="flex-1 py-1 px-2 rounded-lg bg-[var(--primary)] hover:opacity-90 text-[10px] font-bold text-center text-white transition-colors cursor-pointer disabled:opacity-30"
                                               >
                                                 Download
                                               </button>
                                             </div>

                                             {msg.isUploading && (
                                               <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-1.5 z-20">
                                                 <Loader className="animate-spin text-white" size={16} />
                                                 <span className="text-[9px] uppercase tracking-wider font-bold">Uploading...</span>
                                               </div>
                                             )}
                                           </div>
                                         )}

                                        {(msg.type === 'voice_note' || msg.type === 'voice') && (
                                          <VoiceNoteBubble msg={msg} resolveUrl={resolveMediaUrl} />
                                        )}
                                      </>
                                    )}
                                  </>
                                )}

                              </div>
                              
                              {/* Time & Read Receipts */}
                              <div className={`flex items-center gap-1.5 mt-1 ${isSelf ? 'justify-end' : ''}`}>
                                <span className="text-[10px] text-stone-400" style={{ color: 'var(--text-muted)' }}>
                                  {msg.isUploading ? 'Staging...' : formattedTime}
                                </span>
                                {isSelf && !msg.isDeleted && (
                                  <span className="flex items-center select-none animate-fade-in" style={{ lineHeight: 1 }}>
                                    {msg.isUploading ? (
                                      <Loader className="animate-spin text-stone-400" size={10} />
                                    ) : msg.uploadFailed ? (
                                      <span className="text-red-500 font-bold text-xs" title="Upload Failed">⚠️</span>
                                    ) : isRead ? (
                                      <span className="text-red-500 font-bold text-xs" style={{ color: 'var(--primary)' }} title="Read">✓✓</span>
                                    ) : isDelivered ? (
                                      <span className="text-stone-400 text-xs" title="Delivered">✓✓</span>
                                    ) : (
                                      <span className="text-stone-400 text-xs" title="Sent">✓</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br flex-shrink-0 ${getUserInfo(typingUsers[0]).color}`}>
                      {getUserInfo(typingUsers[0]).initials}
                    </div>
                    <div className="bubble-other p-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-505 ml-1">
                        {getUserInfo(typingUsers[0]).name.split(' ')[0]} is typing…
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input / Recording panel */}
              <div className="p-4 border-t flex-shrink-0"
                   style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

                {/* Staging bar preview for pendingFiles */}
                {pendingFiles.length > 0 && !isRecording && (
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-thin border-b" style={{ borderColor: 'var(--border)' }}>
                    {pendingFiles.map((file, idx) => {
                      const isImg = file.type.startsWith('image/');
                      const isVid = file.type.startsWith('video/');
                      const url = (isImg || isVid) ? URL.createObjectURL(file) : '';
                      return (
                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border bg-black/10 flex-shrink-0 flex items-center justify-center animate-fade-in" style={{ borderColor: 'var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 hover:bg-black text-white z-10 cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                          {isImg ? (
                            <img src={url} alt="staging" className="w-full h-full object-cover" />
                          ) : isVid ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                              <video src={url} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Play size={10} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <FileText size={20} className="text-stone-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {isRecording ? (
                  // Voice Recording UI
                  <div className="flex items-center justify-between px-4 py-2 rounded-2xl border"
                       style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm font-semibold text-stone-500 dark:text-stone-305">Recording Voice...</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-950/40 text-red-400 font-mono">
                        {formatTime(recordingDuration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelVoiceRecording}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-stone-550 transition-colors"
                        title="Cancel Recording"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={stopVoiceRecording}
                        className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md animate-pulse"
                        title="Send Recording"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-white transition-all flex-shrink-0"
                      title="Attach file">
                      <Paperclip size={18} />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileAttach}
                    />

                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={`Write to ${otherUser?.name || 'Archive colleague'}...`}
                        value={inputText}
                        onChange={handleInputChange}
                        className="w-full px-3 xs:px-4 py-2.5 text-xs rounded-xl outline-none border transition-colors"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      />
                      
                      {/* Emoji Picker toggle button */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-all flex-shrink-0 cursor-pointer ${showEmojiPicker ? 'text-[var(--primary)]' : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-white'}`}
                        title="Insert emoji">
                        <Smile size={18} />
                      </button>
                      
                      {/* Emoji picker popover */}
                      {showEmojiPicker && (
                        <div 
                          className="absolute bottom-10 left-0 bg-[var(--bg-card)] border rounded-2xl p-2.5 shadow-xl z-50 grid grid-cols-6 gap-1.5 w-44 animate-fade-in"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {['😀', '😂', '🥰', '👍', '🙏', '❤️', '🔥', '✨', '👏', '🎉', '🌟', '💡'].map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setInputText(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="text-base hover:scale-125 transition-transform flex items-center justify-center p-1 rounded hover:bg-[var(--bg-elevated)] cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mic Button */}
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-white transition-all flex-shrink-0 xs-input-hide"
                      title="Record Voice Note">
                      <Mic size={18} />
                    </button>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!inputText.trim() && pendingFiles.length === 0}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0 shadow-sm"
                      style={{ 
                        background: (inputText.trim() || pendingFiles.length > 0) ? 'var(--primary)' : 'rgba(0,0,0,0.05)', 
                        cursor: (inputText.trim() || pendingFiles.length > 0) ? 'pointer' : 'default' 
                      }}>
                      <Send size={15} />
                    </button>
                  </form>
                )}
              </div>

              {/* Scroll to Bottom Button */}
              {showScrollBottom && (
                <button
                  onClick={() => {
                    scrollToBottom();
                    setShowScrollBottom(false);
                  }}
                  className="absolute bottom-24 right-6 w-9 h-9 rounded-full text-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all z-30 border border-white/10"
                  style={{ background: 'var(--primary)' }}
                  title="Scroll to bottom"
                >
                  <ChevronDown size={20} />
                </button>
              )}

            </div>
          </div>
        </main>
          )}

          {/* Column 4: Right Profile & Shared Archive Side-Panel */}
          {selectedThreadId && otherUser && (
            <div className="mobile-hide laptop-hide flex-shrink-0">
              <ProfileSidebar 
                threadId={selectedThreadId} 
                currentUser={currentUser} 
                otherUser={otherUser}
                onReportClick={() => setShowReportModal(true)}
                onJumpToMessage={handleJumpToMessage}
              />
            </div>
          )}
        </div>
      )}

      {/* Incoming Call Modal Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="glass p-8 rounded-3xl max-w-sm w-full mx-4 border border-white/10 text-center relative shadow-2xl"
               style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 relative">
              <Phone className="text-red-500 animate-bounce" size={28} style={{ color: 'var(--primary)' }} />
              <div className="absolute inset-0 rounded-full border border-red-500/20 animate-ping" />
            </div>
            
            <h3 className="text-xl font-bold mb-1 text-white">Incoming Connection</h3>
            <p className="text-sm text-gray-400 mb-6">
              {getUserInfo(incomingCall.senderId).name} is requesting a video call session.
            </p>

            <div className="flex gap-4 justify-center">
              <button
                onClick={declineCall}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-305 font-semibold text-xs transition-all hover:bg-white/5 active:scale-[0.98]">
                Decline
              </button>
              <button
                onClick={() => {
                  setSelectedThreadId(incomingCall.threadId);
                  acceptCall();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-red-950/20"
                style={{ background: 'var(--primary)' }}>
                Accept Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Connection Modal Overlay */}
      {showReportModal && otherUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="glass p-6 rounded-3xl max-w-sm w-full mx-4 border relative shadow-2xl"
               style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <ShieldAlert className="text-red-500" size={24} style={{ color: 'var(--primary)' }} />
            </div>

            <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Report Connection
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              Provide a reason for reporting your connection with <strong>{otherUser.name}</strong>. This will be logged for administrative review.
            </p>

            <textarea
              placeholder="Specify safety concern, inappropriate behavior, or other reasons..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-24 p-3 text-xs rounded-xl outline-none border mb-4 resize-none transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
                disabled={reporting}
                className="px-4 py-2 rounded-xl border border-opacity-10 text-xs font-semibold transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={handleReportConnection}
                disabled={reporting || !reportReason.trim()}
                className="px-4 py-2 rounded-xl text-white font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'var(--primary)' }}>
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'home' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <HomeDashboard 
            currentUser={currentUser} 
            token={currentUser.id} 
            onNavigate={setActiveTab} 
            onPlayStory={(story) => { 
              setAutoplayStory(story); 
              setActiveTab('archive'); 
            }} 
            onViewProfile={setViewedProfileUserId}
            onShowNotifications={() => setShowNotifications(true)}
          />
        </div>
      )}

      {activeTab === 'wisdom' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <WisdomHub 
            currentUser={currentUser} 
            token={currentUser.id} 
          />
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <MemoryArchive 
            currentUser={currentUser} 
            token={currentUser.id} 
            autoPlayStory={autoplayStory} 
            onClearAutoPlay={() => setAutoplayStory(null)} 
          />
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <SettingsView 
            currentUser={currentUser} 
            onProfileUpdate={(updatedUser) => {
              setCurrentUser(updatedUser);
              const usersJson = localStorage.getItem('users_list') || sessionStorage.getItem('users_list');
              if (usersJson) {
                try {
                  const users = JSON.parse(usersJson);
                  const updatedUsers = users.map((u: any) => (u.id === updatedUser.id || u._id === updatedUser.id) ? { ...u, ...updatedUser } : u);
                  localStorage.setItem('users_list', JSON.stringify(updatedUsers));
                  sessionStorage.setItem('users_list', JSON.stringify(updatedUsers));
                } catch (e) {
                  console.error('Failed to update users_list cache:', e);
                }
              }
            }}
            onLogout={handleLogout}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onNavigate={setActiveTab}
          />
        </div>
      )}

      {activeTab === 'mentoring' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <MentoringHub 
            currentUser={currentUser} 
            token={sessionStorage.getItem('token') || localStorage.getItem('token') || currentUser.id} 
            onStartChat={async (otherUserId) => {
              try {
                const thread = await getOrCreateThread(currentUser.id, otherUserId);
                setSelectedThreadId(thread.threadId);
                setActiveTab('messages');
              } catch (err) {
                console.error('Failed to start thread:', err);
              }
            }}
            onViewProfile={setViewedProfileUserId}
          />
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(138,30,36,0.12)' }}>
                  <Bell size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <h2 className="text-base font-bold font-serif" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{notifications.filter(n => !n.isRead).length} unread</p>
                </div>
              </div>
              {notifications.length > 0 && (
                <button
                  onClick={async () => {
                    for (const n of notifications) {
                      if (!n.isRead) await handleMarkNotificationRead(n.notificationId);
                    }
                  }}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-xl border transition-all hover:scale-[1.02]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {getDisplayNotifications().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(138,30,36,0.08)' }}>
                    <Bell size={28} style={{ color: 'var(--primary)', opacity: 0.4 }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-secondary)' }}>All caught up!</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No notifications right now.</p>
                  </div>
                </div>
              ) : (
                getDisplayNotifications().map((n) => {
                  const typeIconMap: Record<string, { icon: string; label: string }> = {
                    'chat_message': { icon: '💬', label: 'Message' },
                    'mentoring_request': { icon: '🤝', label: 'Mentoring' },
                    'mentoring_accepted': { icon: '✅', label: 'Mentoring' },
                    'mentoring_cancelled': { icon: '🚫', label: 'Mentoring' },
                    'interview_proposal': { icon: '📋', label: 'Interview' },
                    'interview_confirmed': { icon: '✅', label: 'Interview' },
                    'story_approved': { icon: '📖', label: 'Archive' },
                    'story_rejected': { icon: '❌', label: 'Archive' },
                    'badge_awarded': { icon: '🏅', label: 'Badge' },
                  };
                  const typeMeta = typeIconMap[n.type] || { icon: '🔔', label: 'Notification' };
                  const displayTitle = n._displayTitle || n.title || 'Notification';
                  const displayMessage = n._displayMessage || n.message;
                  const unreadCount = n._unreadCount || 0;

                  return (
                    <div
                      key={n.notificationId}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] group ${
                        !n.isRead ? 'border-red-500/15 bg-red-500/5' : ''
                      }`}
                      style={n.isRead ? { borderColor: 'var(--border)', background: 'var(--bg-card)' } : {}}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                        !n.isRead ? 'bg-red-500/10' : 'bg-stone-500/10'
                      }`}>
                        {typeMeta.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-bold ${n.isRead ? 'opacity-70' : ''}`} style={{ color: 'var(--text-primary)' }}>
                              {displayTitle}
                            </span>
                            {unreadCount > 0 && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                                {unreadCount}
                              </span>
                            )}
                            <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-stone-500/15" style={{ color: 'var(--text-muted)' }}>
                              {typeMeta.label}
                            </span>
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteNotification(n.notificationId); }}
                            className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-500/10 flex-shrink-0"
                            title="Delete notification"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-relaxed ${n.isRead ? 'opacity-60' : ''}`} style={{ color: 'var(--text-secondary)' }}>
                          {displayMessage}
                        </p>
                        <span className="text-[9px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
                          {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && currentUser.role === 'Admin' && (
        <div className="flex-1 h-full w-full overflow-hidden flex flex-col pb-16 md:pb-0">
          <AdminConsole 
            token={sessionStorage.getItem('token') || localStorage.getItem('token') || ''} 
            currentUser={currentUser} 
          />
        </div>
      )}

      {/* Notifications Legacy Modal (mobile bell icon) */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowNotifications(false)}>
          <div className="glass p-6 rounded-3xl max-w-md w-full mx-4 border relative shadow-2xl space-y-4"
               style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold font-serif" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
              <button 
                onClick={() => setShowNotifications(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
              {getDisplayNotifications().length === 0 ? (
                <div className="text-center py-8 text-stone-500 text-xs">No new notifications.</div>
              ) : (
                getDisplayNotifications().map((n) => {
                  const typeIconMap: Record<string, string> = {
                    'chat_message': '💬',
                    'mentoring_request': '🤝',
                    'mentoring_accepted': '✅',
                    'mentoring_cancelled': '🚫',
                    'interview_proposal': '📋',
                    'badge_awarded': '🏅',
                    'story_approved': '📖',
                    'story_rejected': '❌',
                  };
                  const displayTitle = n._displayTitle || n.title || 'Notification';
                  const displayMessage = n._displayMessage || n.message;
                  const unreadCount = n._unreadCount || 0;

                  return (
                    <div
                      key={n.notificationId}
                      className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.99] group ${
                        n.isRead ? 'opacity-65' : 'bg-red-500/5 border-red-500/10'
                      }`}
                      style={n.isRead ? { borderColor: 'var(--border)' } : {}}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <span className="text-base flex-shrink-0 mt-0.5">{typeIconMap[n.type] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${n.isRead ? 'text-stone-400' : 'text-stone-200'}`}>{displayTitle}</span>
                          {unreadCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unreadCount}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed mt-0.5">{displayMessage}</p>
                        <span className="text-[9px] text-stone-500 mt-1 block">
                          {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteNotification(n.notificationId); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal overlay */}
      {viewedProfileUserId && (
        <UserProfileModal 
          userId={viewedProfileUserId} 
          currentUserId={currentUser?.id || (currentUser as any)?._id}
          onClose={() => setViewedProfileUserId(null)}
          onStartChat={async (otherUserId) => {
            try {
              const thread = await getOrCreateThread(currentUser.id, otherUserId);
              setSelectedThreadId(thread.threadId);
              setActiveTab('messages');
            } catch (err) {
              console.error('Failed to start thread:', err);
            }
          }}
        />
      )}

      {/* About Info Modal overlay */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowInfoModal(false)}>
          <div className="glass p-6 rounded-3xl max-w-md w-full mx-4 border relative shadow-2xl space-y-4 text-center"
               style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
               onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            >
              <X size={16} />
            </button>
            
            <div className="w-14 h-14 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-md mx-auto mb-2">
              <Info size={28} style={{ color: 'var(--primary)' }} />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-serif font-black" style={{ color: 'var(--text-primary)' }}>Digital Roots</h3>
              <p className="text-xs uppercase font-extrabold tracking-widest text-stone-505 dark:text-stone-400">Bridging Generations</p>
              <p className="text-xs leading-relaxed text-stone-605 dark:text-stone-300 pt-2 text-left">
                Digital Roots is an interactive platform built to connect youth with experienced seniors. Our mission is to share life lessons, career advice, and general wisdom, bridging generations through live conversations, mentorship pairings, and a generalized knowledge and media library.
              </p>
            </div>

            <div className="border-t pt-4 flex flex-col gap-2 text-left" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between text-[10px] text-stone-550 font-semibold">
                <span>App Version</span>
                <span className="font-mono text-stone-400">v1.2.0</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-550 font-semibold">
                <span>Connection Status</span>
                <span className="text-emerald-500 font-bold">Secure (E2EE)</span>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 rounded-xl text-white font-bold text-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer mt-2"
              style={{ background: 'var(--primary)' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {!(activeTab === 'messages' && selectedThreadId) && (
        <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 h-16 bg-[var(--bg-card)] border-t border-opacity-10 z-40 items-center justify-around px-1 hidden"
             style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <button 
            onClick={() => setActiveTab('home')}
            type="button"
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'home' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <Home size={16} />
            <span className="truncate w-full text-center">{t('home')}</span>
            {notifications.filter(n => !n.isRead && n.type === 'badge_awarded').length > 0 && (
              <span className="absolute top-0 right-2 bg-red-500 text-white text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-bold">
                {notifications.filter(n => !n.isRead && n.type === 'badge_awarded').length}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveTab('messages')}
            type="button"
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'messages' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <MessageSquare size={16} />
            <span className="truncate w-full text-center">{t('messages')}</span>
            {notifications.filter(n => !n.isRead && n.type === 'chat_message').length > 0 && (
              <span className="absolute top-0 right-2 bg-red-500 text-white text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-bold">
                {notifications.filter(n => !n.isRead && n.type === 'chat_message').length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('archive')}
            type="button"
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'archive' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <BookOpen size={16} />
            <span className="truncate w-full text-center">{t('archive')}</span>
            {notifications.filter(n => !n.isRead && ['story_approved', 'story_rejected'].includes(n.type)).length > 0 && (
              <span className="absolute top-0 right-2 bg-red-500 text-white text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-bold">
                {notifications.filter(n => !n.isRead && ['story_approved', 'story_rejected'].includes(n.type)).length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('wisdom')}
            type="button"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'wisdom' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <Users size={16} />
            <span className="truncate w-full text-center">{t('wisdom')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('mentoring')}
            type="button"
            className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'mentoring' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <Award size={16} />
            <span className="truncate w-full text-center">{t('mentoring')}</span>
            {notifications.filter(n => !n.isRead && ['mentoring_request', 'mentoring_accepted', 'interview_proposal', 'interview_confirmed'].includes(n.type)).length > 0 && (
              <span className="absolute top-0 right-1 bg-red-500 text-white text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-bold">
                {notifications.filter(n => !n.isRead && ['mentoring_request', 'mentoring_accepted', 'interview_proposal', 'interview_confirmed'].includes(n.type)).length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            type="button"
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 text-[8.5px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              activeTab === 'settings' ? 'text-[var(--primary)] font-extrabold font-serif' : 'text-stone-400 dark:text-stone-500 hover:text-[var(--text-primary)]'
            }`}>
            <Settings size={16} />
            <span className="truncate w-full text-center">{t('settings')}</span>
          </button>
        </nav>
      )}

      {/* Connection Info Drawer Modal Overlay for Mobile */}
      {showProfileSidebarModal && selectedThreadId && otherUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowProfileSidebarModal(false)}>
          <div 
            className="w-full max-w-[300px] h-full bg-[var(--bg-card)] border-l flex flex-col shadow-2xl animate-slide-in relative"
            style={{ borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="h-16 px-6 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <span className="font-bold text-sm text-[var(--text-primary)]">Information</span>
              <button 
                onClick={() => setShowProfileSidebarModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-550 hover:bg-[var(--bg-elevated)] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto">
              <ProfileSidebar 
                threadId={selectedThreadId} 
                currentUser={currentUser} 
                otherUser={otherUser}
                onReportClick={() => {
                  setShowProfileSidebarModal(false);
                  setShowReportModal(true);
                }}
                onJumpToMessage={(msgId) => {
                  setShowProfileSidebarModal(false);
                  handleJumpToMessage(msgId);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Lightbox Modal Overlay */}
      {previewMedia && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4"
          onClick={() => setPreviewMedia(null)}
        >
          {/* Action buttons in top-right */}
          <div className="absolute top-4 right-4 flex items-center gap-3 z-[110]" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => handleDownloadFile(previewMedia.url, previewMedia.name || 'downloaded-file')}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Download original file"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={() => setPreviewMedia(null)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close preview"
            >
              <X size={20} />
            </button>
          </div>

          {/* Media Container */}
          <div 
            className="relative max-w-full max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {previewMedia.type === 'image' && (
              <img 
                src={previewMedia.url} 
                alt="Enlarged view" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl animate-scale-in" 
              />
            )}
            
            {previewMedia.type === 'video' && (
              <video 
                src={previewMedia.url} 
                controls 
                autoPlay 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl animate-scale-in" 
              />
            )}

            {previewMedia.type === 'document' && (() => {
              const isPdf = previewMedia.name?.toLowerCase().endsWith('.pdf') || previewMedia.url.toLowerCase().includes('.pdf');
              const isTxt = previewMedia.name?.toLowerCase().endsWith('.txt') || previewMedia.name?.toLowerCase().endsWith('.log') || previewMedia.name?.toLowerCase().endsWith('.json');
              
              if (isPdf) {
                return (
                  <iframe 
                    src={previewMedia.url} 
                    className="w-[85vw] h-[80vh] rounded-xl border border-white/10 shadow-2xl bg-white animate-scale-in" 
                    title={previewMedia.name}
                  />
                );
              }

              if (isTxt) {
                return <TextViewer url={previewMedia.url} name={previewMedia.name || 'Document'} />;
              }

              return (
                <div className="glass p-8 rounded-3xl max-w-sm w-full mx-4 border border-white/10 text-center text-white space-y-4 animate-scale-in"
                     style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                  <FileText size={48} className="mx-auto text-red-500" />
                  <h4 className="font-bold truncate text-sm">{previewMedia.name}</h4>
                  <p className="text-xs text-stone-400">Previews for this file format are not supported directly in the browser.</p>
                  <button 
                    onClick={() => handleDownloadFile(previewMedia.url, previewMedia.name || 'document')}
                    className="w-full py-2.5 bg-[var(--primary)] hover:opacity-90 rounded-xl text-xs font-bold transition-all text-white cursor-pointer"
                  >
                    Download Original File
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Custom styled voice bubble component for managing play state, timer, and transcript collapse
interface VoiceBubbleProps {
  msg: Message;
  resolveUrl: (url: string) => string;
}

function VoiceNoteBubble({ msg, resolveUrl }: VoiceBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.fileMetadata?.duration || msg.duration || 0);
  const [showTranscript, setShowTranscript] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !duration) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [msg, duration]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const mediaUrl = msg.mediaUrl || msg.fileMetadata?.url || '';

  return (
    <div className="flex flex-col gap-2 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={resolveUrl(mediaUrl)} preload="metadata" className="hidden" />
      
      {/* Audio controls card */}
      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-black/20 border border-white/5">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-black hover:bg-gray-200 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={14} fill="black" /> : <Play size={14} fill="black" className="ml-0.5" />}
        </button>

        {/* Progress slider */}
        <div className="flex-1 flex flex-col min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSliderChange}
            className="w-full accent-red-500 h-1 bg-white/10 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
            <span>{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>
      </div>

      {/* Transcription section */}
      <div className="text-xs p-2 rounded-lg bg-black/15 border border-white/5 text-left">
        {msg.transcriptStatus === 'pending' && (
          <div className="flex items-center gap-2 text-gray-400 italic">
            <Loader className="animate-spin text-red-500" size={12} />
            <span>Processing transcription...</span>
          </div>
        )}

        {msg.transcriptStatus === 'failed' && (
          <span className="text-red-400/90 italic">Transcription failed — tap to retry or check your connection.</span>
        )}

        {msg.transcriptStatus === 'completed' && (() => {
          const transcriptText = msg.transcript || msg.content || '';
          const isStandby = transcriptText.includes('Transcription Service Standby') || transcriptText.includes('API key not set');

          if (isStandby) {
            return (
              <span className="text-amber-400/80 italic text-[10px]">
                🔑 Transcription unavailable — OpenAI API key not configured.
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-1 font-semibold text-[10px] text-red-400 hover:text-red-300 transition-colors">
                {showTranscript ? (
                  <>
                    <ChevronUp size={11} />
                    Hide Transcript
                  </>
                ) : (
                  <>
                    <ChevronDown size={11} />
                    Show Transcript
                  </>
                )}
              </button>
              {showTranscript && (
                <p className="text-gray-300 text-xs leading-relaxed italic border-t border-white/5 pt-1.5 mt-1 select-text">
                  &ldquo;{transcriptText}&rdquo;
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Custom styled text viewer component for previewing text documents in the chat lightbox
function TextViewer({ url, name }: { url: string; name: string }) {
  const [content, setContent] = useState<string>('Loading document text...');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to read file');
        const text = await response.text();
        if (active) {
          setContent(text);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setContent(`Failed to load text content: ${err.message}`);
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [url]);

  return (
    <div className="w-[80vw] max-w-2xl h-[70vh] rounded-xl border border-white/10 bg-[#16161a]/95 text-gray-200 flex flex-col overflow-hidden p-6 font-sans">
      <div className="border-b border-white/5 pb-3 mb-4 flex items-center justify-between flex-shrink-0">
        <h4 className="font-bold truncate text-sm text-white">{name}</h4>
        {loading && <Loader className="animate-spin text-red-500" size={14} />}
      </div>
      <div className="flex-1 overflow-auto bg-black/40 rounded-lg p-4 font-mono text-xs text-left leading-relaxed whitespace-pre-wrap select-text border border-white/5">
        {content}
      </div>
    </div>
  );
}
