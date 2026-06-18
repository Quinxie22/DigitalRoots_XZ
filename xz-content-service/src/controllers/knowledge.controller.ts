import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { KnowledgeArticle } from '../models/knowledge.model';
import { ContentCategory } from '../models/content.types';
import { FileService, FileCategory } from '../services/file.service';
import { AuditLog } from '../models/auditLog.model';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { clearCachePattern } from '../middleware/cache.middleware';

export class KnowledgeController {
  // Create knowledge article
  static async createArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, summary, category, tags, language } = req.body;
      
      if (!title || !content || !summary) {
        res.status(400).json({ success: false, error: 'Title, content, and summary are required' });
        return;
      }

      let coverImage: string | undefined;
      if (req.file) {
        const fileCategory = FileService.getFileCategory(req.file.mimetype);
        if (fileCategory === FileCategory.IMAGE) {
          const { url } = await FileService.uploadFile(req.file.buffer, req.file.originalname, fileCategory, 'knowledge');
          coverImage = url;
        }
      }
      
      const article: any = await KnowledgeArticle.create({
        knowledgeId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorRole: (req.user!.role as any) || 'Youth',
        authorName: req.user!.name || req.user!.email,
        title,
        content,
        summary,
        category: category || ContentCategory.EDUCATIONAL,
        tags: tags || [],
        language: language || 'en',
        coverImage,
        likes: [],
        bookmarks: [],
        views: 0,
        isPublished: false,
        isFeatured: false,
      });
      
      logger.info(`Knowledge article created: ${article.knowledgeId}`);
      await clearCachePattern('knowledge:*');
      res.status(201).json({ success: true, article });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Edit own article (Author only)
  static async editArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const { title, content, summary, category, tags, language } = req.body;

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      if (article.authorId !== req.user!.firebase_uid) {
        res.status(403).json({ success: false, error: 'Unauthorized to edit this article' });
        return;
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (summary !== undefined) updates.summary = summary;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags;
      if (language !== undefined) updates.language = language;

      if (req.file) {
        const fileCategory = FileService.getFileCategory(req.file.mimetype);
        if (fileCategory === FileCategory.IMAGE) {
          const { url } = await FileService.uploadFile(req.file.buffer, req.file.originalname, fileCategory, 'knowledge');
          updates.coverImage = url;
        }
      }

      const updatedArticle = await KnowledgeArticle.findOneAndUpdate(
        { knowledgeId },
        { $set: updates },
        { new: true }
      );

      await clearCachePattern('knowledge:*');
      res.status(200).json({ success: true, article: updatedArticle });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete own article (Author only)
  static async deleteArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      if (article.authorId !== req.user!.firebase_uid) {
        res.status(403).json({ success: false, error: 'Unauthorized to delete this article' });
        return;
      }

      await KnowledgeArticle.deleteOne({ knowledgeId });
      
      logger.info(`Article deleted: ${knowledgeId} by author`);
      await clearCachePattern('knowledge:*');
      res.status(200).json({ success: true, message: 'Article deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Search knowledge articles with relevance ranking
  static async searchArticles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { q, category, language, page = 1, limit = 20 } = req.query;
      
      if (!q) {
        res.status(400).json({ success: false, error: 'Search query is required' });
        return;
      }
      
      const query: any = {
        isPublished: true,
        $text: { $search: q as string },
      };
      
      if (category) query.category = category;
      if (language) query.language = language;
      
      const articles = await KnowledgeArticle.find(query)
        .sort({ score: { $meta: 'textScore' } })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));
      
      const total = await KnowledgeArticle.countDocuments(query);
      
      res.status(200).json({
        success: true,
        articles,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Get article by ID
  static async getArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      
      const article = await KnowledgeArticle.findOne({ knowledgeId, isPublished: true });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }
      
      // Increment views
      await KnowledgeArticle.updateOne({ knowledgeId }, { $inc: { views: 1 } });
      
      res.status(200).json({ success: true, article });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Like/Unlike article (Toggle)
  static async likeArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const userId = req.user!.firebase_uid;
      
      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      const likedIndex = article.likes.indexOf(userId);
      if (likedIndex > -1) {
        article.likes.splice(likedIndex, 1); // Unlike
      } else {
        article.likes.push(userId); // Like
      }
      
      await article.save();
      await clearCachePattern(`knowledge:*`);
      res.status(200).json({ success: true, likes: article.likes.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Unlike article explicitly (supporting toggle helper or direct)
  static async unlikeArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const userId = req.user!.firebase_uid;

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      const index = article.likes.indexOf(userId);
      if (index > -1) {
        article.likes.splice(index, 1);
        await article.save();
        await clearCachePattern(`knowledge:*`);
      }

      res.status(200).json({ success: true, likes: article.likes.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Bookmark article
  static async bookmarkArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const userId = req.user!.firebase_uid;
      
      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }
      
      if (!article.bookmarks.includes(userId)) {
        article.bookmarks.push(userId);
        await article.save();
      }
      
      res.status(200).json({ success: true, bookmarks: article.bookmarks.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Remove bookmark from article
  static async unbookmarkArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const userId = req.user!.firebase_uid;

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      const index = article.bookmarks.indexOf(userId);
      if (index > -1) {
        article.bookmarks.splice(index, 1);
        await article.save();
      }

      res.status(200).json({ success: true, bookmarks: article.bookmarks.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get user's saved/bookmarked articles
  static async getBookmarks(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.firebase_uid;

      const articles = await KnowledgeArticle.find({
        bookmarks: userId,
        isPublished: true,
      }).sort({ createdAt: -1 });

      res.status(200).json({ success: true, articles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Publish/unpublish article (Admin only)
  static async publishArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const { isPublished } = req.body;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      if (isPublished === undefined) {
        res.status(400).json({ success: false, error: 'isPublished value is required' });
        return;
      }

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      article.isPublished = !!isPublished;
      await article.save();

      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: isPublished ? 'publish_article' : 'unpublish_article',
        targetType: 'knowledge',
        targetId: knowledgeId as string,
      });

      await clearCachePattern('knowledge:*');
      res.status(200).json({ success: true, article });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Feature/unfeature article on homepage (Admin only)
  static async featureArticle(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { knowledgeId } = req.params;
      const { isFeatured } = req.body;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      if (isFeatured === undefined) {
        res.status(400).json({ success: false, error: 'isFeatured value is required' });
        return;
      }

      const article = await KnowledgeArticle.findOne({ knowledgeId });
      if (!article) {
        res.status(404).json({ success: false, error: 'Article not found' });
        return;
      }

      article.isFeatured = !!isFeatured;
      await article.save();

      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: isFeatured ? 'feature_article' : 'unfeature_article',
        targetType: 'knowledge',
        targetId: knowledgeId as string,
      });

      await clearCachePattern('knowledge:*');
      res.status(200).json({ success: true, article });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get all articles (with options for isPublished and authorId)
  static async getArticles(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string;
      const authorId = req.query.authorId as string;
      
      const query: any = {};
      
      // Determine isPublished filter based on query and role
      let isPublishedFilter: any = true;
      if (req.query.isPublished !== undefined) {
        isPublishedFilter = req.query.isPublished === 'true';
      }
      
      if (req.query.isPublished !== undefined) {
        if (isPublishedFilter === false) {
          const isAdmin = req.user?.role === 'Admin';
          const isSelf = authorId && authorId === req.user?.firebase_uid;
          if (isAdmin || isSelf) {
            query.isPublished = false;
          } else {
            query.isPublished = true;
          }
        } else {
          query.isPublished = true;
        }
      } else {
        const isAdmin = req.user?.role === 'Admin';
        const isSelf = authorId && authorId === req.user?.firebase_uid;
        if (!isAdmin && !isSelf) {
          query.isPublished = true;
        }
      }
      
      if (category) query.category = category;
      if (authorId) query.authorId = authorId;
      
      const articles = await KnowledgeArticle.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await KnowledgeArticle.countDocuments(query);
      
      res.status(200).json({
        success: true,
        articles,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}