import { Thread } from '../models/thread.model';
import { Message } from '../models/message.model';
import { MessageType, FileMetadata } from '../models/message.types';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis';
import logger from '../utils/logger';

export class ChatService {
  // Get or create thread (direct or group)
  static async getOrCreateThread(
    participants: string[],
    threadType: 'direct' | 'group' = 'direct',
    threadName?: string,
    discussionTopic?: string
  ): Promise<any> {
    const threadId = Thread.generateThreadId(participants);
    
    let thread = await Thread.findOne({ threadId });
    
    if (!thread) {
      const unreadMap = new Map();
      participants.forEach(p => unreadMap.set(p, 0));
      
      thread = await Thread.create({
        threadId,
        participants,
        threadType,
        threadName: threadName || (threadType === 'direct' ? undefined : 'Group Chat'),
        unreadCount: unreadMap,
        discussionTopic: discussionTopic || '',
      });
      logger.info(`Created new thread: ${threadId}`);
    } else if (discussionTopic !== undefined && discussionTopic.trim() !== '') {
      thread.discussionTopic = discussionTopic;
      await thread.save();
      logger.info(`Updated existing thread ${threadId} discussion topic to: "${discussionTopic}"`);
    }
    
    return thread;
  }
  
  // Get user's threads
  static async getUserThreads(
    firebaseUid: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const threads = await Thread.find({
      participants: firebaseUid,
      [`isArchived.${firebaseUid}`]: { $ne: true },
    })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Thread.countDocuments({
      participants: firebaseUid,
      [`isArchived.${firebaseUid}`]: { $ne: true },
    });
    
    return { threads, total, page, totalPages: Math.ceil(total / limit) };
  }
  
  // Get messages for a thread with pagination
  static async getMessages(
    threadId: string,
    firebaseUid: string,
    before?: Date,
    limit: number = 50
  ): Promise<any> {
    // Verify user is participant
    const thread = await Thread.findOne({ threadId, participants: firebaseUid });
    if (!thread) {
      throw new Error('Thread not found or access denied');
    }
    
    const query: any = { threadId, isDeleted: false };
    if (before) {
      query.timestamp = { $lt: before };
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit);
    
    const hasMore = messages.length === limit;
    
    // Mark messages as delivered
    await Message.updateMany(
      { threadId, deliveredTo: { $ne: firebaseUid }, senderId: { $ne: firebaseUid } },
      { $addToSet: { deliveredTo: firebaseUid } }
    );
    
    return { messages: messages.reverse(), hasMore };
  }
  
  // Send text message
  static async sendTextMessage(
    threadId: string,
    senderId: string,
    content: string,
    replyTo?: string,
    mentions?: string[]
  ): Promise<any> {
    const messageId = uuidv4();
    const timestamp = new Date();
    
    const message = await Message.create({
      threadId,
      messageId,
      senderId,
      type: MessageType.TEXT,
      content,
      replyTo,
      mentions,
      timestamp,
      readBy: [senderId],
      deliveredTo: [senderId],
    });
    
    // Update thread last message
    const thread = await Thread.findOne({ threadId });
    const recipientIds = thread?.participants.filter(p => p !== senderId) || [];
    
    await Thread.updateOne(
      { threadId },
      {
        lastMessage: { content, type: MessageType.TEXT, sentAt: timestamp, senderId },
        updatedAt: timestamp,
        $inc: recipientIds.reduce((acc, id) => ({ ...acc, [`unreadCount.${id}`]: 1 }), {}),
      }
    );
    
    return message;
  }
  
  // Send file message
  static async sendFileMessage(
    threadId: string,
    senderId: string,
    type: MessageType,
    content: string,
    fileMetadata: FileMetadata
  ): Promise<any> {
    const messageId = uuidv4();
    const timestamp = new Date();
    
    const message = await Message.create({
      threadId,
      messageId,
      senderId,
      type,
      content: content || `Sent a ${type}`,
      fileMetadata,
      timestamp,
      readBy: [senderId],
      deliveredTo: [senderId],
    });
    
    // Update thread
    const thread = await Thread.findOne({ threadId });
    const recipientIds = thread?.participants.filter(p => p !== senderId) || [];
    
    let displayContent = `📷 Photo`;
    if (type === MessageType.VIDEO) displayContent = `🎥 Video`;
    if (type === MessageType.AUDIO) displayContent = `🎵 Audio`;
    if (type === MessageType.DOCUMENT) displayContent = `📄 Document`;
    if (type === MessageType.VOICE_NOTE || (type as string) === 'voice') displayContent = `🎤 Voice Note`;

    await Thread.updateOne(
      { threadId },
      {
        lastMessage: { content: displayContent, type, sentAt: timestamp, senderId, mediaUrl: fileMetadata.url },
        updatedAt: timestamp,
        $inc: recipientIds.reduce((acc, id) => ({ ...acc, [`unreadCount.${id}`]: 1 }), {}),
      }
    );

    return message;
  }

  // Get shared archive files for a thread
  static async getSharedArchives(threadId: string, firebaseUid: string): Promise<any> {
    const thread = await Thread.findOne({ threadId, participants: firebaseUid });
    if (!thread) {
      throw new Error('Thread not found or access denied');
    }

    const messages = await Message.find({
      threadId,
      fileMetadata: { $exists: true, $ne: null },
      isDeleted: false,
    }).sort({ timestamp: -1 });

    return messages;
  }

  // Update thread discussion topic
  static async updateThreadTopic(threadId: string, firebaseUid: string, topic: string): Promise<any> {
    const thread = await Thread.findOne({ threadId, participants: firebaseUid });
    if (!thread) {
      throw new Error('Thread not found or access denied');
    }

    thread.discussionTopic = topic;
    await thread.save();

    logger.info(`Updated discussion topic for thread ${threadId} to: "${topic}"`);
    return thread;
  }
}