import mongoose, { Schema, Document } from 'mongoose';
import { PostType, ContentCategory, Comment, Reaction, FileMetadata } from './content.types';

export interface IPost extends Document {
  postId: string;
  authorId: string;
  authorRole: 'Elder' | 'Youth' | 'Admin';
  authorName: string;
  type: PostType;
  title?: string;
  content: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  fileMetadata?: FileMetadata;
  category: ContentCategory;
  tags: string[];
  comments: Comment[];
  reactions: Reaction[];
  shares: number;
  views: number;
  isPublished: boolean;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    postId: { type: String, required: true, unique: true, index: true },
    authorId: { type: String, required: true, index: true },
    authorRole: { type: String, enum: ['Elder', 'Youth', 'Admin'], required: true },
    authorName: { type: String, required: true },
    type: { type: String, enum: Object.values(PostType), required: true },
    title: { type: String, maxlength: 200 },
    content: { type: String, required: true },
    mediaUrl: { type: String },
    thumbnailUrl: { type: String },
    fileMetadata: {
      url: String,
      thumbnailUrl: String,
      fileName: String,
      fileSize: Number,
      mimeType: String,
      width: Number,
      height: Number,
      duration: Number,
    },
    category: { type: String, enum: Object.values(ContentCategory), required: true },
    tags: { type: [String], default: [] },
    comments: [
      {
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        likes: { type: [String], default: [] },
      },
    ],
    reactions: [
      {
        type: { type: String, enum: ['like', 'love', 'clap', 'insightful', 'thankful'] },
        userIds: { type: [String], default: [] },
      },
    ],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    isFlagged: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PostSchema.index({ content: 'text', title: 'text', tags: 'text' });

export const Post = mongoose.model<IPost>('Post', PostSchema);