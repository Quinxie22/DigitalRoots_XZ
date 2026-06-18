import cloudinary from '../config/cloudinary';
import sharp from 'sharp';
import { Readable } from 'stream';
import { FileMetadata } from '../models/content.types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export enum FileCategory {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

export class FileService {
  static ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  static ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
  static ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
  
  static MAX_SIZES = {
    image: 10 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    audio: 25 * 1024 * 1024,
  };
  
  static isMockCloudinary(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return !cloudName || cloudName === 'your_cloud_name' || cloudName.trim() === '';
  }

  static getFileCategory(mimetype: string): FileCategory | null {
    if (this.ALLOWED_IMAGE_TYPES.includes(mimetype)) return FileCategory.IMAGE;
    if (this.ALLOWED_VIDEO_TYPES.includes(mimetype)) return FileCategory.VIDEO;
    if (this.ALLOWED_AUDIO_TYPES.includes(mimetype)) return FileCategory.AUDIO;
    return null;
  }
  
  static async uploadFile(
    buffer: Buffer,
    originalName: string,
    category: FileCategory,
    folder: string = 'xz-content'
  ): Promise<{ url: string; thumbnailUrl?: string; metadata: Partial<FileMetadata> }> {
    
    const fileId = uuidv4();
    const ext = path.extname(originalName) || '';
    const safeFileName = `${fileId}${ext}`;
    const uploadFolder = `${folder}/${category}s`;

    if (this.isMockCloudinary()) {
      logger.info(`Running in Cloudinary Mock Mode. Saving file locally: ${originalName}`);
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, safeFileName);
      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${safeFileName}`;
      let thumbnailUrl: string | undefined;

      let metadata: Partial<FileMetadata> = {
        url: fileUrl,
        fileName: originalName,
        fileSize: buffer.length,
        mimeType: category === FileCategory.IMAGE ? 'image/jpeg' : 'application/octet-stream',
      };

      if (category === FileCategory.IMAGE) {
        try {
          const thumbnailBuffer = await sharp(buffer)
            .resize(500, 500, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer();
          const thumbFileName = `thumb_${fileId}.jpg`;
          const thumbPath = path.join(uploadsDir, thumbFileName);
          fs.writeFileSync(thumbPath, thumbnailBuffer);
          thumbnailUrl = `/uploads/${thumbFileName}`;
          metadata.thumbnailUrl = thumbnailUrl;

          const imgInfo = await sharp(buffer).metadata();
          metadata.width = imgInfo.width;
          metadata.height = imgInfo.height;
        } catch (error) {
          logger.error('Mock thumbnail generation failed:', error);
        }
      }

      return { url: fileUrl, thumbnailUrl, metadata };
    }
    
    // Generate thumbnail for images
    let thumbnailUrl: string | undefined;
    let metadata: Partial<FileMetadata> = {
      fileName: originalName,
      fileSize: buffer.length,
      mimeType: category === FileCategory.IMAGE ? 'image/jpeg' : 'application/octet-stream',
    };
    
    if (category === FileCategory.IMAGE) {
      const thumbnailBuffer = await sharp(buffer)
        .resize(500, 500, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      const thumbResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `${uploadFolder}/thumbnails`, public_id: `${fileId}_thumb` },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        const readable = new Readable();
        readable.push(thumbnailBuffer);
        readable.push(null);
        readable.pipe(stream);
      });
      thumbnailUrl = thumbResult.secure_url;
      
      // Get dimensions
      const imgInfo = await sharp(buffer).metadata();
      metadata.width = imgInfo.width;
      metadata.height = imgInfo.height;
      metadata.thumbnailUrl = thumbnailUrl;
    }
    
    // Upload original file
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: uploadFolder,
          public_id: fileId,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
    
    metadata.url = uploadResult.secure_url;
    
    return { url: uploadResult.secure_url, thumbnailUrl, metadata };
  }
  
  static async uploadAudio(buffer: Buffer, originalName: string): Promise<string> {
    const fileId = uuidv4();
    const ext = path.extname(originalName) || '.webm';
    const safeFileName = `${fileId}${ext}`;

    if (this.isMockCloudinary()) {
      logger.info(`Running in Cloudinary Mock Mode. Saving audio locally: ${originalName}`);
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, safeFileName);
      fs.writeFileSync(filePath, buffer);

      return `/uploads/${safeFileName}`;
    }

    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'xz-content/audio',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
    return result.secure_url;
  }
}
