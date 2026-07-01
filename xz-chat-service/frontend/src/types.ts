// ─────────────────────────────────────────────────────────────────────────────
// types.ts
// Central TypeScript type definitions used across the application.
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: 'Arthur' | 'Sarah' | 'Tessa' | 'Felix' | 'Elder' | 'Admin' | 'Youth' | string;
  bio?: string;
  languages?: string[];
  community?: string;
  contentPreferences?: string[];
  legacyCredits?: number;
  badges?: string[];
  age?: number;
}

export interface Message {
  _id?: string;
  messageId: string;
  threadId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice_note' | 'voice';
  content: string;
  timestamp: string;
  fileMetadata?: {
    url: string;
    thumbnailUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
  };
  mediaUrl?: string;
  transcriptStatus?: 'pending' | 'completed' | 'failed';
  transcript?: string;
  duration?: number;
  threadTopic?: string;
  replyTo?: string;
  mentions?: string[];
  readBy?: string[];
  deliveredTo?: string[];
  isDeleted?: boolean;
  isUploading?: boolean;
  uploadFailed?: boolean;
}

export interface Thread {
  _id?: string;
  threadId: string;
  participants: string[];
  threadType: 'direct' | 'group';
  threadName?: string;
  discussionTopic?: string;
  isRecording?: boolean;
  lastMessage?: {
    content: string;
    type: string;
    sentAt: string;
    senderId: string;
  };
  updatedAt?: string;
  unreadCount?: Record<string, number>;
}

export interface Caption {
  senderId: string;
  text: string;
  timestamp: string;
  senderName?: string;
}

export interface CallParticipant {
  userId: string;
  name: string;
  isMuted: boolean;
  isVideoOff: boolean;
  stream?: MediaStream;
}
