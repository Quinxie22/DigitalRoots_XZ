import mongoose, { Schema, Document } from 'mongoose';
import { MessageType, FileMetadata } from './message.types';

export interface IMessage extends Document {
  threadId: string;
  messageId: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileMetadata?: FileMetadata;
  mediaUrl?: string;
  transcriptStatus?: 'pending' | 'completed' | 'failed';
  transcript?: string;
  duration?: number;
  replyTo?: string; // Message ID being replied to
  mentions?: string[]; // User IDs mentioned
  reactions: Map<string, string[]>; // emoji -> user IDs
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
  readBy: string[];
  deliveredTo: string[];
  isDeleted: boolean;
}

const MessageSchema = new Schema<IMessage>(
  {
    threadId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, unique: true },
    senderId: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(MessageType), required: true },
    content: { type: String, required: true },
    fileMetadata: {
      url: { type: String },
      thumbnailUrl: { type: String },
      fileName: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      width: { type: Number },
      height: { type: Number },
      duration: { type: Number },
      pages: { type: Number },
    },
    mediaUrl: { type: String },
    transcriptStatus: { type: String, enum: ['pending', 'completed', 'failed'] },
    transcript: { type: String },
    duration: { type: Number },
    replyTo: { type: String, ref: 'Message' },
    mentions: { type: [String], default: [] },
    reactions: { type: Map, of: [String], default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
    editedAt: { type: Date },
    deletedAt: { type: Date },
    readBy: { type: [String], default: [] },
    deliveredTo: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Compound index for efficient queries
MessageSchema.index({ threadId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1, timestamp: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);