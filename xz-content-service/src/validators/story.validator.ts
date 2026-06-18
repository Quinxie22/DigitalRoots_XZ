import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
import { CulturalCategory } from '../models/content.types';

const cleanText = (text: string): string => {
  if (!text) return '';
  return sanitizeHtml(text.trim(), {
    allowedTags: [],
    allowedAttributes: {},
  });
};

export const validateStoryUpload = (req: Request, res: Response, next: NextFunction): void => {
  const { title, description, culturalCategory, language, tags } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Title is required' });
    return;
  }

  if (title.length > 200) {
    res.status(400).json({ success: false, error: 'Title must be under 200 characters' });
    return;
  }

  if (description && (typeof description !== 'string' || description.length > 500)) {
    res.status(400).json({ success: false, error: 'Description must be under 500 characters' });
    return;
  }

  if (!culturalCategory || !Object.values(CulturalCategory).includes(culturalCategory)) {
    res.status(400).json({ success: false, error: `Cultural category must be one of: ${Object.values(CulturalCategory).join(', ')}` });
    return;
  }

  // Sanitize
  req.body.title = cleanText(title);
  if (description) req.body.description = cleanText(description);
  req.body.language = language ? cleanText(language) : 'en';

  if (tags) {
    if (Array.isArray(tags)) {
      req.body.tags = tags.map((t: any) => cleanText(String(t)));
    } else if (typeof tags === 'string') {
      req.body.tags = tags.split(',').map((t: string) => cleanText(t.trim())).filter(Boolean);
    }
  }

  next();
};
