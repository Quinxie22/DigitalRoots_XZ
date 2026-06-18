import redis from '../config/redis';
import logger from '../utils/logger';

export class CacheService {
  /**
   * Cache-aside utility to get cached values or fetch and cache them
   */
  static async getOrSet<T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      logger.error(`Redis get error for key ${key}:`, err);
    }

    logger.debug(`Cache miss for key: ${key}. Fetching data...`);
    const data = await fetchFn();

    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      logger.error(`Redis setex error for key ${key}:`, err);
    }

    return data;
  }

  /**
   * Invalidate all keys matching a specific pattern (e.g., feed:*)
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated cache keys matching pattern: ${pattern}`);
      }
    } catch (err) {
      logger.error(`Redis keys/del error for pattern ${pattern}:`, err);
    }
  }

  /**
   * Direct cache set
   */
  static async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.error(`Redis set error for key ${key}:`, err);
    }
  }

  /**
   * Direct cache delete
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      logger.error(`Redis del error for key ${key}:`, err);
    }
  }
}
