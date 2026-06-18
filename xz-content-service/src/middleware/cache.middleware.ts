import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import redis from '../config/redis';
import logger from '../utils/logger';
import { CacheService } from '../services/cache.service';

export const cacheMiddleware = (ttlSeconds: number, prefix: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET' || req.query.isPublished === 'false' || req.user?.role === 'Admin') {
      next();
      return;
    }

    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.status(200).json(JSON.parse(cachedData));
        return;
      }
    } catch (error) {
      logger.error('Redis cache retrieval error:', error);
    }

    logger.debug(`Cache miss for key: ${cacheKey}`);
    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json;
    res.json = function (body: any): Response {
      res.json = originalJson;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          redis.setex(cacheKey, ttlSeconds, JSON.stringify(body));
        } catch (error) {
          logger.error('Redis cache store error:', error);
        }
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

export const clearCachePattern = CacheService.invalidatePattern;
