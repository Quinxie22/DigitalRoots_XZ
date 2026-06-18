import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ChatService } from '../services/chat.service';
import { FileService } from '../services/file.service';
import { VoiceService } from '../services/voice.service';
import { Message } from '../models/message.model';
import { MessageType } from '../models/message.types';
import { Report } from '../models/report.model';
import logger from '../utils/logger';

export class ChatController {
  // Get user's active chat threads
  static async getThreads(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await ChatService.getUserThreads(firebaseUid, page, limit);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error in getThreads:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Get or create a direct thread with another user
  static async getOrCreateThread(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { targetUserId } = req.params as { targetUserId: string };

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!targetUserId) {
        res.status(400).json({ error: 'Bad Request', message: 'Target user ID is required' });
        return;
      }

      if (firebaseUid === targetUserId) {
        res.status(400).json({ error: 'Bad Request', message: 'Cannot chat with yourself' });
        return;
      }

      // ── Block direct messaging to Admin users ──────────────────────
      try {
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3006';
        const userRes = await fetch(`${userServiceUrl}/api/users/${targetUserId}`, {
          headers: { 'x-internal-key': process.env.INTERNAL_KEY || 'internal-secret' }
        });
        if (userRes.ok) {
          const userData: any = await userRes.json();
          const targetUser = userData.user || userData;
          if (targetUser.role === 'Admin') {
            res.status(403).json({ error: 'Forbidden', message: 'Cannot send direct messages to administrators' });
            return;
          }
        }
      } catch (lookupErr) {
        logger.warn('Could not verify target user role, allowing thread creation:', lookupErr);
      }

      const participants = [firebaseUid, targetUserId];
      const thread = await ChatService.getOrCreateThread(participants, 'direct');
      res.status(200).json(thread);
    } catch (error: any) {
      logger.error('Error in getOrCreateThread:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Get messages for a specific thread with pagination
  static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      const beforeQuery = req.query.before as string;
      const beforeDate = beforeQuery ? new Date(beforeQuery) : undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await ChatService.getMessages(threadId, firebaseUid, beforeDate, limit);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Error in getMessages:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Send a text message to a thread
  static async sendTextMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };
      const { content, replyTo, mentions } = req.body;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      if (!content || content.trim() === '') {
        res.status(400).json({ error: 'Bad Request', message: 'Message content cannot be empty' });
        return;
      }

      const message = await ChatService.sendTextMessage(threadId, firebaseUid, content, replyTo, mentions);

      const io = req.app.get('io');
      if (io) {
        await ChatController.deliverAndEmitMessage(io, threadId, firebaseUid, message);
      }

      res.status(201).json(message);
    } catch (error: any) {
      logger.error('Error in sendTextMessage:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Get shared archive files for a thread
  static async getArchives(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      const archives = await ChatService.getSharedArchives(threadId, firebaseUid);
      res.status(200).json(archives);
    } catch (error: any) {
      logger.error('Error in getArchives:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Update thread discussion topic
  static async updateTopic(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };
      const { topic } = req.body;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      if (!topic || topic.trim() === '') {
        res.status(400).json({ error: 'Bad Request', message: 'Topic is required' });
        return;
      }

      const thread = await ChatService.updateThreadTopic(threadId, firebaseUid, topic);

      // Emit topic update socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`thread:${threadId}`).emit('topic-updated', { threadId, topic });
      }

      res.status(200).json(thread);
    } catch (error: any) {
      logger.error('Error in updateTopic:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Upload file to thread
  static async uploadFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };
      const file = req.file;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      if (!file) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded' });
        return;
      }

      const category = FileService.getFileCategory(file.mimetype);
      const validation = FileService.validateFile(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        category
      );

      if (!validation.valid) {
        res.status(400).json({ error: 'Bad Request', message: validation.error });
        return;
      }

      const fileResult = await FileService.uploadFile(file.buffer, file.originalname, category, true);

      // Map FileCategory to MessageType
      let messageType = MessageType.DOCUMENT;
      if (category === 'image') messageType = MessageType.IMAGE;
      else if (category === 'video') messageType = MessageType.VIDEO;
      else if (category === 'audio') messageType = MessageType.AUDIO;

      const message = await ChatService.sendFileMessage(
        threadId,
        firebaseUid,
        messageType,
        file.originalname,
        fileResult.metadata as any
      );

      const io = req.app.get('io');
      if (io) {
        await ChatController.deliverAndEmitMessage(io, threadId, firebaseUid, message);
      }

      res.status(201).json(message);
    } catch (error: any) {
      logger.error('Error in uploadFile:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Send voice message (upload + transcribe)
  static async sendVoiceMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };
      const file = req.file;
      const duration = parseFloat(req.body.duration as string) || 0;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      if (!file) {
        res.status(400).json({ error: 'Bad Request', message: 'No audio file uploaded' });
        return;
      }

      const result = await VoiceService.sendVoiceMessage(threadId, firebaseUid, file.buffer, duration);

      // Fetch the created message so we can emit it over Socket.io
      const message = await Message.findOne({ messageId: result.messageId });

      const io = req.app.get('io');
      if (io) {
        await ChatController.deliverAndEmitMessage(io, threadId, firebaseUid, message);
      }

      res.status(201).json(message);
    } catch (error: any) {
      logger.error('Error in sendVoiceMessage controller:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Mark messages in a thread as read by the current user
  static async markRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      // Add user to readBy for all unread messages in the thread
      const result = await Message.updateMany(
        { threadId, readBy: { $ne: firebaseUid }, senderId: { $ne: firebaseUid }, isDeleted: false },
        { $addToSet: { readBy: firebaseUid, deliveredTo: firebaseUid } }
      );

      // Clear unread count for this user in the thread document
      const { Thread } = await import('../models/thread.model');
      await Thread.updateOne(
        { threadId },
        { $set: { [`unreadCount.${firebaseUid}`]: 0 } }
      );

      // Notify sender(s) that their messages were read in their individual user rooms
      const io = req.app.get('io');
      if (io) {
        const thread = await Thread.findOne({ threadId });
        if (thread) {
          for (const participantId of thread.participants) {
            io.to(`user:${participantId}`).emit('messages-read', { threadId, readBy: firebaseUid });
          }
        }
      }

      // Clear associated chat notifications for this user/thread on the notification microservice
      try {
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
        await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications/user/${firebaseUid}/reference/${threadId}`, {
          method: 'DELETE'
        });
      } catch (nErr: any) {
        logger.error(`Failed to clear chat notifications for user ${firebaseUid} and thread ${threadId}: ${nErr.message}`);
      }

      res.status(200).json({ updated: result.modifiedCount });
    } catch (error: any) {
      logger.error('Error in markRead:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Delete a message (soft delete — only the sender can delete their own messages)
  static async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId, messageId } = req.params as { threadId: string; messageId: string };

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const msg = await Message.findOne({ messageId, threadId });
      if (!msg) {
        res.status(404).json({ error: 'Not Found', message: 'Message not found' });
        return;
      }

      if (msg.senderId !== firebaseUid) {
        res.status(403).json({ error: 'Forbidden', message: 'Cannot delete messages from other users' });
        return;
      }

      msg.isDeleted = true;
      msg.deletedAt = new Date();
      msg.content = 'This message was deleted';
      await msg.save();

      const io = req.app.get('io');
      if (io) {
        const { Thread } = await import('../models/thread.model');
        const thread = await Thread.findOne({ threadId });
        if (thread) {
          for (const participantId of thread.participants) {
            io.to(`user:${participantId}`).emit('message-deleted', { threadId, messageId });
          }
        }
      }

      res.status(200).json({ deleted: true });
    } catch (error: any) {
      logger.error('Error in deleteMessage:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  // Report a connection/user in a thread
  static async reportConnection(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      const { threadId } = req.params as { threadId: string };
      const { reason } = req.body;

      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      if (!threadId) {
        res.status(400).json({ error: 'Bad Request', message: 'Thread ID is required' });
        return;
      }

      if (!reason || reason.trim() === '') {
        res.status(400).json({ error: 'Bad Request', message: 'Reason for report is required' });
        return;
      }

      const { Thread } = await import('../models/thread.model');
      const thread = await Thread.findOne({ threadId, participants: firebaseUid });
      if (!thread) {
        res.status(404).json({ error: 'Not Found', message: 'Thread not found or access denied' });
        return;
      }

      // Find the reported user (the other participant in a direct thread)
      const reportedUserId = thread.participants.find(p => p !== firebaseUid);
      if (!reportedUserId) {
        res.status(400).json({ error: 'Bad Request', message: 'No other participant found to report' });
        return;
      }

      const report = await Report.create({
        threadId,
        reporterId: firebaseUid,
        reportedUserId,
        reason,
      });

      res.status(201).json({ success: true, reportId: report.reportId });
    } catch (error: any) {
      logger.error('Error in reportConnection:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }


  // Helper to mark message delivered to online participants and emit it
  private static async deliverAndEmitMessage(io: any, threadId: string, firebaseUid: string, message: any) {
    if (!message) return;
    
    try {
      const { Thread } = await import('../models/thread.model');
      const thread = await Thread.findOne({ threadId });
      if (thread) {
        const recipients = thread.participants.filter(p => p !== firebaseUid);
        const onlineRecipients = [];
        for (const recipientId of recipients) {
          const recipientRoom = io.sockets.adapter.rooms.get(`user:${recipientId}`);
          if (recipientRoom && recipientRoom.size > 0) {
            onlineRecipients.push(recipientId);
          }
        }
        if (onlineRecipients.length > 0) {
          message.deliveredTo = Array.from(new Set([...(message.deliveredTo || []), ...onlineRecipients]));
          await message.save();
        }

        // Trigger notification to the message recipients
        const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010';
        for (const recipientId of recipients) {
          try {
            await fetch(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: recipientId,
                title: 'New Message Received',
                message: message.content && message.content.length > 60 ? `${message.content.slice(0, 60)}...` : message.content,
                type: 'chat_message',
                referenceId: threadId
              })
            });
          } catch (nErr: any) {
            logger.error(`Failed to send chat message notification to user ${recipientId}: ${nErr.message}`);
          }
        }
      }
    } catch (err) {
      logger.error('Error in deliverAndEmitMessage update:', err);
    }

    io.to(`thread:${threadId}`).emit('new-message', message);
  }

  // Generic file upload (profile pictures, etc.) — returns URL only, no message created
  static async uploadGenericFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const firebaseUid = req.user?.firebase_uid;
      if (!firebaseUid) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Bad Request', message: 'No file uploaded' });
        return;
      }

      const category = FileService.getFileCategory(file.mimetype);
      const validation = FileService.validateFile(
        { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size },
        category
      );

      if (!validation.valid) {
        res.status(400).json({ error: 'Bad Request', message: validation.error });
        return;
      }

      // Upload without generating a thumbnail to preserve the full-res image
      const fileResult = await FileService.uploadFile(file.buffer, file.originalname, category, false);

      res.status(200).json({ success: true, url: fileResult.url });
    } catch (error: any) {
      logger.error('Error in uploadGenericFile:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
}
