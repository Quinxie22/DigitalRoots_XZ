import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Community } from '../models/community.model';
import { Post } from '../models/post.model';
import { PostType, ContentCategory } from '../models/content.types';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export class CommunityController {
  // Create a new community
  static async createCommunity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, description, coverImage, interests, rules, isPublic } = req.body;
      const creatorId = req.user?.firebase_uid;

      if (!creatorId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!name || !description) {
        res.status(400).json({ success: false, error: 'Name and description are required' });
        return;
      }

      const existing = await Community.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (existing) {
        res.status(400).json({ success: false, error: 'A community with this name already exists' });
        return;
      }

      const communityId = uuidv4();
      const community = new Community({
        communityId,
        name,
        description,
        coverImage: coverImage || '',
        interests: interests || [],
        rules: rules || [],
        isPublic: isPublic !== undefined ? isPublic : true,
        creatorId,
        members: [creatorId],
        admins: [creatorId],
        memberCount: 1,
      });

      await community.save();
      logger.info(`Community created: ${name} (${communityId}) by user ${creatorId}`);

      res.status(201).json({ success: true, community });
    } catch (error: any) {
      logger.error('Error creating community:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get all communities or search
  static async getCommunities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const search = req.query.search as string;
      const interest = req.query.interest as string;

      const query: any = { isPublic: true };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      if (interest) {
        query.interests = interest;
      }

      const list = await Community.find(query).sort({ memberCount: -1 });
      res.status(200).json({ success: true, communities: list });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single community
  static async getCommunity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { communityId } = req.params;
      const community = await Community.findOne({ communityId });

      if (!community) {
        res.status(404).json({ success: false, error: 'Community not found' });
        return;
      }

      res.status(200).json({ success: true, community });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Join a community
  static async joinCommunity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { communityId } = req.params;
      const userId = req.user?.firebase_uid;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const community = await Community.findOne({ communityId });
      if (!community) {
        res.status(404).json({ success: false, error: 'Community not found' });
        return;
      }

      if (community.members.includes(userId)) {
        res.status(400).json({ success: false, error: 'You are already a member of this community' });
        return;
      }

      community.members.push(userId);
      community.memberCount = community.members.length;
      await community.save();

      res.status(200).json({ success: true, community });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Leave a community
  static async leaveCommunity(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { communityId } = req.params;
      const userId = req.user?.firebase_uid;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const community = await Community.findOne({ communityId });
      if (!community) {
        res.status(404).json({ success: false, error: 'Community not found' });
        return;
      }

      if (!community.members.includes(userId)) {
        res.status(400).json({ success: false, error: 'You are not a member of this community' });
        return;
      }

      if (community.creatorId === userId) {
        res.status(400).json({ success: false, error: 'Creator cannot leave the community. Transer ownership first.' });
        return;
      }

      community.members = community.members.filter(m => m !== userId);
      community.admins = community.admins.filter(a => a !== userId);
      community.memberCount = community.members.length;
      await community.save();

      res.status(200).json({ success: true, community });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get community posts
  static async getCommunityPosts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { communityId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const community = await Community.findOne({ communityId });
      if (!community) {
        res.status(404).json({ success: false, error: 'Community not found' });
        return;
      }

      // If private, verify membership
      if (!community.isPublic && req.user?.firebase_uid) {
        if (!community.members.includes(req.user.firebase_uid)) {
          res.status(403).json({ success: false, error: 'Access Denied: Private Community' });
          return;
        }
      }

      const query = { communityId, isPublished: true, isFlagged: false };
      const posts = await Post.find(query)
        .sort({ createdAt: -1 })
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

  // Create a post within a community
  static async createCommunityPost(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { communityId } = req.params;
      const { title, content, type, mediaUrl, fileMetadata } = req.body;
      const creatorId = req.user?.firebase_uid;
      const creatorName = req.user?.name || 'Someone';
      const creatorRole = req.user?.role || 'Youth';

      if (!creatorId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const community = await Community.findOne({ communityId });
      if (!community) {
        res.status(404).json({ success: false, error: 'Community not found' });
        return;
      }

      if (!community.members.includes(creatorId)) {
        res.status(403).json({ success: false, error: 'You must be a member of the community to post' });
        return;
      }

      if (!content) {
        res.status(400).json({ success: false, error: 'Post content cannot be empty' });
        return;
      }

      const postId = uuidv4();
      const newPost = new Post({
        postId,
        communityId,
        authorId: creatorId,
        authorName: creatorName,
        authorRole: creatorRole as any,
        type: type || PostType.TEXT,
        title: title || '',
        content,
        mediaUrl: mediaUrl || '',
        fileMetadata: fileMetadata || undefined,
        categories: community.interests as any[],
        tags: community.interests,
        comments: [],
        reactions: [
          { type: 'like', userIds: [] },
          { type: 'love', userIds: [] },
          { type: 'clap', userIds: [] },
          { type: 'insightful', userIds: [] },
          { type: 'thankful', userIds: [] }
        ],
        shares: 0,
        views: 0,
        isPublished: true,
      });

      await newPost.save();

      // Update post count in community
      community.postCount = await Post.countDocuments({ communityId, isPublished: true });
      await community.save();

      res.status(201).json({ success: true, post: newPost });
    } catch (error: any) {
      logger.error('Error creating community post:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get user's joined communities
  static async getMyCommunities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.firebase_uid;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const list = await Community.find({ members: userId }).sort({ updatedAt: -1 });
      res.status(200).json({ success: true, communities: list });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
