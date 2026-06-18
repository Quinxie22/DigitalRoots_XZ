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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = jwt.verify(token, getJWTSecret()) as any;
    req.user = {
      firebase_uid: decodedToken.id,
      email: decodedToken.email || '',
      role: decodedToken.role || 'Youth',
      name: decodedToken.name || '',
    };
    next();
  } catch (error: any) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
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