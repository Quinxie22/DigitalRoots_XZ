import Redis from 'ioredis';
import logger from '../utils/logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: Max reconnection attempts reached. Giving up.');
      return null; // stop retrying
    }
    const delay = Math.min(times * 500, 5000);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

export default redis;