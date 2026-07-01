import mongoose, { Schema, Document } from 'mongoose';
import { CulturalCategory, ContentCategory, PerspectiveTag } from './content.types';

export interface IStory extends Document {
  storyId: string;
  authorId: string;
  authorName: string;
  authorRole: 'Elder' | 'Youth' | 'Admin';
  perspectiveTag: PerspectiveTag;
  elderId?: string;
  elderName?: string;
  title: string;
  description?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  mediaType?: 'audio' | 'video' | 'image' | 'document' | 'text';
  mediaUrl?: string;
  transcript: string;
  transcriptStatus: 'pending' | 'processing' | 'completed' | 'failed';
  language: string;
  translations?: Map<string, string>;
  culturalCategory: CulturalCategory;
  tags: string[];
  isPublished: boolean;
  approvedBy?: string;
  rejectionReason?: string;
  viewCount: number;
  likes: string[];
  createdAt: Date;
  publishedAt?: Date;
}

const StorySchema = new Schema<IStory>(
  {
    storyId: { type: String, required: true, unique: true, index: true },
    authorId: { type: String, required: true, index: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['Elder', 'Youth', 'Admin'], required: true, default: 'Elder' },
    perspectiveTag: { type: String, enum: ['elder_wisdom', 'youth_voice', 'interview_archive', 'joint'], required: true, default: 'elder_wisdom' },
    elderId: { type: String, index: true },
    elderName: { type: String },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 500 },
    audioUrl: { type: String, default: '' },
    thumbnailUrl: { type: String },
    duration: { type: Number, default: 0 },
    mediaType: { type: String, enum: ['audio', 'video', 'image', 'document', 'text'], default: 'audio' },
    mediaUrl: { type: String, default: '' },
    transcript: { type: String, default: '' },
    transcriptStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    language: { type: String, required: true, default: 'en' },
    translations: {
      type: Map,
      of: String,
      default: {},
    },
    culturalCategory: { type: String, enum: Object.values(CulturalCategory), required: true },
    tags: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    approvedBy: { type: String },
    rejectionReason: { type: String },
    viewCount: { type: Number, default: 0 },
    likes: { type: [String], default: [] },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

StorySchema.index({ title: 'text', transcript: 'text', tags: 'text' });
StorySchema.index({ culturalCategory: 1, isPublished: 1, createdAt: -1 });
StorySchema.index({ perspectiveTag: 1, isPublished: 1, createdAt: -1 });

export const Story = mongoose.model<IStory>('Story', StorySchema);