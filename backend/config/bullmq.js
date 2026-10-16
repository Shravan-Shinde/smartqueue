/**
 * SmartQueue Centralized BullMQ Connection & Options Configuration
 */

const getBullMQConnectionOptions = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.replace('/', ''), 10) || 0 : 0,
      maxRetriesPerRequest: null, // Required by BullMQ for Redis connections
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    };
  } catch (err) {
    console.warn('[BULLMQ CONFIG WARN] Error parsing REDIS_URL, using default 127.0.0.1:6379:', err.message);
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 1000);
      },
    };
  }
};

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s, 2s, 4s backoff
  },
  removeOnComplete: {
    age: 3600, // Retain completed jobs for 1 hour
    count: 500, // Bounded retention limit
  },
  removeOnFail: {
    age: 86400, // Retain failed jobs for 24 hours for inspection
    count: 1000, // Bounded retention limit
  },
};

module.exports = {
  getBullMQConnectionOptions,
  defaultJobOptions,
};
