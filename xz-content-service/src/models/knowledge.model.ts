import mongoose, { Schema, Document } from 'mongoose';
import { ContentCategory, Comment } from './content.types';

export interface IKnowledgeArticle extends Document {
  knowledgeId: string;
  authorId: string;
  authorRole: 'Elder' | 'Youth' | 'Admin';
  authorName: string;
  title: string;
  content: string;
  summary: string;
  category: ContentCategory;
  tags: string[];
  language: string;
  coverImage?: string;
  likes: string[];
  bookmarks: string[];
  views: number;
  comments: Comment[];
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeArticleSchema = new Schema<IKnowledgeArticle>(
  {
    knowledgeId: { type: String, required: true, unique: true, index: true },
    authorId: { type: String, required: true, index: true },
    authorRole: { type: String, enum: ['Elder', 'Youth', 'Admin'], required: true },
    authorName: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true },
    summary: { type: String, required: true, maxlength: 500 },
    category: { type: String, enum: Object.values(ContentCategory), required: true },
    tags: { type: [String], default: [] },
    language: { type: String, required: true, default: 'en' },
    coverImage: { type: String },
    likes: { type: [String], default: [] },
    bookmarks: { type: [String], default: [] },
    views: { type: Number, default: 0 },
    comments: [
      {
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        likes: { type: [String], default: [] },
      },
    ],
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

KnowledgeArticleSchema.index(
  { title: 'text', content: 'text', summary: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, summary: 3, content: 1 } }
);

export const KnowledgeArticle = mongoose.model<IKnowledgeArticle>('KnowledgeArticle', KnowledgeArticleSchema);