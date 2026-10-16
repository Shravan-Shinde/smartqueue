const connectDB = require('./config/db');
const { connectRedis, shutdownRedis } = require('./config/redis');
const { initNotificationWorker, closeNotificationWorker } = require('./workers/notificationWorker');
const { closeNotificationQueue } = require('./jobs/notificationJobs');
require('dotenv').config();

const startWorkerProcess = async () => {
  console.log('[WORKER SERVICE] Starting SmartQueue BullMQ Background Worker Service...');
  
  // 1. Connect MongoDB (Source of Truth)
  await connectDB();

  // 2. Connect Redis & Initialize BullMQ Notification Worker
  try {
    const redisClient = await connectRedis();
    if (redisClient) {
      initNotificationWorker();
      console.log('[WORKER SERVICE] BullMQ Notification Worker successfully initialized and listening for jobs.');
    } else {
      console.warn('[WORKER SERVICE WARN] Redis connection offline. Worker operational in fallback standby mode.');
    }
  } catch (err) {
    console.error('[WORKER SERVICE FATAL ERROR] Failed to initialize worker connection:', err.message);
    process.exit(1);
  }
};

// Graceful Shutdown Signal Hooks
const handleShutdown = async (signal) => {
  console.log(`[WORKER SHUTDOWN] ${signal} signal received. Closing worker, queue, and Redis connections...`);
  try {
    await closeNotificationWorker();
    await closeNotificationQueue();
    await shutdownRedis();
    console.log('[WORKER SHUTDOWN] All connections closed cleanly. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('[WORKER SHUTDOWN ERROR]', err.message);
    process.exit(1);
  }
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startWorkerProcess().catch((err) => {
  console.error('[WORKER UNCAUGHT ERROR]', err);
  process.exit(1);
});
