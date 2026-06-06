import cloudinary from '../config/cloudinary';
import { TranscriptionService } from './transcription.service';
import { MessageType } from '../models/message.types';
import { Message } from '../models/message.model';
import { Thread } from '../models/thread.model';
import { FileService } from './file.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class VoiceService {
  // Upload voice note
  static async uploadVoiceNote(audioBuffer: Buffer, originalName: string = 'voice-note.webm'): Promise<string> {
    return await FileService.uploadVoiceNote(audioBuffer);
  }

  // Send voice message (async transcription)
  static async sendVoiceMessage(
    threadId: string,
    senderId: string,
    audioBuffer: Buffer,
    duration: number
  ): Promise<any> {
    const messageId = uuidv4();
    const timestamp = new Date();
    
    // Upload to Cloudinary
    const mediaUrl = await this.uploadVoiceNote(audioBuffer);
    
    // Create message with pending transcription
    const message = await Message.create({
      threadId,
      messageId,
      senderId,
      type: MessageType.VOICE,
      content: 'Processing transcription...',
      mediaUrl,
      transcriptStatus: 'pending',
      duration,
      timestamp,
      readBy: [senderId],
      deliveredTo: [senderId],
    });
    
    // Start async transcription
    TranscriptionService.queueTranscription(messageId, mediaUrl);
    
    // Update thread
    const thread = await Thread.findOne({ threadId });
    const recipientIds = thread?.participants.filter(p => p !== senderId) || [];
    
    await Thread.updateOne(
      { threadId },
      {
        lastMessage: { content: 'Voice message', type: MessageType.VOICE, sentAt: timestamp, senderId },
        updatedAt: timestamp,
        $inc: recipientIds.reduce((acc, id) => ({ ...acc, [`unreadCount.${id}`]: 1 }), {}),
      }
    );
    
    return { messageId, mediaUrl, transcriptionQueued: true };
  }

  // Get transcription status
  static async getTranscription(messageId: string): Promise<any> {
    const message = await Message.findOne({ messageId });
    if (!message) throw new Error('Message not found');
    
    return {
      status: message.transcriptStatus,
      transcript: message.transcript,
      content: message.content,
    };
  }
}