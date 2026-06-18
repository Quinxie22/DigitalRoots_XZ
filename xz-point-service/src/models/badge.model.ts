import { Schema, model, Document } from 'mongoose';

export interface IBadge extends Document {
  userId: string;
  badgeType: 'First Voice' | 'Story Keeper' | 'Archivist' | 'Wisdom Keeper' | 'Digital Bridge';
  awardedAt: Date;
}

const badgeSchema = new Schema<IBadge>(
  {
    userId: { type: String, required: true, index: true },
    badgeType: {
      type: String,
      enum: ['First Voice', 'Story Keeper', 'Archivist', 'Wisdom Keeper', 'Digital Bridge'],
      required: true
    }
  },
  {
    timestamps: { createdAt: 'awardedAt', updatedAt: false }
  }
);

export const Badge = model<IBadge>('Badge', badgeSchema);
