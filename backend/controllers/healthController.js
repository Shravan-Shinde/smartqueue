const { getRedisStatus } = require('../config/redis');
const { getWorkerStatus } = require('../workers/notificationWorker');

/**
 * GET /api/v1/health
 * Returns API health status without exposing secrets.
 */
const getHealthStatus = (req, res) => {
  const redisState = getRedisStatus();
  const workerState = getWorkerStatus();

  res.status(200).json({
    success: true,
    message: 'SmartQueue API is running',
    environment: process.env.NODE_ENV || 'development',
    redis: {
      status: redisState === 'CONNECTED' ? 'connected' : 'unavailable',
    },
    bullmq: {
      notificationWorker: workerState,
    },
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  getHealthStatus,
};
