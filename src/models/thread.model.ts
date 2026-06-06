import mongoose, { Schema, Document } from 'mongoose';
import { MessageType } from './message.types';

interface ThreadModel extends mongoose.Model<IThread> {
  generateThreadId(participants: string[]): string;
}
export interface IThread extends Document {
  threadId: string;
  participants: string[];
  threadType: 'direct' | 'group';
  threadName?: string; // For group chats
  threadAvatar?: string;
  discussionTopic?: string; // Active call topic
  isRecording?: boolean;    // Active recording state
  activeCall?: {            // Active call state
    hostId: string;
    startTime: Date;
  };
  lastMessage: {
    content: string;
    type: MessageType;
    sentAt: Date;
    senderId: string;
    mediaUrl?: string;
  };
  unreadCount: Map<string, number>;
  pinnedBy: string[];
  isArchived: Map<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>(
  {
    threadId: { type: String, required: true, unique: true, index: true },
    participants: { type: [String], required: true, index: true },
    threadType: { type: String, enum: ['direct', 'group'], default: 'direct' },
    threadName: { type: String, default: '' },
    threadAvatar: { type: String, default: '' },
    discussionTopic: { type: String, default: 'The first road trip across the coast, 1958' },
    isRecording: { type: Boolean, default: false },
    activeCall: {
      hostId: { type: String },
      startTime: { type: Date },
    },
    lastMessage: {
      content: { type: String, default: '' },
      type: { type: String, enum: Object.values(MessageType), default: MessageType.TEXT },
      sentAt: { type: Date, default: Date.now },
      senderId: { type: String, default: '' },
      mediaUrl: { type: String, default: '' },
    },
    unreadCount: { type: Map, of: Number, default: {} },
    pinnedBy: { type: [String], default: [] },
    isArchived: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true }
);

ThreadSchema.statics.generateThreadId = (participants: string[]): string => {
  return [...participants].sort().join('_');
};

export const Thread = mongoose.model<IThread, ThreadModel>('Thread', ThreadSchema);