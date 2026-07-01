import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Story } from '../models/story.model';
import { FileService, FileCategory } from '../services/file.service';
import { TranscriptionService } from '../services/transcription.service';
import { CulturalCategory } from '../models/content.types';
import { AuditLog } from '../models/auditLog.model';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { clearCachePattern } from '../middleware/cache.middleware';
import axios from 'axios';

export class StoryController {
  // Upload a story (audio, video, image, or document)
  static async uploadStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, description, language, culturalCategory, tags, duration } = req.body;
      const audioFile = req.file;
      
      if (!audioFile) {
        res.status(400).json({ success: false, error: 'File is required' });
        return;
      }
      
      if (!title || !culturalCategory) {
        res.status(400).json({ success: false, error: 'Title and cultural category are required' });
        return;
      }
      
      // Determine file category
      const category = FileService.getFileCategory(audioFile.mimetype) || FileCategory.AUDIO;
      
      // Upload file to storage / Cloudinary
      const uploadResult = await FileService.uploadFile(audioFile.buffer, audioFile.originalname, category);
      const mediaUrl = uploadResult.url;
      const audioUrl = category === FileCategory.AUDIO ? mediaUrl : '';
      
      let mediaType: 'audio' | 'video' | 'image' | 'document' = 'audio';
      if (category === FileCategory.IMAGE) mediaType = 'image';
      else if (category === FileCategory.VIDEO) mediaType = 'video';
      else if (category === FileCategory.AUDIO) mediaType = 'audio';
      else mediaType = 'document';

      // Capture audio duration from frontend, or default to 0
      const parsedDuration = parseInt(duration as string) || 0;
      
      const authorRole = (req.user!.role as 'Elder' | 'Youth' | 'Admin') || 'Elder';
      const defaultPerspective = authorRole === 'Youth' ? 'youth_voice' : 'elder_wisdom';
      const perspectiveTag = req.body.perspectiveTag || defaultPerspective;

      const story = await Story.create({
        storyId: uuidv4(),
        authorId: req.user!.firebase_uid,
        authorName: req.user!.name || req.user!.email,
        authorRole,
        perspectiveTag,
        elderId: req.user!.firebase_uid,
        elderName: req.user!.name || req.user!.email,
        title,
        description: description || '',
        audioUrl,
        thumbnailUrl: uploadResult.thumbnailUrl || '',
        duration: parsedDuration,
        mediaType,
        mediaUrl,
        transcript: '',
        transcriptStatus: category === FileCategory.AUDIO ? 'pending' : 'completed',
        language: language || 'en',
        culturalCategory: culturalCategory as CulturalCategory,
        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : [],
        isPublished: false, // Requires admin approval
      });
      
      // Queue transcription asynchronously ONLY for audio content
      if (category === FileCategory.AUDIO) {
        try {
          await TranscriptionService.queueTranscription(story.storyId, audioUrl);
        } catch (transcribeError: any) {
          logger.error(`Failed to queue transcription for story ${story.storyId}:`, transcribeError);
        }
      }
      
      logger.info(`Story uploaded: ${story.storyId} by ${req.user!.firebase_uid}`);
      const message = category === FileCategory.AUDIO 
        ? 'Story uploaded. Transcription in progress.' 
        : 'Story uploaded successfully.';
      res.status(202).json({
        success: true,
        storyId: story.storyId,
        message,
        story,
      });
    } catch (error: any) {
      logger.error('Upload story error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get stories with optional filters
  static async getStories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const culturalCategory = req.query.category as string;
      const perspectiveTag = req.query.perspective as string;
      const tag = (req.query.tag || req.query.label) as string;
      const tags = (req.query.tags || req.query.labels) as string;
      const authorId = req.query.authorId as string;
      
      const query: any = {};
      if (culturalCategory) query.culturalCategory = culturalCategory;
      if (perspectiveTag) query.perspectiveTag = perspectiveTag;
      if (authorId) query.authorId = authorId;
      
      if (tag) {
        query.tags = tag;
      } else if (tags) {
        const tagsArr = tags.split(',').map(t => t.trim());
        query.tags = { $in: tagsArr };
      }
      
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
      
      const stories = await Story.find(query)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      const total = await Story.countDocuments(query);
      
      res.status(200).json({
        success: true,
        stories,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Get single story
  static async getStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      
      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }
      
      // Increment view count
      if (req.query.incrementView !== 'false') {
        await Story.updateOne({ storyId }, { $inc: { viewCount: 1 } });
      }
      
      res.status(200).json({ success: true, story });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Get transcription status
  static async getTranscriptionStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      
      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }
      
      res.status(200).json({
        success: true,
        status: story.transcriptStatus,
        transcript: story.transcript,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // Like a story
  static async likeStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const userId = req.user!.firebase_uid;
      
      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }
      
      if (!story.likes.includes(userId)) {
        story.likes.push(userId);
        await story.save();
      }
      
      res.status(200).json({ success: true, likes: story.likes.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Unlike a story
  static async unlikeStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const userId = req.user!.firebase_uid;

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      const index = story.likes.indexOf(userId);
      if (index > -1) {
        story.likes.splice(index, 1);
        await story.save();
      }

      res.status(200).json({ success: true, likes: story.likes.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Download Transcript as text file
  static async downloadTranscript(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      if (!story.transcript) {
        res.status(400).json({ success: false, error: 'Transcript is not available yet' });
        return;
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="transcript-${storyId}.txt"`);
      res.send(story.transcript);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Approve a story (Admin only)
  static async approveStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      story.isPublished = true;
      story.approvedBy = adminId;
      story.publishedAt = new Date();
      story.rejectionReason = undefined; // Clear reason if previously rejected
      await story.save();

      // Log action
      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: 'approve_story',
        targetType: 'story',
        targetId: storyId as string,
      });

      logger.info(`Story approved: ${storyId} by admin ${adminId}`);
      await clearCachePattern('stories:*');

      // Award points via Point Service
      try {
        await axios.post(`${process.env.POINT_SERVICE_URL || 'http://localhost:3007'}/api/points/award`, {
          userId: story.authorId,
          action: 'story_published',
          referenceId: story.storyId,
          referenceType: 'story'
        });
      } catch (err: any) {
        logger.error(`Failed to trigger point-service award for story ${storyId}: ${err.message}`);
      }

      // Trigger notification to the author that content has been validated (approved)
      try {
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          userId: story.authorId,
          title: 'Story Approved & Published',
          message: `Your story "${story.title}" has been successfully verified and published!`,
          type: 'story_approved',
          referenceId: story.storyId
        });
      } catch (err: any) {
        logger.error(`Failed to send story approval notification for story ${storyId}: ${err.message}`);
      }

      res.status(200).json({ success: true, story });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Reject a story (Admin only)
  static async rejectStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      if (!reason) {
        res.status(400).json({ success: false, error: 'Reason for rejection is required' });
        return;
      }

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      // Trigger notification to the author that content was rejected
      try {
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          userId: story.authorId,
          title: 'Story Rejected',
          message: `Your story "${story.title}" was rejected by the administrator. Reason: "${reason}"`,
          type: 'story_rejected',
          referenceId: story.storyId
        });
      } catch (err: any) {
        logger.error(`Failed to send story rejection notification for story ${storyId}: ${err.message}`);
      }

      // Delete the story from database so it disappears completely
      await Story.deleteOne({ storyId });

      // Log action
      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: 'reject_story',
        targetType: 'story',
        targetId: storyId as string,
        reason,
      });

      logger.info(`Story rejected and deleted: ${storyId} by admin ${adminId}. Reason: ${reason}`);
      await clearCachePattern('stories:*');

      res.status(200).json({ success: true, message: 'Story rejected and deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Bulk approve stories (Admin only)
  static async bulkApproveStories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyIds } = req.body;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
        res.status(400).json({ success: false, error: 'storyIds must be an array of strings' });
        return;
      }

      const result = await Story.updateMany(
        { storyId: { $in: storyIds } },
        { 
          $set: { 
            isPublished: true, 
            approvedBy: adminId, 
            publishedAt: new Date(),
            rejectionReason: undefined
          } 
        }
      );

      // Create log entries in bulk or simple format
      const logs = storyIds.map(id => ({
        logId: uuidv4(),
        adminId,
        adminName,
        action: 'approve_story_bulk',
        targetType: 'story',
        targetId: id,
      }));
      await AuditLog.insertMany(logs);

      logger.info(`Bulk approved ${result.modifiedCount} stories by admin ${adminId}`);
      await clearCachePattern('stories:*');

      // Award points for each approved story in bulk
      try {
        const approvedStories = await Story.find({ storyId: { $in: storyIds } });
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
        for (const story of approvedStories) {
          await axios.post(`${process.env.POINT_SERVICE_URL || 'http://localhost:3007'}/api/points/award`, {
            userId: story.authorId,
            action: 'story_published',
            referenceId: story.storyId,
            referenceType: 'story'
          });

          // Trigger notification to the author
          try {
            await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
              userId: story.authorId,
              title: 'Story Approved & Published',
              message: `Your story "${story.title}" has been successfully verified and published!`,
              type: 'story_approved',
              referenceId: story.storyId
            });
          } catch (err: any) {
            logger.error(`Failed to send bulk story approval notification for story ${story.storyId}: ${err.message}`);
          }
        }
      } catch (err: any) {
        logger.error(`Failed to trigger point-service award in bulk: ${err.message}`);
      }

      res.status(200).json({ success: true, count: result.modifiedCount });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete story (Admin only)
  static async deleteStory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const adminId = req.user!.firebase_uid;
      const adminName = req.user!.name || req.user!.email;

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      await Story.deleteOne({ storyId });

      await AuditLog.create({
        logId: uuidv4(),
        adminId,
        adminName,
        action: 'delete_story',
        targetType: 'story',
        targetId: storyId as string,
      });

      logger.info(`Story deleted: ${storyId} by admin ${adminId}`);
      await clearCachePattern('stories:*');
      res.status(200).json({ success: true, message: 'Story permanently removed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Translate a story's transcript to a target language
  static async translateTranscript(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { storyId } = req.params;
      const { targetLanguage } = req.body; // e.g. 'en' or 'fr'

      if (!targetLanguage || !['en', 'fr'].includes(targetLanguage)) {
        res.status(400).json({ success: false, error: 'Target language must be either en or fr' });
        return;
      }

      const story = await Story.findOne({ storyId });
      if (!story) {
        res.status(404).json({ success: false, error: 'Story not found' });
        return;
      }

      if (!story.transcript) {
        res.status(400).json({ success: false, error: 'No transcript available to translate yet' });
        return;
      }

      const sourceLanguage = story.language || 'en';
      if (sourceLanguage === targetLanguage) {
        res.status(200).json({ success: true, translatedText: story.transcript });
        return;
      }

      // Check if translation already cached
      const cached = story.translations ? story.translations.get(targetLanguage) : null;
      if (cached) {
        res.status(200).json({ success: true, translatedText: cached });
        return;
      }

      // Translate using TranslationService
      const { TranslationService } = require('../services/translation.service');
      const translatedText = await TranslationService.translateText(story.transcript, sourceLanguage, targetLanguage);

      // Save translation in DB
      if (!story.translations) {
        story.translations = new Map();
      }
      story.translations.set(targetLanguage, translatedText);
      await story.save();

      res.status(200).json({ success: true, translatedText });
    } catch (error: any) {
      logger.error('Translate transcript error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}