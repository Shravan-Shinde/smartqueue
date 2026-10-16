const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');

const { emitUserQueueUpdate, emitQueueUpdate, emitLiveCrowdUpdate } = require('../socket/socketServer');
const notificationService = require('../services/notificationService');
const queueSchedulingService = require('../services/queueSchedulingService');
const waitTimeService = require('../services/waitTimeService');
const qrTokenService = require('../services/qrTokenService');
const cacheService = require('../services/cacheService');

/**
 * Helper to generate padded sequential ticket numbers per department per date
 */
const generateTicketNumber = async (prefix, sequenceDate) => {
  const latestEntry = await QueueEntry.findOne({
    sequenceDate,
    ticketNumber: { $regex: new RegExp(`^${prefix}-`) },
  }).sort({ sequenceNumber: -1 });

  const nextSequence = latestEntry ? latestEntry.sequenceNumber + 1 : 1;
  const paddedNumber = String(nextSequence).padStart(3, '0');
  const ticketNumber = `${prefix}-${paddedNumber}`;

  return { ticketNumber, sequenceNumber: nextSequence };
};

/**
 * @desc    Customer Join Queue (Creates QueueEntry)
 * @route   POST /api/v1/queues/:queueId/entries
 * @access  Private/Customer
 */
const customerJoinQueue = async (req, res, next) => {
  try {
    const customerId = req.user.id || req.user._id;
    const { queueId } = req.params;

    // 1. Verify Queue exists and is OPEN & active
    const queue = await Queue.findById(queueId);
    if (!queue || !queue.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found or inactive',
      });
    }

    if (queue.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: `Queue is currently ${queue.status}. New entries are not allowed.`,
      });
    }

    // 2. Check Queue Capacity
    const activeCount = await QueueEntry.countDocuments({
      queueId: queue._id,
      status: 'WAITING',
      isActive: true,
    });

    if (activeCount >= queue.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: `Queue has reached maximum capacity of ${queue.maxCapacity} customers`,
      });
    }

    // 3. Verify Customer does not already have an active entry in this queue
    const existingActive = await QueueEntry.findOne({
      queueId: queue._id,
      customerId,
      isActive: true,
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: `You are already in this queue with ticket ${existingActive.ticketNumber}`,
      });
    }

    // 4. Fetch Department, Location, Organization hierarchy info
    const department = await Department.findById(queue.departmentId);
    if (!department || !department.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Associated department is inactive or not found',
      });
    }

    // 5. Sequence Date string (YYYY-MM-DD in UTC)
    const todayStr = new Date().toISOString().split('T')[0];

    // 6. Concurrency-Safe Daily Atomic Token Sequence Generation
    let updatedQueue = await Queue.findOneAndUpdate(
      { _id: queue._id, lastSequenceDate: todayStr },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true }
    );

    if (!updatedQueue) {
      updatedQueue = await Queue.findOneAndUpdate(
        { _id: queue._id },
        { $set: { lastSequenceDate: todayStr, lastSequenceNumber: 1 } },
        { new: true }
      );
    }

    const sequenceNumber = updatedQueue.lastSequenceNumber;
    const prefix = updatedQueue.prefix || department.prefix || 'GEN';
    const ticketNumber = `${prefix}-${String(sequenceNumber).padStart(3, '0')}`;

    // 7. Create QueueEntry document (Default priority is NORMAL, customer cannot self-elevate)
    const entry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: queue.organizationId,
      locationId: queue.locationId,
      departmentId: queue.departmentId,
      customerId,
      ticketNumber,
      sequenceNumber,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      isActive: true,
    });

    // 8. Calculate Position & People Ahead using Priority Scheduler
    const allWaiting = await QueueEntry.find({
      queueId: queue._id,
      status: 'WAITING',
      isActive: true,
    });
    const sortedWaiting = queueSchedulingService.sortQueueEntries(allWaiting, Date.now());
    const myIndex = sortedWaiting.findIndex((e) => e._id.toString() === entry._id.toString());
    const position = myIndex >= 0 ? myIndex + 1 : 1;
    const peopleAhead = myIndex >= 0 ? myIndex : 0;

    // Calculate wait-time
    const waitTime = await waitTimeService.calculateWaitTimeForEntry(entry, queue);

    // Emit real-time Socket.IO events after DB persistence succeeds
    try {
      const waitingCount = activeCount + 1;

      // Emit private update to joining customer's room
      emitUserQueueUpdate(customerId.toString(), {
        entryId: entry._id.toString(),
        queueId: queue._id.toString(),
        status: entry.status,
        priority: entry.priority || 'NORMAL',
        position,
        peopleAhead,
        ticketNumber: entry.ticketNumber,
        sequenceNumber: entry.sequenceNumber,
        waitTime,
      });

      // Emit public aggregate update to queue room (NO PII)
      emitQueueUpdate(queue._id.toString(), {
        queueId: queue._id.toString(),
        status: queue.status,
        waitingCount,
        maxCapacity: queue.maxCapacity,
        prefix: queue.prefix,
      });

      // Emit Admin Live Crowd update
      emitLiveCrowdUpdate(queue._id.toString());

      // Create QUEUE_JOINED persistent notification
      notificationService.notifyQueueJoined({
        userId: customerId,
        queueId: queue._id,
        queueEntryId: entry._id,
        ticketNumber: entry.ticketNumber,
        queueName: queue.name,
      });
    } catch (socketErr) {
      console.error('[SOCKET EMIT ERROR on Join]', socketErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Joined queue successfully',
      data: {
        entry: {
          id: entry._id,
          ticketNumber: entry.ticketNumber,
          sequenceNumber: entry.sequenceNumber,
          status: entry.status,
          priority: entry.priority || 'NORMAL',
          joinedAt: entry.joinedAt,
          queueId: entry.queueId,
          queueName: queue.name,
          departmentName: department.name,
        },
        position,
        peopleAhead,
        waitTime,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already in this queue',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get customer's current active queue entry
 * @route   GET /api/v1/queues/my-active-entry
 * @access  Private/Customer
 */
const customerGetActiveEntry = async (req, res, next) => {
  try {
    const customerId = req.user.id || req.user._id;

    const entry = await QueueEntry.findOne({
      customerId,
      isActive: true,
    })
      .populate('queueId', 'name prefix status avgServiceTimeMins maxCapacity description departmentId')
      .populate('organizationId', 'name slug category logo')
      .populate('locationId', 'name address city')
      .populate('departmentId', 'name prefix avgServiceTimeMins')
      .lean();

    if (!entry) {
      return res.status(200).json({
        success: true,
        data: null,
      });
    }

    // Calculate position & people ahead using priority scheduler
    let position = 1;
    let peopleAhead = 0;

    const targetQueueId = entry.queueId?._id || entry.queueId;

    if (entry.status === 'WAITING' && targetQueueId) {
      const allWaiting = await QueueEntry.find({
        queueId: targetQueueId,
        status: 'WAITING',
        isActive: true,
      })
        .select('priority joinedAt sequenceNumber _id')
        .lean();

      const sortedWaiting = queueSchedulingService.sortQueueEntries(allWaiting, Date.now());
      const myIndex = sortedWaiting.findIndex((e) => e._id.toString() === entry._id.toString());
      if (myIndex >= 0) {
        position = myIndex + 1;
        peopleAhead = myIndex;
      }
    }

    const waitTime = await waitTimeService.calculateWaitTimeForEntry(entry, entry.queueId);

    res.status(200).json({
      success: true,
      data: {
        entry,
        position,
        peopleAhead,
        waitTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single queue entry details (Customer ownership verified)
 * @route   GET /api/v1/queue-entries/:entryId
 * @access  Private/Customer
 */
const customerGetEntryById = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const customerId = req.user.id || req.user._id;

    const entry = await QueueEntry.findById(entryId)
      .populate('queueId', 'name prefix status avgServiceTimeMins maxCapacity description')
      .populate('organizationId', 'name slug category logo')
      .populate('locationId', 'name address city')
      .populate('departmentId', 'name prefix avgServiceTimeMins')
      .lean();

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.customerId.toString() !== customerId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    let position = 1;
    let peopleAhead = 0;

    const targetQueueId = entry.queueId?._id || entry.queueId;

    if (entry.isActive && entry.status === 'WAITING' && targetQueueId) {
      const allWaiting = await QueueEntry.find({
        queueId: targetQueueId,
        status: 'WAITING',
        isActive: true,
      })
        .select('priority joinedAt sequenceNumber _id')
        .lean();

      const sortedWaiting = queueSchedulingService.sortQueueEntries(allWaiting, Date.now());
      const myIndex = sortedWaiting.findIndex((e) => e._id.toString() === entry._id.toString());
      if (myIndex >= 0) {
        position = myIndex + 1;
        peopleAhead = myIndex;
      }
    }

    const waitTime = await waitTimeService.calculateWaitTimeForEntry(entry, entry.queueId);

    res.status(200).json({
      success: true,
      data: {
        entry,
        position,
        peopleAhead,
        waitTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get estimated wait-time details for customer's queue entry
 * @route   GET /api/v1/queue-entries/:entryId/wait-time
 * @access  Private/Customer
 */
const customerGetEntryWaitTime = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const customerId = req.user.id || req.user._id;

    const entry = await QueueEntry.findById(entryId).lean();
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.customerId.toString() !== customerId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    const queueDoc = await Queue.findById(entry.queueId).lean();
    const waitTime = await waitTimeService.calculateWaitTimeForEntry(entry, queueDoc);

    res.status(200).json({
      success: true,
      data: waitTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Customer Cancel Queue Entry (Soft-Delete: isActive = false)
 * @route   PATCH /api/v1/queue-entries/:entryId/cancel
 * @access  Private/Customer
 */
const cancelQueueEntry = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const customerId = req.user.id || req.user._id;

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    // Security: Only entry owner can cancel (Return 404 for IDOR prevention)
    if (entry.customerId.toString() !== customerId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (!entry.isActive || entry.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Queue entry is already inactive or cancelled',
      });
    }

    if (entry.status !== 'WAITING') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel entry with status ${entry.status}. Only WAITING entries can be cancelled.`,
      });
    }

    // Transition state
    entry.status = 'CANCELLED';
    entry.isActive = false;
    entry.cancelledAt = new Date();
    await entry.save();

    // Emit real-time socket events after cancellation persistence succeeds
    try {
      const qIdStr = entry.queueId.toString();

      // 1. Emit cancellation update to cancelling customer's private room
      emitUserQueueUpdate(customerId.toString(), {
        entryId: entry._id.toString(),
        queueId: qIdStr,
        status: 'CANCELLED',
        position: 0,
        peopleAhead: 0,
        ticketNumber: entry.ticketNumber,
      });

      notificationService.notifyQueueCancelled({
        userId: customerId,
        queueId: entry.queueId,
        queueEntryId: entry._id,
        ticketNumber: entry.ticketNumber,
      });

      // 2. Priority-aware position recalculation for remaining active WAITING entries
      await queueSchedulingService.recalculateQueuePositions(entry.queueId);

      // 3. Emit updated public aggregate count to queue room
      const remainingActiveCount = await QueueEntry.countDocuments({
        queueId: entry.queueId,
        status: 'WAITING',
        isActive: true,
      });
      const queueDoc = await Queue.findById(entry.queueId).lean();
      if (queueDoc) {
        emitQueueUpdate(qIdStr, {
          queueId: qIdStr,
          status: queueDoc.status,
          waitingCount: remainingActiveCount,
          maxCapacity: queueDoc.maxCapacity,
          prefix: queueDoc.prefix,
        });
        emitLiveCrowdUpdate(qIdStr);
      }
    } catch (socketErr) {
      console.error('[SOCKET EMIT ERROR on Cancel]', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Queue entry cancelled successfully',
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Get active public queues for a department (Customer Discovery)
 * @route   GET /api/v1/departments/:departmentId/queues
 * @access  Public / Customer
 */
const getPublicQueuesForDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    const cacheKey = `smartqueue:department-queues:${departmentId}:all`;
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const department = await Department.findById(departmentId).select('isActive').lean();
        if (!department || !department.isActive) {
          return null;
        }

        const queues = await Queue.find({
          departmentId,
          isActive: true,
        })
          .sort({ createdAt: -1 })
          .lean();

        return { count: queues.length, queues };
      },
      60
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Department not found or inactive',
      });
    }

    res.status(200).json({
      success: true,
      count: result.count,
      data: result.queues,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single public queue details
 * @route   GET /api/v1/queues/:queueId
 * @access  Public / Customer
 */
const getPublicQueueById = async (req, res, next) => {
  try {
    const { queueId } = req.params;

    const cacheKey = `smartqueue:queue:${queueId}`;
    const queue = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await Queue.findOne({
          _id: queueId,
          isActive: true,
        })
          .populate('departmentId', 'name prefix avgServiceTimeMins')
          .lean();
      },
      60
    );

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found or inactive',
      });
    }

    res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get secure QR token payload for customer's queue entry
 * @route   GET /api/v1/queue-entries/:entryId/qr
 * @access  Private/Customer
 */
const customerGetEntryQrToken = async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const customerId = req.user.id || req.user._id;

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    // Ownership Authorization Check
    if (entry.customerId.toString() !== customerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access the QR token for this queue entry',
      });
    }

    const qrResult = await qrTokenService.getOrCreateQrToken(entry);

    if (!qrResult.eligible) {
      return res.status(400).json({
        success: false,
        message: qrResult.error || 'QR code is unavailable for this queue entry',
        data: {
          status: entry.status,
          eligible: false,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        entryId: entry._id.toString(),
        ticketNumber: entry.ticketNumber,
        qrToken: qrResult.qrToken,
        status: entry.status,
        createdAt: qrResult.createdAt,
        expiresAt: null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  customerJoinQueue,
  customerGetActiveEntry,
  customerGetEntryById,
  customerGetEntryWaitTime,
  customerGetEntryQrToken,
  cancelQueueEntry,
  customerCancelEntry: cancelQueueEntry,
  getPublicQueuesForDepartment,
  getPublicQueueById,
};

