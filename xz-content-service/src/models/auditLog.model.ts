import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  logId: string;
  adminId: string;
  adminName: string;
  action: string; // e.g., 'approve_story', 'reject_story', 'hide_post', 'delete_post', 'ban_user'
  targetType: 'post' | 'story' | 'comment' | 'knowledge' | 'user';
  targetId: string;
  reason?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    logId: { type: String, required: true, unique: true, index: true },
    adminId: { type: String, required: true, index: true },
    adminName: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true, enum: ['post', 'story', 'comment', 'knowledge', 'user'] },
    targetId: { type: String, required: true, index: true },
    reason: { type: String },
  },
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
