import { Schema, model, Document } from 'mongoose';

export interface IInterview extends Document {
  interviewId: string;
  archivistId: string;
  archivistName: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  status: 'proposed' | 'confirmed' | 'live' | 'completed';
  questions: string[];
  chatThreadId?: string;
  recordingUrl?: string;
  createdAt: Date;
}

const interviewSchema = new Schema<IInterview>(
  {
    interviewId: { type: String, required: true, unique: true, index: true },
    archivistId: { type: String, required: true, index: true },
    archivistName: { type: String, required: true },
    subjectId: { type: String, required: true, index: true },
    subjectName: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['proposed', 'confirmed', 'live', 'completed'],
      default: 'proposed'
    },
    questions: { type: [String], default: [] },
    chatThreadId: { type: String },
    recordingUrl: { type: String }
  },
  {
    timestamps: true
  }
);

export const Interview = model<IInterview>('Interview', interviewSchema);
