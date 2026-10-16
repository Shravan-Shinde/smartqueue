const { createClient } = require('redis');

/**
 * SmartQueue Centralized Redis Connection & Lifecycle Management
 */
let redisClient = null;
let connectionStatus = 'OFFLINE'; // 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'

const getRedisUrl = () => {
  return process.env.REDIS_URL || 'redis://localhost:6379';
};

/**
 * Initialize Redis connection asynchronously
 * @param {string} [customUrl] Optional URL override for testing/test environments
 */
const connectRedis = async (customUrl = null) => {
  if (redisClient && connectionStatus === 'CONNECTED') {
    return redisClient;
  }

  const url = customUrl || getRedisUrl();

  try {
    redisClient = createClient({
      url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.warn('[REDIS CONFIG] Max reconnect retries reached. Operating in OFFLINE fallback mode.');
            connectionStatus = 'OFFLINE';
            return new Error('Redis max reconnect retries reached');
          }
          connectionStatus = 'RECONNECTING';
          return Math.min(retries * 200, 3000);
        },
        connectTimeout: 5000,
      },
    });

    redisClient.on('connect', () => {
      connectionStatus = 'CONNECTED';
      console.log('[REDIS SUCCESS] Redis client connected');
    });

    redisClient.on('ready', () => {
      connectionStatus = 'CONNECTED';
    });

    redisClient.on('error', (err) => {
      console.warn('[REDIS WARNING] Connection error:', err.message);
      connectionStatus = redisClient?.isOpen ? 'CONNECTED' : 'OFFLINE';
    });

    redisClient.on('reconnecting', () => {
      connectionStatus = 'RECONNECTING';
    });

    redisClient.on('end', () => {
      connectionStatus = 'OFFLINE';
    });

    connectionStatus = 'RECONNECTING';
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.warn('[REDIS WARNING] Connection initialization failed. Operating in OFFLINE fallback mode:', err.message);
    connectionStatus = 'OFFLINE';
    return null;
  }
};

/**
 * Get active Redis client instance
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Get current safe Redis status string
 */
const getRedisStatus = () => {
  if (!redisClient) return 'OFFLINE';
  if (redisClient.isOpen && connectionStatus === 'CONNECTED') {
    return 'CONNECTED';
  }
  return connectionStatus;
};

/**
 * Graceful Redis Client Shutdown
 */
const shutdownRedis = async () => {
  if (redisClient) {
    try {
      if (redisClient.isOpen) {
        await redisClient.quit();
      }
    } catch (err) {
      console.warn('[REDIS WARNING] Error during graceful shutdown:', err.message);
    } finally {
      redisClient = null;
      connectionStatus = 'OFFLINE';
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  getRedisStatus,
  shutdownRedis,
};
