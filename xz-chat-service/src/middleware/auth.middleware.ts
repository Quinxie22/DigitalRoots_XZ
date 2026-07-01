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

// Middleware to read identity headers from the API Gateway (or verify JWT locally as a fallback)
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