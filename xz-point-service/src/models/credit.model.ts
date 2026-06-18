import { Schema, model, Document } from 'mongoose';

export interface ICreditTransaction extends Document {
  userId: string;
  action: 'story_published' | 'interview_completed' | 'post_bookmarked' | 'post_shared' | 'mentoring_session' | 'first_interview_bonus';
  credits: number;
  referenceId?: string;
  referenceType?: 'story' | 'post' | 'interview' | 'mentoring';
  createdAt: Date;
}

const creditTransactionSchema = new Schema<ICreditTransaction>(
  {
    userId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: [
        'story_published',
        'interview_completed',
        'post_bookmarked',
        'post_shared',
        'mentoring_session',
        'first_interview_bonus'
      ],
      required: true
    },
    credits: { type: Number, required: true },
    referenceId: { type: String },
    referenceType: { type: String, enum: ['story', 'post', 'interview', 'mentoring'] }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const CreditTransaction = model<ICreditTransaction>('CreditTransaction', creditTransactionSchema);
