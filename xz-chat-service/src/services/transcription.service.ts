import openai from '../config/openai';
import { Message } from '../models/message.model';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { v4 as uuidv4 } from 'uuid';

export class TranscriptionService {
  static queueTranscription(messageId: string, mediaUrl: string): void {
    // Run asynchronously in the background
    this.processTranscription(messageId, mediaUrl).catch((error) => {
      logger.error(`Unhandled transcription background error for message ${messageId}:`, error);
    });
  }

  private static downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (url.startsWith('/uploads/')) {
        const sourcePath = path.join(__dirname, '../../public', url);
        fs.copyFile(sourcePath, dest, (err) => {
          if (err) reject(err);
          else resolve();
        });
        return;
      }

      const client = url.startsWith('https') ? https : require('http');
      client.get(url, (response: any) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: status code ${response.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err: any) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }

  private static emitUpdate(message: any) {
    if (!message) return;
    try {
      const { io } = require('../app');
      if (io) {
        io.to(`thread:${message.threadId}`).emit('message-updated', message);
        logger.info(`Emitted message-updated event via socket for thread ${message.threadId}`);
      }
    } catch (e: any) {
      logger.error('Error emitting message-updated socket event:', e);
    }
  }

  private static async processTranscription(messageId: string, mediaUrl: string): Promise<void> {
    logger.info(`Starting transcription for message: ${messageId}`);
    try {
      const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
      if (!apiKey || apiKey === 'your_openai_api_key' || apiKey === 'dummy-key-for-compilation') {
        logger.warn(`OpenAI API Key is not configured or is default. Placing transcription service on standby.`);
        
        // Standby mode: Update message with a mock or default text so the app doesn't hang in "pending" status
        const updated = await Message.findOneAndUpdate(
          { messageId },
          {
            transcriptStatus: 'completed',
            transcript: '[Transcription Service Standby: API Key not configured]',
            content: 'Voice message (Transcription standby: API key not set)',
          },
          { new: true }
        );
        this.emitUpdate(updated);
        return;
      }

      // Download the audio file from mediaUrl
      const tempFilePath = path.join(os.tmpdir(), `${uuidv4()}.webm`);
      
      try {
        await this.downloadFile(mediaUrl, tempFilePath);
        logger.info(`Sending audio to OpenAI Whisper API for message ${messageId}`);
        
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
        });

        logger.info(`Transcription successful for message ${messageId}`);
        const updated = await Message.findOneAndUpdate(
          { messageId },
          {
            transcriptStatus: 'completed',
            transcript: transcription.text,
            content: transcription.text || '[Empty voice message]',
          },
          { new: true }
        );
        this.emitUpdate(updated);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error: any) {
      logger.error(`Transcription process failed for message ${messageId}:`, error);
      
      // Update message status to failed
      try {
        const updated = await Message.findOneAndUpdate(
          { messageId },
          {
            transcriptStatus: 'failed',
            transcript: `[Transcription failed: ${error.message}]`,
            content: 'Voice message (transcription failed)',
          },
          { new: true }
        );
        this.emitUpdate(updated);
      } catch (dbError) {
        logger.error(`Failed to update message status after transcription error:`, dbError);
      }
    }
  }
}
