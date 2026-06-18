import cloudinary from '../config/cloudinary';
import sharp from 'sharp';
import { Readable } from 'stream';
import { FileMetadata, FileCategory } from '../models/message.types';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export class FileService {
  // Allowed file types
  static ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
  static ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  static ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'];
  static ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  
  static MAX_FILE_SIZE = {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
    audio: 25 * 1024 * 1024, // 25MB
    document: 20 * 1024 * 1024, // 20MB
  };
  
  // Determine file category
  static getFileCategory(mimetype: string): FileCategory {
    if (this.ALLOWED_IMAGE_TYPES.includes(mimetype)) return FileCategory.IMAGE;
    if (this.ALLOWED_VIDEO_TYPES.includes(mimetype)) return FileCategory.VIDEO;
    if (this.ALLOWED_AUDIO_TYPES.includes(mimetype)) return FileCategory.AUDIO;
    if (this.ALLOWED_DOCUMENT_TYPES.includes(mimetype)) return FileCategory.DOCUMENT;
    return FileCategory.OTHER;
  }
  
  // Validate file
  static validateFile(file: UploadedFile, category: FileCategory): { valid: boolean; error?: string } {
    const maxSize = this.MAX_FILE_SIZE[category as keyof typeof this.MAX_FILE_SIZE] || 10 * 1024 * 1024;
    
    if (file.size > maxSize) {
      return { valid: false, error: `File too large. Max ${maxSize / (1024 * 1024)}MB` };
    }
    
    const allowedTypes = this.getAllowedTypes(category);
    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: `File type ${file.mimetype} not allowed for ${category}` };
    }
    
    return { valid: true };
  }
  
  static getAllowedTypes(category: FileCategory): string[] {
    switch (category) {
      case FileCategory.IMAGE: return this.ALLOWED_IMAGE_TYPES;
      case FileCategory.VIDEO: return this.ALLOWED_VIDEO_TYPES;
      case FileCategory.AUDIO: return this.ALLOWED_AUDIO_TYPES;
      case FileCategory.DOCUMENT: return this.ALLOWED_DOCUMENT_TYPES;
      default: return [];
    }
  }
  
  // Generate thumbnail for images
  static async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    try {
      const thumbnail = await sharp(buffer)
        .resize(300, 300, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toBuffer();
      return thumbnail;
    } catch (error) {
      logger.error('Thumbnail generation failed:', error);
      return buffer; // Return original if thumbnail fails
    }
  }
  
  static isMockCloudinary(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return !cloudName || cloudName === 'your_cloud_name' || cloudName.trim() === '';
  }

  // Upload file to Cloudinary with Local Fallback
  static async uploadFile(
    buffer: Buffer,
    originalName: string,
    category: FileCategory,
    generateThumb: boolean = true
  ): Promise<{ url: string; thumbnailUrl?: string; metadata: Partial<FileMetadata> }> {
    const fileId = uuidv4();
    const ext = path.extname(originalName) || '';
    const safeFileName = `${fileId}${ext}`;

    if (this.isMockCloudinary()) {
      logger.info(`Running in Cloudinary Mock Mode. Saving file locally: ${originalName}`);
      const uploadsDir = path.join(__dirname, '../../public/uploads');
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

      if (category === FileCategory.IMAGE && generateThumb) {
        try {
          const thumbnailBuffer = await this.generateThumbnail(buffer);
          const thumbFileName = `thumb_${fileId}.jpg`;
          const thumbPath = path.join(uploadsDir, thumbFileName);
          fs.writeFileSync(thumbPath, thumbnailBuffer);
          thumbnailUrl = `/uploads/${thumbFileName}`;
          metadata.thumbnailUrl = thumbnailUrl;

          const sharpInstance = sharp(buffer);
          const imageMeta = await sharpInstance.metadata();
          metadata.width = imageMeta.width;
          metadata.height = imageMeta.height;
        } catch (error) {
          logger.error('Mock thumbnail generation failed:', error);
        }
      }

      if (category === FileCategory.VIDEO) {
        metadata.duration = 0;
      }

      return { url: fileUrl, thumbnailUrl, metadata };
    }

    const folder = `xz-chat/${category}s`;
    
    // Determine upload options based on file type
    const uploadOptions: any = {
      folder,
      public_id: fileId,
      resource_type: 'auto',
    };
    
    // For images, add transformations
    if (category === FileCategory.IMAGE) {
      uploadOptions.transformation = [
        { quality: 'auto:good', fetch_format: 'auto' },
        { width: 1200, crop: 'limit' },
      ];
    }
    
    // Upload to Cloudinary
    const uploadPromise = new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
    
    const result = await uploadPromise;
    
    let thumbnailUrl: string | undefined;
    let metadata: Partial<FileMetadata> = {
      url: result.secure_url,
      fileName: originalName,
      fileSize: buffer.length,
      mimeType: category === FileCategory.IMAGE ? 'image/jpeg' : 'application/octet-stream',
    };
    
    // Generate and upload thumbnail for images
    if (category === FileCategory.IMAGE && generateThumb) {
      const thumbnailBuffer = await this.generateThumbnail(buffer);
      const thumbResult = await new Promise<any>((resolve, reject) => {
        const thumbStream = cloudinary.uploader.upload_stream(
          { folder: `${folder}/thumbnails`, public_id: `${fileId}_thumb`, resource_type: 'image' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        const thumbReadable = new Readable();
        thumbReadable.push(thumbnailBuffer);
        thumbReadable.push(null);
        thumbReadable.pipe(thumbStream);
      });
      
      thumbnailUrl = thumbResult.secure_url;
      metadata.thumbnailUrl = thumbnailUrl;
      
      // Get image dimensions
      const sharpInstance = sharp(buffer);
      const imageMeta = await sharpInstance.metadata();
      metadata.width = imageMeta.width;
      metadata.height = imageMeta.height;
    }
    
    // Get video duration if applicable
    if (category === FileCategory.VIDEO) {
      metadata.duration = 0;
    }
    
    return { url: result.secure_url, thumbnailUrl, metadata };
  }
  
  // Upload voice note (special case for voice messages)
  static async uploadVoiceNote(buffer: Buffer): Promise<string> {
    if (this.isMockCloudinary()) {
      logger.info('Running in Cloudinary Mock Mode. Saving voice note locally.');
      const fileId = uuidv4();
      const uploadsDir = path.join(__dirname, '../../public/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, `${fileId}.mp3`);
      fs.writeFileSync(filePath, buffer);
      return `/uploads/${fileId}.mp3`;
    }

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'xz-chat/voice-notes',
          format: 'mp3',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
    
    return result.secure_url;
  }
}