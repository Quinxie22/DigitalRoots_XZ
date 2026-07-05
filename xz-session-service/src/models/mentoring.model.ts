import { Schema, model, Document } from 'mongoose';

export interface IMentoringPair extends Document {
  pairingId: string;
  mentorId: string;
  mentorName: string;
  menteeId: string;
  menteeName: string;
  pairingType: 'cultural' | 'digital';
  skillFocus: string;
  status: 'requested' | 'active' | 'completed';
  sessionCount: number;
  requestedById: string;
  createdAt: Date;
}

const mentoringPairSchema = new Schema<IMentoringPair>(
  {
    pairingId: { type: String, required: true, unique: true, index: true },
    mentorId: { type: String, required: true, index: true },
    mentorName: { type: String, required: true },
    menteeId: { type: String, required: true, index: true },
    menteeName: { type: String, required: true },
    pairingType: { type: String, enum: ['cultural', 'digital'], required: true },
    skillFocus: { type: String, required: true },
    status: {
      type: String,
      enum: ['requested', 'active', 'completed'],
      default: 'requested'
    },
    sessionCount: { type: Number, default: 0 },
    requestedById: { type: String, required: true }
  },
  {
    timestamps: true
  }
);

export const MentoringPair = model<IMentoringPair>('MentoringPair', mentoringPairSchema);
