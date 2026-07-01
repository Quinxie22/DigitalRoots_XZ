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
    return true;
  }

  static getFileCategory(mimetype: string): FileCategory | null {
    if (mimetype.startsWith('image/')) return FileCategory.IMAGE;
    if (mimetype.startsWith('video/')) return FileCategory.VIDEO;
    if (mimetype.startsWith('audio/')) return FileCategory.AUDIO;
    return null;
  }
  
  static async uploadFile(buffer: any, originalname: string, fileCategory: any, folder: string): Promise<any> {
    return {
      url: 'http://localhost/mock-url.jpg',
      thumbnailUrl: 'http://localhost/mock-thumb.jpg',
      metadata: { publicId: 'mock-id', secureUrl: 'http://localhost/mock-url.jpg' }
    };
  }
}
