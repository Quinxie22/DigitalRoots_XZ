import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

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
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Access denied. Missing identity headers from gateway.' 
    });
    return;
  }

  try {
    const { User } = require('../models/user.model');
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      res.status(401).json({ error: 'Unauthorized', message: 'User profile not found' });
      return;
    }

    if (userDoc.status === 'Suspended' || userDoc.status === 'Banned') {
      res.status(403).json({ error: 'Forbidden', message: `Your account is ${userDoc.status}. Please contact an administrator.` });
      return;
    }

    req.user = {
      id: userId,
      email: userEmail || userDoc.email,
      role: userRole || userDoc.role,
      name: userName || userDoc.name,
    };
    next();
  } catch (error) {
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Failed to verify user profile' 
    });
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
