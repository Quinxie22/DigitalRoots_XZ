import multer from 'multer';
import { Request } from 'express';

// Configure multer for memory storage (files handled in memory)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: any, file: any, cb: any) => {
  // Accept all files - validation happens in service
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10, // Max 10 files per request
  },
});

// Specific upload configurations
export const uploadSingleImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
});

export const uploadMultiple = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 10 },
});