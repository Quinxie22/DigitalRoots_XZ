import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    firebase_uid: string;
    email: string;
    role?: string;
    name?: string;
  };
}

const getJWTSecret = () => process.env.JWT_SECRET || 'xz_jwt_secret_shared_2026_key';

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const userEmail = req.headers['x-user-email'] as string;
  const userName = req.headers['x-user-name'] as string;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing gateway authentication headers' });
    return;
  }

  req.user = {
    firebase_uid: userId,
    email: userEmail || '',
    role: userRole || 'Youth',
    name: userName || '',
  };
  next();
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || '')) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};