import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../config/firebase';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    firebase_uid: string;
    email: string;
    role?: string;
  };
}

// Middleware to verify Firebase token from Authorization header
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'No token provided or invalid format. Use: Bearer <firebase_token>' 
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await verifyFirebaseToken(token);
    
    req.user = {
      firebase_uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: decodedToken.role || 'Youth',
    };
    
    next();
  } catch (error: any) {
    logger.error(`Token verification failed: ${error.message}`);
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid or expired token' 
    });
  }
};

// Optional: Role-based middleware
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role || '')) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

// WebSocket authentication middleware
export const verifySocketToken = async (socket: any, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decodedToken = await verifyFirebaseToken(token);
    socket.user = {
      firebase_uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: decodedToken.role || 'Youth',
    };
    next();
  } catch (error: any) {
    next(new Error(`Authentication error: ${error.message}`));
  }
};