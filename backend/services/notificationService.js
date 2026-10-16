const Notification = require('../models/Notification');
const { getIO } = require('../socket/socketServer');
const { enqueueNotification } = require('../jobs/notificationJobs');

/**
 * SmartQueue Notification Service
 * Enqueues asynchronous notification jobs to BullMQ while maintaining direct fallback persistence.
 */
const notificationService = {
  /**
   * Enqueue or directly deliver a single notification
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    queueId = null,
    queueEntryId = null,
    metadata = {},
  }) {
    try {
      if (!userId) {
        console.warn('[NOTIFICATION SERVICE] Warning: Missing userId');
        return null;
      }

      const jobData = {
        userId,
        type,
        title,
        message,
        queueId: queueId || null,
        queueEntryId: queueEntryId || null,
        metadata: metadata || {},
      };

      // 1. Enqueue job into BullMQ
      const job = await enqueueNotification(jobData);

      // 2. If BullMQ enqueue succeeded, return representation
      if (job) {
        return { enqueued: true, jobId: job.id };
      }

      // 3. Fallback: Direct MongoDB Persistence & Socket Emission if BullMQ is offline
      console.warn('[NOTIFICATION SERVICE FALLBACK] BullMQ offline/unavailable. Performing direct DB persistence.');
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        queueId: queueId || null,
        queueEntryId: queueEntryId || null,
        metadata: metadata || {},
        isRead: false,
      });

      try {
        const io = getIO();
        if (io) {
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
        }
      } catch (socketErr) {
        console.error('[NOTIFICATION SOCKET ERROR]', socketErr.message);
      }

      return notification;
    } catch (error) {
      console.error('[NOTIFICATION DB ERROR]', error.message);
      return null;
    }
  },

  /**
   * Convenience helper: Queue Joined notification
   */
  async notifyQueueJoined({ userId, queueId, queueEntryId, ticketNumber, queueName }) {
    return this.createNotification({
      userId,
      type: 'QUEUE_JOINED',
      title: 'Queue Joined',
      message: `You joined the ${queueName || 'queue'} with ticket token ${ticketNumber}.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber, queueName },
    });
  },

  /**
   * Convenience helper: Queue Cancelled notification
   */
  async notifyQueueCancelled({ userId, queueId, queueEntryId, ticketNumber, queueName }) {
    return this.createNotification({
      userId,
      type: 'QUEUE_CANCELLED',
      title: 'Queue Cancelled',
      message: `Your queue entry ${ticketNumber} in ${queueName || 'the queue'} has been cancelled.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber, queueName },
    });
  },

  /**
   * Convenience helper: Position Updated notification
   */
  async notifyPositionUpdated({ userId, queueId, queueEntryId, ticketNumber, newPosition, peopleAhead, queueName }) {
    return this.createNotification({
      userId,
      type: 'QUEUE_POSITION_UPDATED',
      title: 'Queue Position Updated',
      message: `You are now #${newPosition} in ${queueName || 'the queue'}. ${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber, newPosition, peopleAhead, queueName },
    });
  },

  /**
   * Convenience helper: Queue Status Changed notification
   */
  async notifyQueueStatusChanged({ userId, queueId, queueName, status }) {
    let message = `Queue ${queueName || ''} status updated to ${status}.`;
    if (status === 'PAUSED') message = `Queue ${queueName || 'service'} has been temporarily paused.`;
    if (status === 'CLOSED') message = `Queue ${queueName || 'service'} is currently closed.`;
    if (status === 'OPEN') message = `Queue ${queueName || 'service'} has reopened.`;

    return this.createNotification({
      userId,
      type: 'QUEUE_STATUS_CHANGED',
      title: 'Queue Status Updated',
      message,
      queueId,
      metadata: { status, queueName },
    });
  },

  /**
   * Convenience helper: Service Called notification
   */
  async notifyServiceCalled({ userId, queueId, queueEntryId, ticketNumber, counterName }) {
    return this.createNotification({
      userId,
      type: 'SERVICE_CALLED',
      title: 'Your Turn',
      message: `Your token ${ticketNumber} has been called. Please proceed to ${counterName || 'the assigned counter'}.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber, counterName },
    });
  },

  /**
   * Convenience helper: Service Started notification
   */
  async notifyServiceStarted({ userId, queueId, queueEntryId, ticketNumber }) {
    return this.createNotification({
      userId,
      type: 'SERVICE_STARTED',
      title: 'Service Started',
      message: `Service has started for ticket ${ticketNumber}.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber },
    });
  },

  /**
   * Convenience helper: Service Completed notification
   */
  async notifyServiceCompleted({ userId, queueId, queueEntryId, ticketNumber }) {
    return this.createNotification({
      userId,
      type: 'SERVICE_COMPLETED',
      title: 'Service Completed',
      message: `Your service for ticket ${ticketNumber} has been completed. Thank you!`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber },
    });
  },

  /**
   * Convenience helper: Priority Updated notification
   */
  async notifyPriorityUpdated({ userId, queueId, queueEntryId, ticketNumber, priority, queueName }) {
    return this.createNotification({
      userId,
      type: 'QUEUE_PRIORITY_UPDATED',
      title: 'Priority Updated',
      message: `Your queue priority for ticket ${ticketNumber} was updated to ${priority}.`,
      queueId,
      queueEntryId,
      metadata: { ticketNumber, priority, queueName },
    });
  },
};

module.exports = notificationService;
