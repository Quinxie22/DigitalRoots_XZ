import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Post } from '../models/post.model';
import { Story } from '../models/story.model';
import { KnowledgeArticle } from '../models/knowledge.model';
import { AuditLog } from '../models/auditLog.model';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { clearCachePattern } from '../middleware/cache.middleware';

export class ModerationController {
  // Get flagged posts (Admin only)
  static async getFlaggedPosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const flaggedPosts = await Post.find({ isFlagged: true })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Post.countDocuments({ isFlagged: true });

      res.status(200).json({
        success: true,
        posts: flaggedPosts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Temporarily hide post (Admin only)
  static async hidePost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { isPublished } = req.body; // Set isPublished = false to hide
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      const post = await Post.findOneAndUpdate(
        { postId },
        { $set: { isPublished: !!isPublished } },
        { new: true }
      );

      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: isPublished ? 'unhide_post' : 'hide_post',
        targetType: 'post',
        targetId: postId as string,
      });

      await clearCachePattern('feed:*');
      res.status(200).json({ success: true, post });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Content Analytics dashboard (Admin only)
  static async getContentAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const totalPosts = await Post.countDocuments();
      const totalStories = await Story.countDocuments();
      const totalArticles = await KnowledgeArticle.countDocuments();

      const postViewsResult = await Post.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]);
      const storyViewsResult = await Story.aggregate([{ $group: { _id: null, total: { $sum: '$viewCount' } } }]);
      const articleViewsResult = await KnowledgeArticle.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]);

      const totalPostViews = postViewsResult[0]?.total || 0;
      const totalStoryViews = storyViewsResult[0]?.total || 0;
      const totalArticleViews = articleViewsResult[0]?.total || 0;

      const commentResult = await Post.aggregate([{ $group: { _id: null, total: { $sum: { $size: '$comments' } } } }]);
      const shareResult = await Post.aggregate([{ $group: { _id: null, total: { $sum: '$shares' } } }]);

      const totalComments = commentResult[0]?.total || 0;
      const totalShares = shareResult[0]?.total || 0;

      res.status(200).json({
        success: true,
        metrics: {
          contentCounts: {
            posts: totalPosts,
            stories: totalStories,
            articles: totalArticles,
            total: totalPosts + totalStories + totalArticles
          },
          engagement: {
            views: totalPostViews + totalStoryViews + totalArticleViews,
            comments: totalComments,
            shares: totalShares,
            postViews: totalPostViews,
            storyViews: totalStoryViews,
            articleViews: totalArticleViews
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get Admin action Audit log (Admin only)
  static async getAuditLog(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const logs = await AuditLog.find()
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await AuditLog.countDocuments();

      res.status(200).json({
        success: true,
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Ban user & remove/hide their content (Admin only)
  static async banUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userIdToBan, reason } = req.body;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      if (!userIdToBan) {
        res.status(400).json({ success: false, error: 'User ID to ban is required' });
        return;
      }

      const postsRes = await Post.updateMany({ authorId: userIdToBan }, { $set: { isPublished: false } });
      const storiesRes = await Story.updateMany({ elderId: userIdToBan }, { $set: { isPublished: false } });
      const articlesRes = await KnowledgeArticle.updateMany({ authorId: userIdToBan }, { $set: { isPublished: false } });

      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: 'ban_user',
        targetType: 'user',
        targetId: userIdToBan,
        reason: reason || 'Banned by admin',
      });

      logger.info(`User ${userIdToBan} banned by admin ${adminId}`);
      
      await clearCachePattern('feed:*');
      await clearCachePattern('stories:*');
      await clearCachePattern('knowledge:*');

      res.status(200).json({
        success: true,
        message: 'User banned successfully. All content hidden.',
        details: {
          hiddenPosts: postsRes.modifiedCount,
          hiddenStories: storiesRes.modifiedCount,
          hiddenArticles: articlesRes.modifiedCount
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
