import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';
import { ContentCategory } from '../models/content.types';

const cleanPlainText = (text: string): string => {
  if (!text) return '';
  return sanitizeHtml(text.trim(), {
    allowedTags: [],
    allowedAttributes: {},
  });
};

const cleanRichText = (text: string): string => {
  if (!text) return '';
  return sanitizeHtml(text.trim(), {
    allowedTags: [
      'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
      'h5', 'h6', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
      'hr', 'li', 'main', 'ol', 'p', 'pre', 'ul', 'a', 'abbr', 'b', 'bdi', 'bdo',
      'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 'rb',
      'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub',
      'sup', 'time', 'u', 'var', 'wbr', 'img'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  });
};

export const validateArticleCreate = (req: Request, res: Response, next: NextFunction): void => {
  const { title, content, summary, category, tags, language } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Title is required' });
    return;
  }

  if (title.length > 200) {
    res.status(400).json({ success: false, error: 'Title must be under 200 characters' });
    return;
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Content is required' });
    return;
  }

  if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Summary is required' });
    return;
  }

  if (summary.length > 500) {
    res.status(400).json({ success: false, error: 'Summary must be under 500 characters' });
    return;
  }

  if (category && !Object.values(ContentCategory).includes(category)) {
    res.status(400).json({ success: false, error: `Category must be one of: ${Object.values(ContentCategory).join(', ')}` });
    return;
  }

  // Sanitize
  req.body.title = cleanPlainText(title);
  req.body.summary = cleanPlainText(summary);
  req.body.content = cleanRichText(content);
  req.body.language = language ? cleanPlainText(language) : 'en';

  if (tags) {
    if (Array.isArray(tags)) {
      req.body.tags = tags.map((t: any) => cleanPlainText(String(t)));
    } else if (typeof tags === 'string') {
      req.body.tags = tags.split(',').map((t: string) => cleanPlainText(t.trim())).filter(Boolean);
    }
  }

  next();
};
