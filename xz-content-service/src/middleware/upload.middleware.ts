import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { FileService, FileCategory } from '../services/file.service';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB absolute limit
  },
});

export const handleSingleUpload = (fieldName: string) => {
  const multerUpload = upload.single(fieldName);
  
  return (req: Request, res: Response, next: NextFunction): void => {
    multerUpload(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ success: false, error: 'File size exceeds the limit of 100MB' });
            return;
          }
          res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
          return;
        }
        res.status(500).json({ success: false, error: err.message });
        return;
      }

      const file = req.file;
      if (file) {
        const category = FileService.getFileCategory(file.mimetype);
        if (!category) {
          res.status(400).json({ success: false, error: 'Unsupported file type' });
          return;
        }

        let maxSize = 0;
        if (category === FileCategory.IMAGE) {
          maxSize = FileService.MAX_SIZES.image; // 10MB
        } else if (category === FileCategory.VIDEO) {
          maxSize = FileService.MAX_SIZES.video; // 100MB
        } else if (category === FileCategory.AUDIO) {
          maxSize = FileService.MAX_SIZES.audio; // 25MB
        }

        if (file.size > maxSize) {
          const sizeMB = maxSize / (1024 * 1024);
          res.status(400).json({ success: false, error: `File size exceeds the limit of ${sizeMB}MB for ${category} uploads` });
          return;
        }
      }

      next();
    });
  };
};

export const requireAudioUpload = (fieldName: string) => {
  const multerUpload = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    multerUpload(req, res, (err: any) => {
      if (err) {
        res.status(400).json({ success: false, error: err.message });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'Audio file is required' });
        return;
      }

      const category = FileService.getFileCategory(file.mimetype);
      if (category !== FileCategory.AUDIO) {
        res.status(400).json({ success: false, error: 'Only audio files are allowed' });
        return;
      }

      const maxAudioSize = FileService.MAX_SIZES.audio; // 25MB
      if (file.size > maxAudioSize) {
        res.status(400).json({ success: false, error: 'Audio file size exceeds the limit of 25MB' });
        return;
      }

      next();
    });
  };
};
