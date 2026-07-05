import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

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
  let userId = req.headers['x-user-id'] as string;
  let userRole = req.headers['x-user-role'] as string;
  let userEmail = req.headers['x-user-email'] as string;
  let userName = req.headers['x-user-name'] as string;

  // Fallback to local JWT verification (useful for local integration tests)
  if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, getJWTSecret()) as any;
      userId = decoded.id || decoded.firebase_uid || '';
      userRole = decoded.role || '';
      userEmail = decoded.email || '';
      userName = decoded.name || '';
    } catch (err) {
      // Ignore verification errors here, they will fail on !userId check below
    }
  }

  if (!userId) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Access denied. Missing identity headers from gateway or invalid token.' 
    });
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
