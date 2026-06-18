import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Post } from '../models/post.model';
import { FileService, FileCategory } from '../services/file.service';
import { PostType, ContentCategory } from '../models/content.types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { clearCachePattern } from '../middleware/cache.middleware';

export class PostController {
  // Create a text post
  static async createTextPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, category, tags } = req.body;
      
      if (!content) {
        res.status(400).json({ success: false, error: 'Content is required' });
        return;
      }
      
      const post: any = await Post.create({
        postId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorRole: (req.user!.role as any) || 'Youth',
        authorName: req.user!.name || req.user!.email,
        type: PostType.TEXT,
        title: title || null,
        content,
        category: category || ContentCategory.EDUCATIONAL,
        tags: tags || [],
        isPublished: true,
      });
      
      logger.info(`Post created: ${post.postId} by ${req.user!.firebase_uid}`);
      await clearCachePattern('feed:*');
      res.status(201).json({ success: true, post });
    } catch (error: any) {
      logger.error('Create post error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Create a media post (image/video/audio)
  static async createMediaPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, category, tags } = req.body;
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ success: false, error: 'File is required' });
        return;
      }
      
      const fileCategory = FileService.getFileCategory(file.mimetype);
      if (!fileCategory) {
        res.status(400).json({ success: false, error: 'Unsupported file type' });
        return;
      }
      
      let postType: PostType;
      switch (fileCategory) {
        case FileCategory.IMAGE: postType = PostType.IMAGE; break;
        case FileCategory.VIDEO: postType = PostType.VIDEO; break;
        case FileCategory.AUDIO: postType = PostType.AUDIO; break;
        default: postType = PostType.TEXT;
      }
      
      const { url, thumbnailUrl, metadata } = await FileService.uploadFile(
        file.buffer,
        file.originalname,
        fileCategory,
        'posts'
      );
      
      const post: any = await Post.create({
        postId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorRole: (req.user!.role as any) || 'Youth',
        authorName: req.user!.name || req.user!.email,
        type: postType,
        title: title || null,
        content: content || `Shared a ${postType}`,
        mediaUrl: url,
        thumbnailUrl,
        fileMetadata: { ...metadata, fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype },
        category: category || ContentCategory.CULTURAL,
        tags: tags || [],
        isPublished: true,
      });
      
      await clearCachePattern('feed:*');
      res.status(201).json({ success: true, post });
    } catch (error: any) {
      logger.error('Create media post error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Get feed (paginated posts)
  static async getFeed(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const category = req.query.category as string;
      const sort = req.query.sort as string; // 'newest' or 'oldest'

      const query: any = { isPublished: true, isFlagged: false };
      if (category) query.category = category;
      
      const sortDir = sort === 'oldest' ? 1 : -1;
      
      const posts = await Post.find(query)
        .sort({ createdAt: sortDir })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Post.countDocuments(query);
      
      res.status(200).json({
        success: true,
        posts,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Get single post
  static async getPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      
      const post = await Post.findOne({ postId, isPublished: true });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }
      
      // Increment view count
      await Post.updateOne({ postId }, { $inc: { views: 1 } });
      
      res.status(200).json({ success: true, post });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Edit own post
  static async editPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { title, content, category, tags } = req.body;

      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      // Authorization: Author only
      if (post.authorId !== req.user!.firebase_uid) {
        res.status(403).json({ success: false, error: 'Unauthorized to edit this post' });
        return;
      }

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (content !== undefined) updates.content = content;
      if (category !== undefined) updates.category = category;
      if (tags !== undefined) updates.tags = tags;

      // Also support thumbnail update if client uploads/updates thumbnail
      if (req.file) {
        const fileCategory = FileService.getFileCategory(req.file.mimetype);
        if (fileCategory === FileCategory.IMAGE) {
          const { url } = await FileService.uploadFile(req.file.buffer, req.file.originalname, fileCategory, 'thumbnails');
          updates.thumbnailUrl = url;
        }
      }

      const updatedPost = await Post.findOneAndUpdate({ postId }, { $set: updates }, { new: true });
      
      await clearCachePattern('feed:*');
      res.status(200).json({ success: true, post: updatedPost });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete own post (soft delete) or force delete (admin)
  static async deletePost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userRole = req.user!.role;
      const userId = req.user!.firebase_uid;

      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      // Check if admin is force-deleting
      if (userRole === 'Admin') {
        await Post.deleteOne({ postId });
        logger.info(`Post permanently deleted by admin: ${postId}`);
        await clearCachePattern('feed:*');
        res.status(200).json({ success: true, message: 'Post permanently deleted by admin' });
        return;
      }

      // Author can soft-delete
      if (post.authorId !== userId) {
        res.status(403).json({ success: false, error: 'Unauthorized to delete this post' });
        return;
      }

      post.isPublished = false;
      await post.save();
      
      logger.info(`Post soft-deleted by author: ${postId}`);
      await clearCachePattern('feed:*');
      res.status(200).json({ success: true, message: 'Post removed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Add comment to post
  static async addComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { text } = req.body;
      
      if (!text) {
        res.status(400).json({ success: false, error: 'Comment text is required' });
        return;
      }
      
      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }
      
      post.comments.push({
        userId: req.user!.firebase_uid,
        userName: req.user!.name || req.user!.email,
        text,
        timestamp: new Date(),
        likes: [],
      });
      
      await post.save();
      
      res.status(201).json({ success: true, comment: post.comments[post.comments.length - 1] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete comment (Author deletes own, Admin deletes any)
  static async deleteComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId, commentId } = req.params; // Using standard commentId (or index in array)
      
      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      // Locate the comment
      // Since MongoDB _id is automatically generated in array elements, we check _id
      const commentIndex = post.comments.findIndex(c => (c as any)._id.toString() === commentId);
      if (commentIndex === -1) {
        res.status(404).json({ success: false, error: 'Comment not found' });
        return;
      }

      const comment = post.comments[commentIndex];
      const isAdmin = req.user!.role === 'Admin';
      const isAuthor = comment.userId === req.user!.firebase_uid;

      if (!isAdmin && !isAuthor) {
        res.status(403).json({ success: false, error: 'Unauthorized to delete this comment' });
        return;
      }

      post.comments.splice(commentIndex, 1);
      await post.save();

      res.status(200).json({ success: true, message: 'Comment deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Like a comment (Toggle like)
  static async likeComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user!.firebase_uid;

      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      const comment = post.comments.find(c => (c as any)._id.toString() === commentId);
      if (!comment) {
        res.status(404).json({ success: false, error: 'Comment not found' });
        return;
      }

      const likedIndex = comment.likes.indexOf(userId);
      if (likedIndex > -1) {
        comment.likes.splice(likedIndex, 1); // Unlike
      } else {
        comment.likes.push(userId); // Like
      }

      await post.save();
      res.status(200).json({ success: true, comment });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Add reaction to post
  static async addReaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { type } = req.body;
      const userId = req.user!.firebase_uid;
      
      const validTypes = ['like', 'love', 'clap', 'insightful', 'thankful'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, error: 'Invalid reaction type' });
        return;
      }
      
      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      // Remove userId from any existing reaction type to prevent duplicate reactions on same post
      post.reactions.forEach(r => {
        const index = r.userIds.indexOf(userId);
        if (index > -1) r.userIds.splice(index, 1);
      });
      
      let reaction = post.reactions.find(r => r.type === type);
      if (!reaction) {
        reaction = { type: type as any, userIds: [] };
        post.reactions.push(reaction);
      }
      
      reaction.userIds.push(userId);
      await post.save();
      
      res.status(200).json({ success: true, reactions: post.reactions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Remove reaction from post
  static async removeReaction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = req.user!.firebase_uid;

      const post = await Post.findOne({ postId });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      post.reactions.forEach(r => {
        const index = r.userIds.indexOf(userId);
        if (index > -1) r.userIds.splice(index, 1);
      });

      // Filter out reactions that have empty userIds
      post.reactions = post.reactions.filter(r => r.userIds.length > 0);
      
      await post.save();
      res.status(200).json({ success: true, reactions: post.reactions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Share post (Track share count)
  static async sharePost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const post = await Post.findOneAndUpdate(
        { postId },
        { $inc: { shares: 1 } },
        { new: true }
      );

      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      res.status(200).json({ success: true, shares: post.shares });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Flag inappropriate content
  static async flagPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      const post = await Post.findOneAndUpdate(
        { postId },
        { $set: { isFlagged: true } },
        { new: true }
      );

      if (!post) {
        res.status(404).json({ success: false, error: 'Post not found' });
        return;
      }

      logger.info(`Post flagged: ${postId} by ${req.user!.firebase_uid}`);
      await clearCachePattern('feed:*');
      res.status(200).json({ success: true, message: 'Content successfully flagged' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}