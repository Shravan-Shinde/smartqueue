const { Queue } = require('bullmq');
const { getBullMQConnectionOptions, defaultJobOptions } = require('../config/bullmq');

const NOTIFICATION_QUEUE_NAME = 'smartqueue-notifications';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'qrToken', 'secret', 'jwt'];

/**
 * Validate job payload security (reject credentials and secret tokens)
 */
const auditPayloadSecurity = (payload) => {
  if (!payload) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const field of SENSITIVE_FIELDS) {
    if (str.includes(`"${field}"`)) {
      throw new Error(`[BULLMQ PAYLOAD SECURITY VIOLATION] Job payload contains sensitive field: ${field}`);
    }
  }
};

let notificationQueue = null;

/**
 * Get or initialize BullMQ Notification Queue Producer
 * @param {Object} [overrideConnection] Optional Redis connection override for testing
 */
const getNotificationQueue = (overrideConnection = null) => {
  if (!notificationQueue) {
    const connection = overrideConnection || getBullMQConnectionOptions();
    notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection,
      defaultJobOptions,
    });
  }
  return notificationQueue;
};

/**
 * Enqueue a notification background job
 * @param {Object} jobData Job payload: { userId, type, title, message, queueId, queueEntryId, metadata }
 * @param {Object} [options] Custom BullMQ job options
 * @returns {Promise<Object|null>} Enqueued job instance or null if offline
 */
const enqueueNotification = async (jobData, options = {}) => {
  try {
    if (!jobData || !jobData.userId || !jobData.type || !jobData.message) {
      throw new Error('Invalid notification job payload: userId, type, and message are required.');
    }

    // Security audit payload
    auditPayloadSecurity(jobData);

    const queue = getNotificationQueue(options.connection);

    // Create deterministic job ID for idempotency if queueEntryId or entity ID is present
    let jobId = options.jobId;
    if (!jobId) {
      const entityId = jobData.queueEntryId || jobData.queueId || 'global';
      jobId = `notif_${jobData.userId}_${entityId}_${jobData.type}`;
    }

    const mergedOptions = {
      ...defaultJobOptions,
      ...options,
      jobId,
    };

    const job = await queue.add(jobData.type, jobData, mergedOptions);
    console.log(`[BULLMQ PRODUCER] Enqueued notification job ${job.id} (type: ${jobData.type}) for user ${jobData.userId}`);
    return job;
  } catch (err) {
    if (err.message && err.message.includes('[BULLMQ PAYLOAD SECURITY VIOLATION]')) {
      throw err;
    }
    console.warn(`[BULLMQ PRODUCER WARN] Failed to enqueue notification job: ${err.message}`);
    return null;
  }
};

/**
 * Close BullMQ Notification Queue connection
 */
const closeNotificationQueue = async () => {
  if (notificationQueue) {
    try {
      await notificationQueue.close();
    } catch (err) {
      console.warn('[BULLMQ PRODUCER WARN] Error closing notification queue:', err.message);
    } finally {
      notificationQueue = null;
    }
  }
};

module.exports = {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  closeNotificationQueue,
};
