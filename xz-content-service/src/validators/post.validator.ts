import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
import { ContentCategory } from '../models/content.types';

const cleanText = (text: string): string => {
  if (!text) return '';
  return sanitizeHtml(text.trim(), {
    allowedTags: [], // Strip all HTML tags for standard text posts/comments
    allowedAttributes: {},
  });
};

export const validatePostCreate = (req: Request, res: Response, next: NextFunction): void => {
  const { title, content, category, tags } = req.body;

  // For media posts, content can be optional, but for standard posts it might be required.
  // We'll validate content if provided, or handle it in the controller if file is uploaded.
  if (req.method === 'POST' && !req.file && (!content || typeof content !== 'string' || content.trim().length === 0)) {
    res.status(400).json({ success: false, error: 'Content is required for text posts' });
    return;
  }

  if (title && (typeof title !== 'string' || title.length > 200)) {
    res.status(400).json({ success: false, error: 'Title must be a string and under 200 characters' });
    return;
  }

  if (category && !Object.values(ContentCategory).includes(category)) {
    res.status(400).json({ success: false, error: `Category must be one of: ${Object.values(ContentCategory).join(', ')}` });
    return;
  }

  if (tags && !Array.isArray(tags) && typeof tags !== 'string') {
    res.status(400).json({ success: false, error: 'Tags must be an array or a comma-separated string' });
    return;
  }

  // Sanitize
  if (content) req.body.content = cleanText(content);
  if (title) req.body.title = cleanText(title);
  if (tags) {
    if (Array.isArray(tags)) {
      req.body.tags = tags.map((t: any) => cleanText(String(t)));
    } else if (typeof tags === 'string') {
      req.body.tags = tags.split(',').map((t: string) => cleanText(t.trim())).filter(Boolean);
    }
  }

  next();
};

export const validateCommentCreate = (req: Request, res: Response, next: NextFunction): void => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Comment text is required and must be a string' });
    return;
  }

  req.body.text = cleanText(text);
  next();
};
