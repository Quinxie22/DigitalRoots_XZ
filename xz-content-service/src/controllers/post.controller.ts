import { Response } from 'express';
import mongoose from 'mongoose';
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
      const { title, content, category, categories, tags } = req.body;
      
      if (!content) {
        res.status(400).json({ success: false, error: 'Content is required' });
        return;
      }

      let parsedCategories = categories;
      if (typeof categories === 'string') {
        try {
          parsedCategories = JSON.parse(categories);
        } catch (e) {
          parsedCategories = [categories];
        }
      }
      
      const post: any = await Post.create({
        postId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorRole: (req.user!.role as any) || 'Youth',
        authorName: req.user!.name || req.user!.email,
        type: PostType.TEXT,
        title: title || null,
        content,
        category: category || (parsedCategories && parsedCategories[0]) || ContentCategory.EDUCATIONAL,
        categories: parsedCategories || (category ? [category] : [ContentCategory.EDUCATIONAL]),
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
  
  // Create a media post (image/video/audio) — supports multiple files
  static async createMediaPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, content, category, categories, tags } = req.body;
      const files = (req.files as Express.Multer.File[]) || [];

      if (files.length === 0) {
        res.status(400).json({ success: false, error: 'At least one file is required' });
        return;
      }

      // Validate and determine type from first file
      const firstCategory = FileService.getFileCategory(files[0].mimetype);
      if (!firstCategory) {
        res.status(400).json({ success: false, error: 'Unsupported file type' });
        return;
      }

      let postType: PostType;
      switch (firstCategory) {
        case FileCategory.IMAGE: postType = PostType.IMAGE; break;
        case FileCategory.VIDEO: postType = PostType.VIDEO; break;
        case FileCategory.AUDIO: postType = PostType.AUDIO; break;
        default: postType = PostType.TEXT;
      }

      // Upload all files in parallel
      const uploadResults = await Promise.all(
        files.map(file => {
          const fileCategory = FileService.getFileCategory(file.mimetype) || firstCategory;
          return FileService.uploadFile(file.buffer, file.originalname, fileCategory, 'posts');
        })
      );

      const mediaUrls = uploadResults.map(r => r.url);
      const { url: mediaUrl, thumbnailUrl, metadata } = uploadResults[0];

      let parsedCategories = categories;
      if (typeof categories === 'string') {
        try { parsedCategories = JSON.parse(categories); } catch { parsedCategories = [categories]; }
      }

      const post: any = await Post.create({
        postId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorRole: (req.user!.role as any) || 'Youth',
        authorName: req.user!.name || req.user!.email,
        type: postType,
        title: title || null,
        content: content || `Shared ${files.length > 1 ? `${files.length} files` : `a ${postType}`}`,
        mediaUrl,
        mediaUrls,
        thumbnailUrl,
        fileMetadata: { ...metadata, fileName: files[0].originalname, fileSize: files[0].size, mimeType: files[0].mimetype },
        category: category || (parsedCategories && parsedCategories[0]) || ContentCategory.CULTURAL,
        categories: parsedCategories || (category ? [category] : [ContentCategory.CULTURAL]),
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
      if (category) {
        query.$or = [
          { category: category },
          { categories: category }
        ];
      }
      
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
      if (req.query.incrementView !== 'false') {
        await Post.updateOne({ postId }, { $inc: { views: 1 } });
        post.views += 1;
      }
      
      res.status(200).json({ success: true, post });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Edit own post
  static async editPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { title, content, category, categories, tags } = req.body;

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
      if (categories !== undefined) {
        let parsedCategories = categories;
        if (typeof categories === 'string') {
          try {
            parsedCategories = JSON.parse(categories);
          } catch (e) {
            parsedCategories = [categories];
          }
        }
        updates.categories = parsedCategories;
      }
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
      await clearCachePattern('feed:*');
      
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
      await clearCachePattern('feed:*');
      
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
      await clearCachePattern('feed:*');
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

      // Convert reactions to a plain array first to bypass deep nested Mongoose mutation issues
      const reactions = post.reactions.map(r => ({
        type: r.type,
        userIds: [...r.userIds]
      }));

      // Remove userId from any existing reaction type to prevent duplicate reactions on same post
      reactions.forEach(r => {
        const index = r.userIds.indexOf(userId);
        if (index > -1) r.userIds.splice(index, 1);
      });
      
      let reaction = reactions.find(r => r.type === type);
      if (!reaction) {
        reaction = { type: type as any, userIds: [] };
        reactions.push(reaction);
      }
      
      reaction.userIds.push(userId);
      post.reactions = reactions as any;
      await post.save();
      await clearCachePattern('feed:*');
      
      // Trigger notification if reactor is not the post author
      if (post.authorId !== userId) {
        try {
          const axios = require('axios');
          const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
          await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
            userId: post.authorId,
            title: 'New Reaction on Post',
            message: `${req.user!.name || req.user!.email} reacted with "${type}" on your post`,
            type: 'post_reaction',
            referenceId: postId,
          });
        } catch (err: any) {
          logger.error(`Failed to send post reaction notification for post ${postId}: ${err.message}`);
        }
      }
      
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
      await clearCachePattern('feed:*');
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

      // Auto-suspension/banning logic
      const flaggedCount = await Post.countDocuments({ authorId: post.authorId, isFlagged: true });
      if (flaggedCount >= 3) {
        const newStatus = flaggedCount >= 5 ? 'Banned' : 'Suspended';
        const usersDb = mongoose.connection.useDb('xz_users');
        let UserModel;
        try {
          UserModel = usersDb.model('User');
        } catch {
          UserModel = usersDb.model('User', new mongoose.Schema({
            status: { type: String }
          }, { collection: 'users' }));
        }

        // Try checking both _id and firebaseUid for the author
        const updateResult = await UserModel.updateOne(
          {
            $or: [
              { firebaseUid: post.authorId },
              ...(mongoose.Types.ObjectId.isValid(post.authorId) ? [{ _id: new mongoose.Types.ObjectId(post.authorId) }] : [])
            ]
          },
          { $set: { status: newStatus } }
        );
        logger.warn(`User ${post.authorId} automatically ${newStatus} due to having ${flaggedCount} flagged posts. Update result: ${JSON.stringify(updateResult)}`);
      }

      await clearCachePattern('feed:*');
      res.status(200).json({ success: true, message: 'Content successfully flagged' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}