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

// Middleware to verify JWT from Authorization header
export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'No token provided or invalid format. Use: Bearer <jwt_token>' 
    });
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
    const decodedToken = jwt.verify(token, getJWTSecret()) as any;
    socket.user = {
      firebase_uid: decodedToken.id,
      email: decodedToken.email || '',
      role: decodedToken.role || 'Youth',
      name: decodedToken.name || '',
    };
    next();
  } catch (error: any) {
    next(new Error(`Authentication error: ${error.message}`));
  }
};