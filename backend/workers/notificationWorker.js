const { Worker } = require('bullmq');
const { getBullMQConnectionOptions } = require('../config/bullmq');
const { NOTIFICATION_QUEUE_NAME } = require('../jobs/notificationJobs');
const Notification = require('../models/Notification');
const { getIO } = require('../socket/socketServer');

/**
 * SmartQueue Background Notification Worker
 * Processes background notification jobs with idempotency and Socket.IO private room emission.
 */
let notificationWorker = null;

// Safe metrics tracking
const workerMetrics = {
  processed: 0,
  failed: 0,
  skipped: 0,
};

/**
 * Process a single notification job with idempotency and Socket.IO emission
 * @param {Object} job BullMQ Job instance
 */
const processNotificationJob = async (job) => {
  const { userId, type, title, message, queueId, queueEntryId, metadata } = job.data;

  if (!userId || !type || !message) {
    throw new Error(`[BULLMQ WORKER ERROR] Job ${job.id} missing required fields (userId, type, message).`);
  }

  // 1. Idempotency Check: Prevent duplicate notification documents on retries
  if (queueEntryId) {
    const existing = await Notification.findOne({
      userId,
      type,
      queueEntryId,
    });

    if (existing) {
      workerMetrics.skipped++;
      console.log(`[BULLMQ WORKER IDEMPOTENCY] Notification record already exists for user ${userId}, entry ${queueEntryId}, type ${type}. Skipping duplicate creation.`);
      
      // Ensure Socket.IO emission occurs even if DB record already existed
      emitSocketNotification(userId, existing);
      return { status: 'skipped_duplicate', notificationId: existing._id.toString() };
    }
  }

  // 2. Persist Notification Document to MongoDB (Source of Truth)
  const notification = await Notification.create({
    userId,
    type,
    title: title || 'Queue Update',
    message,
    queueId: queueId || null,
    queueEntryId: queueEntryId || null,
    metadata: metadata || {},
    isRead: false,
  });

  workerMetrics.processed++;
  console.log(`[BULLMQ WORKER SUCCESS] Processed job ${job.id} -> Created notification ${notification._id} for user ${userId}`);

  // 3. Real-time Socket.IO emission to private user:{userId} room
  emitSocketNotification(userId, notification);

  return { status: 'created', notificationId: notification._id.toString() };
};

/**
 * Emit Socket.IO notification event to targeted private room
 */
const emitSocketNotification = (userId, notification) => {
  try {
    let io;
    try {
      io = getIO();
    } catch {
      // Socket.IO server is intentionally not initialized in standalone worker process
      return;
    }
    if (io && userId) {
      const payload = {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        queueId: notification.queueId ? notification.queueId.toString() : null,
        queueEntryId: notification.queueEntryId ? notification.queueEntryId.toString() : null,
        metadata: notification.metadata || {},
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      };

      io.to(`user:${userId.toString()}`).emit('notificationCreated', payload);
      console.log(`[SOCKET SOCKET] Delivered notificationCreated event to private room user:${userId}`);
    }
  } catch (socketErr) {
    console.warn(`[SOCKET EMIT WARN] Failed to deliver notificationCreated to user:${userId}: ${socketErr.message}`);
  }
};

/**
 * Initialize BullMQ Notification Worker Process
 * @param {Object} [overrideConnection] Optional Redis connection override for testing
 */
const initNotificationWorker = (overrideConnection = null) => {
  if (notificationWorker) {
    return notificationWorker;
  }

  const connection = overrideConnection || getBullMQConnectionOptions();

  notificationWorker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      return await processNotificationJob(job);
    },
    {
      connection,
      concurrency: 5, // Bounded worker concurrency
    }
  );

  notificationWorker.on('completed', (job, result) => {
    console.log(`[BULLMQ WORKER COMPLETED] Job ${job.id} completed with status: ${result?.status}`);
  });

  notificationWorker.on('failed', (job, err) => {
    workerMetrics.failed++;
    const attempt = job ? job.attemptsMade : 0;
    const maxAttempts = job && job.opts ? job.opts.attempts : 3;
    console.warn(`[BULLMQ WORKER FAILED] Job ${job?.id} failed on attempt ${attempt}/${maxAttempts}: ${err.message}`);
  });

  notificationWorker.on('error', (err) => {
    console.warn(`[BULLMQ WORKER SYSTEM ERROR] ${err.message}`);
  });

  console.log('[BULLMQ WORKER] Notification worker initialized with concurrency: 5');
  return notificationWorker;
};

/**
 * Get active worker instance
 */
const getNotificationWorker = () => {
  return notificationWorker;
};

/**
 * Get safe worker status string
 */
const getWorkerStatus = () => {
  if (!notificationWorker) return 'unavailable';
  if (notificationWorker.isRunning()) return 'running';
  return 'paused';
};

/**
 * Get worker metrics snapshot
 */
const getWorkerMetrics = () => {
  return { ...workerMetrics };
};

/**
 * Reset worker metrics
 */
const resetWorkerMetrics = () => {
  workerMetrics.processed = 0;
  workerMetrics.failed = 0;
  workerMetrics.skipped = 0;
};

/**
 * Graceful Worker Shutdown
 */
const closeNotificationWorker = async () => {
  if (notificationWorker) {
    try {
      await notificationWorker.close();
      console.log('[BULLMQ WORKER] Notification worker closed cleanly');
    } catch (err) {
      console.warn('[BULLMQ WORKER WARN] Error closing notification worker:', err.message);
    } finally {
      notificationWorker = null;
    }
  }
};

module.exports = {
  initNotificationWorker,
  getNotificationWorker,
  getWorkerStatus,
  getWorkerMetrics,
  resetWorkerMetrics,
  closeNotificationWorker,
  processNotificationJob,
};
