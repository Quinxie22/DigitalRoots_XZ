import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Mic, Paperclip, Phone, Edit3, Check, X, 
  Play, Pause, Loader, FileText, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import type { User, Message, Thread as ThreadType, Caption } from './types';
import { 
  getMessages, sendTextMessage, updateTopic, sendVoiceNote, uploadFile, resolveMediaUrl, markMessagesAsRead, deleteMessage 
} from './api';
import { socket } from './socket';
import { useWebRTC } from './hooks/useWebRTC';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import CallView from './components/CallView';
import SharedArchive from './components/SharedArchive';

const ALL_USERS = [
  { id: 'user-arthur', name: 'Arthur Miller', initials: 'AM', color: 'from-red-700 to-red-900' },
  { id: 'user-sarah',  name: 'Sarah Chen',    initials: 'SC', color: 'from-purple-700 to-purple-900' },
  { id: 'user-tessa',  name: 'Tessa Elvis',   initials: 'TE', color: 'from-rose-600 to-pink-900' },
  { id: 'user-felix',  name: 'Felix Kamau',   initials: 'FK', color: 'from-blue-700 to-blue-900' },
];

function getUserInfo(userId: string) {
  return ALL_USERS.find((u) => u.id === userId) ?? {
    id: userId, name: userId, initials: userId.slice(0, 2).toUpperCase(), color: 'from-gray-600 to-gray-800',
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  
  // Chat messaging states
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Connect / disconnect socket
  useEffect(() => {
    if (currentUser) {
      socket.auth = { token: currentUser.id };
      socket.connect();

      const handleConnect = () => {
        console.log('Socket connected successfully');
        if (selectedThreadId) {
          socket.emit('join-thread', selectedThreadId);
        }
      };

      socket.on('connect', handleConnect);

      if (socket.connected && selectedThreadId) {
        socket.emit('join-thread', selectedThreadId);
      }

      return () => {
        socket.off('connect', handleConnect);
        socket.disconnect();
      };
    }
  }, [currentUser, selectedThreadId]);

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
        const data = await getMessages(currentUser.id, selectedThreadId);
        setMessages(data.messages ?? []);
        
        // Find current thread configuration
        const otherParticipantId = selectedThreadId.split('_').find(id => id !== currentUser.id) || '';
        setActiveThread({
          threadId: selectedThreadId,
          participants: [currentUser.id, otherParticipantId],
          threadType: 'direct',
          discussionTopic: data.messages?.[0]?.threadTopic || 'The first road trip across the coast, 1958'
        });
        
        scrollToBottom();
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
    if (!inputText.trim() || !currentUser || !selectedThreadId) return;

    // Stop typing indicator
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing-stop', { threadId: selectedThreadId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    const text = inputText;
    setInputText('');

    try {
      const message = await sendTextMessage(currentUser.id, selectedThreadId, text);
      setMessages(prev => {
        if (prev.some(m => m.messageId === message.messageId)) return prev;
        return [...prev, message];
      });
      scrollToBottom();
    } catch (err) {
      console.error('Failed to send text message:', err);
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser || !selectedThreadId) return;
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
  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUser || !selectedThreadId) return;
    try {
      for (const file of Array.from(files)) {
        const message = await uploadFile(currentUser.id, selectedThreadId, file);
        setMessages(prev => {
          if (prev.some(m => m.messageId === message.messageId)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error('File upload shortcut failed:', err);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentUser) {
    return <Login onLogin={(user) => setCurrentUser(user)} />;
  }

  const otherUser = selectedThreadId 
    ? getUserInfo(selectedThreadId.split('_').find(id => id !== currentUser.id) || '')
    : null;

  const otherIsOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;

  return (
    <div className="flex h-screen w-screen overflow-hidden select-none bg-[#0a0a0f]"
         style={{ color: 'var(--text-primary)' }}>
      
      {/* 1. Left Sidebar Panel */}
      <Sidebar 
        currentUser={currentUser} 
        selectedThreadId={selectedThreadId} 
        onSelectThread={(id) => setSelectedThreadId(id)}
        onStartCall={handleStartCall}
        onlineUsers={onlineUsers}
      />

      {/* 2. Middle Main Chat/Call Window */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0c0c14]">
        
        {!selectedThreadId ? (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5 blur-[120px]"
                 style={{ background: 'var(--primary)' }} />
            
            <div className="glass p-10 rounded-3xl max-w-md border border-white border-opacity-5 relative z-10">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-3xl mx-auto mb-6 shadow-2xl"
                   style={{ background: 'var(--primary)', boxShadow: '0 8px 32px rgba(220,38,38,0.3)' }}>
                XZ
              </div>
              <h2 className="text-2xl font-bold mb-3">Live Connection Hub</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Select a colleague from the sidebar to establish a high-fidelity video link, synchronize documents, or exchange secure messages.
              </p>
            </div>
          </div>
        ) : (
          // Active Conversation Panel
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

                {/* Subtitle / Caption scrolling ticker overlay */}
                {showCaptions && captions.length > 0 && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[85%] max-h-24 overflow-y-auto rounded-xl p-3 flex flex-col gap-1.5 pointer-events-none select-none z-30"
                       style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {captions.slice(-3).map((cap, i) => (
                      <div key={i} className="text-xs flex gap-1.5 caption-enter">
                        <span className="font-semibold text-red-500 whitespace-nowrap">{cap.senderName || 'Speaker'}:</span>
                        <span className="text-gray-100">{cap.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Middle Chat Pane (below CallView if calling, or 100% height) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              
              {/* Chat Pane Header */}
              <div className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b"
                   style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
                <div className="flex flex-col min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {otherUser?.name}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{
                            background: otherIsOnline ? '#22c55e' : '#6b7280',
                            transition: 'background 0.3s ease',
                          }} />
                    {!otherIsOnline && (
                      <span className="text-[10px] text-gray-500">offline</span>
                    )}
                  </div>
                  
                  {/* Topic Edit / Display */}
                  <div className="flex items-center gap-1.5 text-xs mt-0.5 truncate select-none text-gray-400">
                    <span className="font-semibold text-red-500 whitespace-nowrap">TOPIC:</span>
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
                        <span className="truncate italic">
                          "{activeThread?.discussionTopic || 'The first road trip across the coast, 1958'}"
                        </span>
                        <Edit3 size={11} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Button (visible if not currently calling) */}
                {!isInCall && (
                  <button
                    onClick={() => handleStartCall(selectedThreadId, otherUser?.id || '')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98] shadow-md shadow-red-950/20"
                    style={{ background: 'var(--primary)' }}>
                    <Phone size={13} />
                    Call Session
                  </button>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-grow overflow-y-auto px-6 py-4 space-y-4" style={{ background: '#09090f' }}>
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
                  messages.map((msg, i) => {
                    const isSelf = msg.senderId === currentUser.id;
                    const sender = getUserInfo(msg.senderId);
                    const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const otherParticipantId = selectedThreadId ? (selectedThreadId.split('_').find(id => id !== currentUser.id) || '') : '';
                    const isRead = msg.readBy?.includes(otherParticipantId);
                    const isDelivered = msg.deliveredTo?.includes(otherParticipantId) || isRead;

                    return (
                      <div key={msg.messageId || i} 
                           className={`flex items-end gap-2.5 max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : ''} animate-fade-in group/msg`}>
                        
                        {/* Sender Avatar */}
                        {!isSelf && (
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br flex-shrink-0 ${sender.color}`}>
                            {sender.initials}
                          </div>
                        )}

                        {/* Bubble */}
                        <div className="flex flex-col relative">
                          {/* Delete button (own messages only, not deleted) */}
                          {isSelf && !msg.isDeleted && (
                            <button
                              onClick={() => handleDeleteMessage(msg.messageId)}
                              className="absolute -left-8 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover/msg:opacity-100 transition-opacity hover:bg-white/10"
                              title="Delete message">
                              <Trash2 size={12} className="text-gray-500 hover:text-red-400" />
                            </button>
                          )}

                          <div className={`p-3.5 text-sm leading-relaxed ${msg.isDeleted ? 'opacity-50 italic' : ''} ${isSelf ? 'bubble-self text-white' : 'bubble-other'}`}>
                            
                            {/* Rendering based on message type */}
                            {msg.isDeleted ? (
                              <p className="text-xs text-gray-400 italic select-none">🚫 This message was deleted</p>
                            ) : (
                              <>
                                {msg.type === 'text' && (
                                  <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}

                                {msg.type === 'image' && msg.fileMetadata?.url && (
                                  <div className="rounded-lg overflow-hidden border border-white/5 max-w-xs">
                                    <img src={resolveMediaUrl(msg.fileMetadata.url)} alt="Attachment" className="w-full h-auto object-cover max-h-48 cursor-pointer" />
                                  </div>
                                )}

                                {msg.type === 'video' && msg.fileMetadata?.url && (
                                  <div className="rounded-lg overflow-hidden border border-white/5 max-w-xs">
                                    <video src={resolveMediaUrl(msg.fileMetadata.url)} controls className="w-full h-auto max-h-48" />
                                  </div>
                                )}

                                {msg.type === 'audio' && msg.fileMetadata?.url && (
                                  <div className="py-1">
                                    <audio src={resolveMediaUrl(msg.fileMetadata.url)} controls className="w-full max-w-[240px] h-8" />
                                  </div>
                                )}

                                {msg.type === 'document' && msg.fileMetadata?.url && (
                                  <a href={resolveMediaUrl(msg.fileMetadata.url)} target="_blank" rel="noopener noreferrer"
                                     className="flex items-center gap-2 p-2 rounded-lg bg-black/25 border border-white/5 hover:bg-black/45 transition-colors">
                                    <FileText size={16} className="text-red-500" />
                                    <div className="text-xs text-left min-w-0">
                                      <p className="font-medium truncate max-w-[150px]">{msg.fileMetadata.fileName || 'Document'}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">
                                        {msg.fileMetadata.fileSize ? `${(msg.fileMetadata.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Download'}
                                      </p>
                                    </div>
                                  </a>
                                )}

                                {(msg.type === 'voice_note' || msg.type === 'voice') && (
                                  <VoiceNoteBubble msg={msg} resolveUrl={resolveMediaUrl} />
                                )}
                              </>
                            )}

                          </div>
                          
                          {/* Time & Read Receipts */}
                          <div className={`flex items-center gap-1 mt-1 ${isSelf ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-gray-500">
                              {formattedTime}
                            </span>
                            {isSelf && !msg.isDeleted && (
                              <span className="flex items-center select-none" style={{ lineHeight: 1 }}>
                                {isRead ? (
                                  <span className="text-red-500 font-bold text-xs" style={{ color: 'var(--primary)' }} title="Read">✓✓</span>
                                ) : isDelivered ? (
                                  <span className="text-gray-500 text-xs" title="Delivered">✓✓</span>
                                ) : (
                                  <span className="text-gray-500 text-xs" title="Sent">✓</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
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
                      <span className="text-xs text-gray-500 ml-1">
                        {getUserInfo(typingUsers[0]).name.split(' ')[0]} is typing…
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input / Recording panel */}
              <div className="p-4 border-t flex-shrink-0 bg-[#0d0d15]"
                   style={{ borderColor: 'var(--border)' }}>
                
                {isRecording ? (
                  // Voice Recording UI
                  <div className="flex items-center justify-between px-4 py-2 rounded-2xl border bg-[#11111a]"
                       style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm font-semibold text-gray-300">Recording Voice...</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-red-950/40 text-red-400 font-mono">
                        {formatTime(recordingDuration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelVoiceRecording}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-white/5 transition-all text-xs font-semibold"
                        title="Cancel">
                        Cancel
                      </button>
                      <button
                        onClick={stopVoiceRecording}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-950/20"
                        title="Send Audio">
                        <Check size={14} />
                        Send Note
                      </button>
                    </div>
                  </div>
                ) : (
                  // Standard Input UI
                  <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                    
                    {/* File Attachment Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-xl flex items-center justify-center border text-gray-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
                      style={{ borderColor: 'var(--border)' }}
                      title="Attach file">
                      <Paperclip size={16} />
                    </button>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileAttach}
                    />

                    {/* Text Input */}
                    <input
                      type="text"
                      placeholder="Type a message..."
                      value={inputText}
                      onChange={handleInputChange}
                      className="flex-grow px-4 py-2.5 text-sm rounded-xl outline-none border"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />

                    {/* Mic Button */}
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className="w-10 h-10 rounded-xl flex items-center justify-center border text-gray-400 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
                      style={{ borderColor: 'var(--border)' }}
                      title="Record Voice Note">
                      <Mic size={16} />
                    </button>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
                      style={{ background: inputText.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.04)', cursor: inputText.trim() ? 'pointer' : 'default' }}>
                      <Send size={16} />
                    </button>
                  </form>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* 3. Right Shared Archive Side-Panel */}
      {selectedThreadId && (
        <SharedArchive threadId={selectedThreadId} currentUser={currentUser} />
      )}

      {/* 4. Incoming Call Modal Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="glass p-8 rounded-3xl max-w-sm w-full mx-4 border border-white/10 text-center relative shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6 relative">
              <Phone className="text-red-500 animate-bounce" size={28} />
              <div className="absolute inset-0 rounded-full border border-red-500/20 animate-ping" />
            </div>
            
            <h3 className="text-xl font-bold mb-1 text-white">Incoming Connection</h3>
            <p className="text-sm text-gray-400 mb-6">
              {getUserInfo(incomingCall.senderId).name} is requesting a video call session.
            </p>

            <div className="flex gap-4 justify-center">
              <button
                onClick={declineCall}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 font-semibold text-xs transition-all hover:bg-white/5 active:scale-[0.98]">
                Decline
              </button>
              <button
                onClick={() => {
                  setSelectedThreadId(incomingCall.threadId);
                  acceptCall();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-red-950/20">
                Accept Call
              </button>
            </div>
          </div>
        </div>
      )}
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
          <span className="text-red-400/90 italic">Speech transcription unavailable</span>
        )}

        {msg.transcriptStatus === 'completed' && (
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
                "{msg.transcript || msg.content}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
