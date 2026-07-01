import OpenAI from 'openai';
import { Story } from '../models/story.model';
import logger from '../utils/logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Bull, { Queue } from 'bull';

// Lazy client — only created when a real API key is present
let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export class TranscriptionService {
  private static transcriptionQueue: Queue;
  
  static initializeQueue() {
    this.transcriptionQueue = new Bull('story-transcription', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6380'),
      },
    });

    this.transcriptionQueue.on('error', (error) => {
      logger.error('Transcription queue Redis error:', error);
    });
    
    this.transcriptionQueue.process(async (job: any) => {
      const { storyId, audioUrl } = job.data;
      return await this.processTranscription(storyId, audioUrl);
    });
    
    logger.info('Transcription queue initialized');
  }
  
  static async queueTranscription(storyId: string, audioUrl: string): Promise<void> {
    if (!this.transcriptionQueue) {
      this.initializeQueue();
    }
    await this.transcriptionQueue.add(
      { storyId, audioUrl },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
    );
    logger.info(`Queued transcription for story: ${storyId}`);
  }
  
  private static async processTranscription(storyId: string, audioUrl: string): Promise<any> {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'sk-your-openai-key' || apiKey === 'dummy-key-for-compilation' || apiKey.startsWith('sk-your')) {
        logger.warn(`OpenAI API Key is not configured or is default in Content Service. Placing transcription service on standby.`);
        await Story.updateOne(
          { storyId },
          {
            transcriptStatus: 'completed',
            transcript: '[Transcription Service Standby: API Key not configured]',
          }
        );
        return { success: true, transcript: '[Standby: API Key not configured]' };
      }

      await Story.updateOne({ storyId }, { transcriptStatus: 'processing' });
      
      // Download audio
      const tempFilePath = path.join(os.tmpdir(), `${storyId}.mp3`);
      if (audioUrl.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '../../', audioUrl);
        fs.copyFileSync(localPath, tempFilePath);
      } else {
        const response = await axios({ method: 'GET', url: audioUrl, responseType: 'stream' });
        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      }
      
      // Get story's chosen language dynamically from MongoDB
      const story = await Story.findOne({ storyId });
      const storyLanguage = story?.language || 'en';

      // Transcribe with Whisper
      const transcription = await getOpenAIClient().audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: storyLanguage,
        response_format: 'verbose_json',
      });
      
      const transcriptText = (transcription as any).text || transcription;
      
      // Clean up
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      // Update story
      await Story.updateOne(
        { storyId },
        { transcript: transcriptText, transcriptStatus: 'completed' }
      );
      
      logger.info(`Transcription completed for story: ${storyId}`);
      return { success: true, transcript: transcriptText };
      
    } catch (error) {
      logger.error(`Transcription failed for story ${storyId}:`, error);
      await Story.updateOne({ storyId }, { transcriptStatus: 'failed' });
      return { success: false, error };
    }
  }
}
