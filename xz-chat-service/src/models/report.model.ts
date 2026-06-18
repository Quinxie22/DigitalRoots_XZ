import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IReport extends Document {
  reportId: string;
  threadId: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reportId: { type: String, required: true, unique: true, default: () => uuidv4() },
    threadId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true, index: true },
    reportedUserId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export const Report = mongoose.model<IReport>('Report', ReportSchema);
