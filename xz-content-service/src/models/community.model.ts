import mongoose, { Schema, Document } from 'mongoose';

export interface ICommunity extends Document {
  communityId: string;
  name: string;
  description: string;
  coverImage?: string;
  interests: string[];
  creatorId: string;
  members: string[];
  admins: string[];
  rules: string[];
  isPublic: boolean;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CommunitySchema = new Schema<ICommunity>(
  {
    communityId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    coverImage: { type: String, default: '' },
    interests: { type: [String], default: [], index: true },
    creatorId: { type: String, required: true, index: true },
    members: { type: [String], default: [], index: true },
    admins: { type: [String], default: [] },
    rules: { type: [String], default: [] },
    isPublic: { type: Boolean, default: true },
    memberCount: { type: Number, default: 1 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CommunitySchema.index({ name: 'text', description: 'text' });

export const Community = mongoose.model<ICommunity>('Community', CommunitySchema);
