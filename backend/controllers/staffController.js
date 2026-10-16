const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const {
  emitUserQueueUpdate,
  emitQueueUpdate,
  emitCounterStatusChange,
  emitEntryPriorityChanged,
  emitLiveCrowdUpdate,
} = require('../socket/socketServer');
const notificationService = require('../services/notificationService');
const queueSchedulingService = require('../services/queueSchedulingService');
const qrTokenService = require('../services/qrTokenService');

/**
 * Helper to get authenticated staff's assigned counter with hierarchy check
 */
const getStaffAssignedCounter = async (staffId, counterId = null) => {
  const query = {
    assignedStaffId: staffId,
    isActive: true,
  };
  if (counterId) {
    query._id = counterId;
  }
  const counter = await Counter.findOne(query)
    .populate('organizationId', 'name slug')
    .populate('locationId', 'name address city')
    .populate('departmentId', 'name prefix avgServiceTimeMins')
    .populate('currentQueueEntryId');

  return counter;
};

/**
 * @desc    Get authenticated staff's assigned counter & queue details
 * @route   GET /api/v1/staff/my-counter
 * @access  Private/Staff
 */
const getMyCounter = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const requestedCounterId = req.query?.counterId;

    const counters = await Counter.find({
      assignedStaffId: staffId,
      isActive: true,
    })
      .populate('organizationId', 'name slug')
      .populate('locationId', 'name address city')
      .populate('departmentId', 'name prefix avgServiceTimeMins')
      .populate('currentQueueEntryId');

    if (!counters || counters.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const counter = requestedCounterId
      ? counters.find((c) => c._id.toString() === requestedCounterId) || counters[0]
      : counters[0];

    // Find all active queues belonging to this counter's department
    const queues = await Queue.find({
      departmentId: counter.departmentId._id,
      isActive: true,
    }).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: {
        counter,
        counters,
        department: counter.departmentId,
        queue: queues[0] || null,
        queues,
        currentEntry: counter.currentQueueEntryId || null,
      },
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else if (res && typeof res.status === 'function') {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

/**
 * @desc    Update staff counter operational status (AVAILABLE <-> OFFLINE)
 * @route   PATCH /api/v1/staff/my-counter/status
 * @access  Private/Staff
 */
const updateCounterStatus = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Counter status is required',
      });
    }

    const upperStatus = status.toUpperCase();

    if (upperStatus === 'BUSY') {
      return res.status(400).json({
        success: false,
        message: 'STAFF cannot manually set counter status to BUSY',
      });
    }

    if (upperStatus !== 'AVAILABLE' && upperStatus !== 'OFFLINE') {
      return res.status(400).json({
        success: false,
        message: 'Counter status must be AVAILABLE or OFFLINE',
      });
    }

    const counter = await getStaffAssignedCounter(staffId, req.body?.counterId || req.query?.counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    // Check if counter has active CALLED or SERVING customer entry
    if (counter.currentQueueEntryId) {
      const activeCurrent = await QueueEntry.findById(counter.currentQueueEntryId);
      if (activeCurrent && (activeCurrent.status === 'CALLED' || activeCurrent.status === 'SERVING')) {
        return res.status(409).json({
          success: false,
          message: `Cannot change counter status to ${upperStatus} while a customer is being served or called`,
        });
      }
    }

    // Update Counter status
    counter.status = upperStatus;
    await counter.save();

    // Emit real-time socket update
    emitCounterStatusChange(counter._id, upperStatus);

    // Recalculate positions & wait-times for department queues
    try {
      const deptQueues = await Queue.find({ departmentId: counter.departmentId._id, isActive: true });
      for (const q of deptQueues) {
        await queueSchedulingService.recalculateQueuePositions(q._id);
      }
    } catch (recalcErr) {
      console.error('[RECALC ERROR on Counter Status Change]', recalcErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Counter status updated to ${upperStatus}`,
      data: counter,
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else if (res && typeof res.status === 'function') {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

/**
 * @desc    Get waiting queue stream for staff counter's department
 * @route   GET /api/v1/staff/queues/:queueId/waiting
 * @access  Private/Staff
 */
const getWaitingQueue = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { queueId } = req.params;

    const counter = await getStaffAssignedCounter(staffId, req.query?.counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const queue = await Queue.findById(queueId);
    if (!queue || !queue.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found or inactive',
      });
    }

    // Verify queue belongs to staff member's counter department
    if (queue.departmentId.toString() !== counter.departmentId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view queues outside your assigned department',
      });
    }

    const rawWaiting = await QueueEntry.find({
      queueId,
      status: 'WAITING',
      isActive: true,
    }).select('ticketNumber sequenceNumber status priority joinedAt customerId');

    const waitingEntries = queueSchedulingService.sortQueueEntries(rawWaiting, Date.now());

    res.status(200).json({
      success: true,
      count: waitingEntries.length,
      data: waitingEntries,
    });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else if (res && typeof res.status === 'function') {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

/**
 * @desc    Call Next customer (Priority-Aware Atomic Concurrency-Safe Claim)
 * @route   POST /api/v1/staff/queues/:queueId/call-next
 * @access  Private/Staff
 */
const callNext = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { queueId } = req.params;

    const counter = await getStaffAssignedCounter(staffId, req.body?.counterId || req.query?.counterId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    if (counter.status !== 'AVAILABLE') {
      return res.status(409).json({
        success: false,
        message: `Counter is ${counter.status}. Cannot call next customer`,
      });
    }

    // Check if counter already has an active customer in CALLED or SERVING state
    if (counter.currentQueueEntryId) {
      const activeCurrent = await QueueEntry.findById(counter.currentQueueEntryId);
      if (activeCurrent && (activeCurrent.status === 'CALLED' || activeCurrent.status === 'SERVING')) {
        return res.status(409).json({
          success: false,
          message: 'Counter already has an active customer being served or called',
        });
      }
    }

    const queue = await Queue.findById(queueId);
    if (!queue || !queue.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found or inactive',
      });
    }

    if (queue.departmentId.toString() !== counter.departmentId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to call customers from queues outside your department',
      });
    }

    // Priority-aware candidate retrieval & atomic claim
    const candidates = await queueSchedulingService.getPriorityCallNextCandidates(queue._id, 50, Date.now());
    if (!candidates || candidates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No waiting customers in this queue',
      });
    }

    let entry = null;
    for (const candidate of candidates) {
      entry = await QueueEntry.findOneAndUpdate(
        {
          _id: candidate._id,
          status: 'WAITING',
          isActive: true,
        },
        {
          $set: {
            status: 'CALLED',
            calledAt: new Date(),
            calledByCounterId: counter._id,
            calledByUserId: staffId,
          },
        },
        { new: true }
      );
      if (entry) break;
    }

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'No waiting customers in this queue',
      });
    }

    // Update Counter state
    counter.status = 'AVAILABLE';
    counter.currentQueueEntryId = entry._id;
    await counter.save();

    // Emit private socket update to called customer
    emitUserQueueUpdate(entry.customerId.toString(), {
      entryId: entry._id.toString(),
      queueId: queue._id.toString(),
      status: 'CALLED',
      priority: entry.priority || 'NORMAL',
      position: 0,
      peopleAhead: 0,
      ticketNumber: entry.ticketNumber,
      counterName: counter.name,
    });

    // Deliver persistent SERVICE_CALLED notification to customer
    notificationService.notifyServiceCalled({
      userId: entry.customerId,
      queueId: queue._id,
      queueEntryId: entry._id,
      ticketNumber: entry.ticketNumber,
      counterName: counter.name,
    });

    // Priority-aware position recalculation for remaining WAITING customers
    await queueSchedulingService.recalculateQueuePositions(queue._id);

    // Emit public aggregate update to queue room
    const remainingActiveCount = await QueueEntry.countDocuments({
      queueId: queue._id,
      status: 'WAITING',
      isActive: true,
    });
    emitQueueUpdate(queue._id.toString(), {
      queueId: queue._id.toString(),
      status: queue.status,
      waitingCount: remainingActiveCount,
      maxCapacity: queue.maxCapacity,
      prefix: queue.prefix,
    });
    emitLiveCrowdUpdate(queue._id.toString());

    res.status(200).json({
      success: true,
      message: `Called ticket ${entry.ticketNumber} to ${counter.name}`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Start service for called customer (CALLED -> SERVING)
 * @route   POST /api/v1/staff/queue-entries/:entryId/start
 * @access  Private/Staff
 */
const startService = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { entryId } = req.params;

    const counter = await getStaffAssignedCounter(staffId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.status !== 'CALLED') {
      return res.status(409).json({
        success: false,
        message: `Cannot start service for entry with status ${entry.status}. Entry must be CALLED.`,
      });
    }

    if (entry.calledByCounterId.toString() !== counter._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This customer was called by another counter',
      });
    }

    // Transition state to SERVING
    entry.status = 'SERVING';
    entry.startedAt = new Date();
    await entry.save();

    // Update Counter status to BUSY
    counter.status = 'BUSY';
    counter.currentQueueEntryId = entry._id;
    await counter.save();

    emitCounterStatusChange(counter._id, 'BUSY');

    // Emit private socket update to customer
    emitUserQueueUpdate(entry.customerId.toString(), {
      entryId: entry._id.toString(),
      queueId: entry.queueId.toString(),
      status: 'SERVING',
      position: 0,
      peopleAhead: 0,
      ticketNumber: entry.ticketNumber,
      counterName: counter.name,
      startedAt: entry.startedAt,
    });

    // Deliver SERVICE_STARTED notification
    notificationService.notifyServiceStarted({
      userId: entry.customerId,
      queueId: entry.queueId,
      queueEntryId: entry._id,
      ticketNumber: entry.ticketNumber,
    });

    res.status(200).json({
      success: true,
      message: `Started service for ticket ${entry.ticketNumber}`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete service for customer (SERVING -> COMPLETED)
 * @route   POST /api/v1/staff/queue-entries/:entryId/complete
 * @access  Private/Staff
 */
const completeService = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { entryId } = req.params;

    const counter = await getStaffAssignedCounter(staffId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.status !== 'SERVING') {
      return res.status(409).json({
        success: false,
        message: `Cannot complete service for entry with status ${entry.status}. Entry must be SERVING.`,
      });
    }

    if (entry.calledByCounterId.toString() !== counter._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'This customer was called by another counter',
      });
    }

    // Transition state to COMPLETED
    entry.status = 'COMPLETED';
    entry.completedAt = new Date();
    entry.isActive = false;
    await entry.save();

    // Reset Counter to AVAILABLE
    counter.status = 'AVAILABLE';
    counter.currentQueueEntryId = null;
    await counter.save();

    emitCounterStatusChange(counter._id, 'AVAILABLE');

    // Emit private socket update to customer
    emitUserQueueUpdate(entry.customerId.toString(), {
      entryId: entry._id.toString(),
      queueId: entry.queueId.toString(),
      status: 'COMPLETED',
      position: 0,
      peopleAhead: 0,
      ticketNumber: entry.ticketNumber,
    });

    // Deliver SERVICE_COMPLETED notification
    notificationService.notifyServiceCompleted({
      userId: entry.customerId,
      queueId: entry.queueId,
      queueEntryId: entry._id,
      ticketNumber: entry.ticketNumber,
    });

    // Emit public aggregate update to queue room
    const remainingActiveCount = await QueueEntry.countDocuments({
      queueId: entry.queueId,
      status: 'WAITING',
      isActive: true,
    });
    const queueDoc = await Queue.findById(entry.queueId);
    if (queueDoc) {
      emitQueueUpdate(queueDoc._id.toString(), {
        queueId: queueDoc._id.toString(),
        status: queueDoc.status,
        waitingCount: remainingActiveCount,
        maxCapacity: queueDoc.maxCapacity,
        prefix: queueDoc.prefix,
      });
      emitLiveCrowdUpdate(queueDoc._id.toString());
    }

    res.status(200).json({
      success: true,
      message: `Completed service for ticket ${entry.ticketNumber}`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark customer as NO_SHOW (WAITING / CALLED -> NO_SHOW)
 * @route   POST /api/v1/staff/queue-entries/:entryId/no-show
 * @access  Private/Staff
 */
const noShow = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { entryId } = req.params;

    const counter = await getStaffAssignedCounter(staffId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.status === 'SERVING') {
      return res.status(409).json({
        success: false,
        message: 'Cannot mark a SERVING customer as NO_SHOW',
      });
    }

    if (entry.status === 'COMPLETED' || entry.status === 'CANCELLED' || entry.status === 'NO_SHOW') {
      return res.status(409).json({
        success: false,
        message: `Entry is already in terminal state ${entry.status}`,
      });
    }

    // Transition state to NO_SHOW
    entry.status = 'NO_SHOW';
    entry.noShowAt = new Date();
    entry.isActive = false;
    await entry.save();

    // If attached to current counter, clear counter state
    if (counter.currentQueueEntryId && counter.currentQueueEntryId.toString() === entry._id.toString()) {
      counter.status = 'AVAILABLE';
      counter.currentQueueEntryId = null;
      await counter.save();

      emitCounterStatusChange(counter._id, 'AVAILABLE');
    }

    // Emit private socket update to customer
    emitUserQueueUpdate(entry.customerId.toString(), {
      entryId: entry._id.toString(),
      queueId: entry.queueId.toString(),
      status: 'NO_SHOW',
      position: 0,
      peopleAhead: 0,
      ticketNumber: entry.ticketNumber,
    });

    // Recalculate remaining WAITING positions
    const remainingActive = await QueueEntry.find({
      queueId: entry.queueId,
      status: 'WAITING',
      isActive: true,
    }).sort({ sequenceNumber: 1 });

    for (let i = 0; i < remainingActive.length; i++) {
      const activeEntry = remainingActive[i];
      const newPos = i + 1;
      const newAhead = i;

      emitUserQueueUpdate(activeEntry.customerId.toString(), {
        entryId: activeEntry._id.toString(),
        queueId: entry.queueId.toString(),
        status: activeEntry.status,
        position: newPos,
        peopleAhead: newAhead,
        ticketNumber: activeEntry.ticketNumber,
        sequenceNumber: activeEntry.sequenceNumber,
      });

      notificationService.notifyPositionUpdated({
        userId: activeEntry.customerId,
        queueId: entry.queueId,
        queueEntryId: activeEntry._id,
        ticketNumber: activeEntry.ticketNumber,
        newPosition: newPos,
        peopleAhead: newAhead,
      });
    }

    // Emit public aggregate update to queue room
    const queueDoc = await Queue.findById(entry.queueId);
    if (queueDoc) {
      emitQueueUpdate(queueDoc._id.toString(), {
        queueId: queueDoc._id.toString(),
        status: queueDoc.status,
        waitingCount: remainingActive.length,
        maxCapacity: queueDoc.maxCapacity,
        prefix: queueDoc.prefix,
      });
      emitLiveCrowdUpdate(queueDoc._id.toString());
    }

    res.status(200).json({
      success: true,
      message: `Marked ticket ${entry.ticketNumber} as NO_SHOW`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get staff operational history (scoped to authenticated staff)
 * @route   GET /api/v1/staff/history
 * @access  Private/Staff
 */
const getStaffHistory = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const counter = await Counter.findOne({ assignedStaffId: staffId, isActive: true });

    // Scoped query filter: called by this staff user OR assigned counter
    const userFilter = counter
      ? { $or: [{ calledByUserId: staffId }, { calledByCounterId: counter._id }] }
      : { calledByUserId: staffId };

    const conditions = [userFilter];

    // Status filter
    if (req.query.status && req.query.status !== 'ALL') {
      const allowedStatuses = ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
      const queryStatus = req.query.status.toUpperCase();
      if (allowedStatuses.includes(queryStatus)) {
        conditions.push({ status: queryStatus });
      }
    }

    // Date filter handling (default today's YYYY-MM-DD unless date === 'all')
    let targetDateStr = req.query.date;
    if (!targetDateStr) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      targetDateStr = `${yyyy}-${mm}-${dd}`;
    }

    if (targetDateStr !== 'all') {
      const startDate = new Date(`${targetDateStr}T00:00:00.000Z`);
      const endDate = new Date(`${targetDateStr}T23:59:59.999Z`);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        conditions.push({
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { sequenceDate: targetDateStr },
          ],
        });
      }
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const totalRecords = await QueueEntry.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const rawEntries = await QueueEntry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('queueId', 'name prefix')
      .populate('calledByCounterId', 'name number')
      .populate('customerId', 'name email');

    const formattedEntries = rawEntries.map((entry) => {
      const obj = entry.toObject();

      let serviceDurationSeconds = null;
      if (obj.startedAt && obj.completedAt) {
        const diff = Math.round((new Date(obj.completedAt) - new Date(obj.startedAt)) / 1000);
        serviceDurationSeconds = diff >= 0 ? diff : 0;
      }

      let waitDurationSeconds = null;
      if (obj.calledAt && obj.joinedAt) {
        const diff = Math.round((new Date(obj.calledAt) - new Date(obj.joinedAt)) / 1000);
        waitDurationSeconds = diff >= 0 ? diff : 0;
      }

      return {
        id: obj._id,
        _id: obj._id,
        ticketNumber: obj.ticketNumber,
        sequenceNumber: obj.sequenceNumber,
        status: obj.status,
        joinedAt: obj.joinedAt,
        calledAt: obj.calledAt,
        startedAt: obj.startedAt,
        completedAt: obj.completedAt,
        noShowAt: obj.noShowAt,
        cancelledAt: obj.cancelledAt,
        serviceDurationSeconds,
        waitDurationSeconds,
        counterId: obj.calledByCounterId?._id || obj.calledByCounterId || null,
        counterName: obj.calledByCounterId?.name || null,
        queueId: obj.queueId?._id || obj.queueId || null,
        queueName: obj.queueId?.name || null,
        customerName: obj.customerId?.name || 'Customer',
        createdAt: obj.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedEntries.length,
      pagination: {
        page,
        limit,
        totalPages,
        totalRecords,
      },
      data: formattedEntries,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get staff daily operational summary metrics
 * @route   GET /api/v1/staff/history/summary
 * @access  Private/Staff
 */
const getStaffHistorySummary = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const counter = await Counter.findOne({ assignedStaffId: staffId, isActive: true });

    const userFilter = counter
      ? { $or: [{ calledByUserId: staffId }, { calledByCounterId: counter._id }] }
      : { calledByUserId: staffId };

    let targetDateStr = req.query.date;
    if (!targetDateStr) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      targetDateStr = `${yyyy}-${mm}-${dd}`;
    }

    const conditions = [userFilter];
    if (targetDateStr !== 'all') {
      const startDate = new Date(`${targetDateStr}T00:00:00.000Z`);
      const endDate = new Date(`${targetDateStr}T23:59:59.999Z`);
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        conditions.push({
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { sequenceDate: targetDateStr },
          ],
        });
      }
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const entries = await QueueEntry.find(filter);

    let completed = 0;
    let noShow = 0;
    let cancelled = 0;
    let totalServiceDurationSeconds = 0;
    let serviceDurationCount = 0;
    let totalWaitDurationSeconds = 0;
    let waitDurationCount = 0;

    entries.forEach((entry) => {
      if (entry.status === 'COMPLETED') completed++;
      else if (entry.status === 'NO_SHOW') noShow++;
      else if (entry.status === 'CANCELLED') cancelled++;

      if (entry.startedAt && entry.completedAt && entry.status === 'COMPLETED') {
        const dur = Math.round((new Date(entry.completedAt) - new Date(entry.startedAt)) / 1000);
        if (dur >= 0) {
          totalServiceDurationSeconds += dur;
          serviceDurationCount++;
        }
      }

      if (entry.calledAt && entry.joinedAt) {
        const wait = Math.round((new Date(entry.calledAt) - new Date(entry.joinedAt)) / 1000);
        if (wait >= 0) {
          totalWaitDurationSeconds += wait;
          waitDurationCount++;
        }
      }
    });

    const totalHandled = entries.length;
    const averageServiceDurationSeconds =
      serviceDurationCount > 0 ? Math.round(totalServiceDurationSeconds / serviceDurationCount) : 0;
    const averageWaitDurationSeconds =
      waitDurationCount > 0 ? Math.round(totalWaitDurationSeconds / waitDurationCount) : 0;

    res.status(200).json({
      success: true,
      data: {
        date: targetDateStr,
        completed,
        noShow,
        cancelled,
        totalHandled,
        averageServiceDurationSeconds,
        averageWaitDurationSeconds,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update queue entry priority (STAFF controlled)
 * @route   PATCH /api/v1/staff/queue-entries/:entryId/priority
 * @access  Private/Staff
 */
const updateQueueEntryPriority = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { entryId } = req.params;
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Priority value is required',
      });
    }

    const upperPriority = priority.toUpperCase();
    const validPriorities = ['NORMAL', 'APPOINTMENT', 'PRIORITY', 'EMERGENCY'];
    if (!validPriorities.includes(upperPriority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority ${priority}. Priority must be NORMAL, APPOINTMENT, PRIORITY, or EMERGENCY.`,
      });
    }

    const counter = await getStaffAssignedCounter(staffId);
    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'No active counter assigned to your staff account',
      });
    }

    const entry = await QueueEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Queue entry not found',
      });
    }

    if (entry.status !== 'WAITING') {
      return res.status(409).json({
        success: false,
        message: `Cannot change priority of entry with status ${entry.status}. Priority changes allowed only for WAITING entries.`,
      });
    }

    if (entry.departmentId.toString() !== counter.departmentId._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update entry priority outside your counter department',
      });
    }

    // Record audit details
    entry.previousPriority = entry.priority || 'NORMAL';
    entry.priority = upperPriority;
    entry.priorityChangedAt = new Date();
    entry.priorityChangedByUserId = staffId;
    await entry.save();

    // Broadcast queue-wide socket update
    const queueDoc = await Queue.findById(entry.queueId);
    emitEntryPriorityChanged(entry.queueId.toString(), {
      queueId: entry.queueId.toString(),
      entryId: entry._id.toString(),
      ticketNumber: entry.ticketNumber,
      priority: entry.priority,
      status: entry.status,
    });

    // Deliver QUEUE_PRIORITY_UPDATED notification
    await notificationService.notifyPriorityUpdated({
      userId: entry.customerId,
      queueId: entry.queueId,
      queueEntryId: entry._id,
      ticketNumber: entry.ticketNumber,
      priority: entry.priority,
      queueName: queueDoc?.name,
    });

    // Recalculate queue positions
    await queueSchedulingService.recalculateQueuePositions(entry.queueId);

    res.status(200).json({
      success: true,
      message: `Updated priority for ticket ${entry.ticketNumber} to ${entry.priority}`,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Check-in customer using QR token (Staff-protected)
 * @route   POST /api/v1/queues/check-in
 * @access  Private/Staff
 */
const checkInCustomerQr = async (req, res, next) => {
  try {
    const staffId = req.user.id || req.user._id;
    const { qrToken } = req.body;

    // 1. Validate request payload & format
    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'QR token is required',
        },
        message: 'QR token is required',
      });
    }

    if (!qrTokenService.validateQrTokenFormat(qrToken)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid QR token format',
        },
        message: 'Invalid QR token format',
      });
    }

    // 2. Staff authorization chain setup: Resolve staff's active counter assignment
    const counter = await getStaffAssignedCounter(staffId);
    if (!counter) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_STAFF',
          message: 'No active counter assigned to your staff account',
        },
        message: 'No active counter assigned to your staff account',
      });
    }

    // 3. Find QueueEntry by qrToken
    const entry = await qrTokenService.findEntryByQrToken(qrToken);
    if (!entry) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'QR_NOT_FOUND',
          message: 'Invalid QR token or ticket not found',
        },
        message: 'Invalid QR token or ticket not found',
      });
    }

    // 4. Verify Queue exists and is active
    const queue = await Queue.findById(entry.queueId);
    if (!queue || !queue.isActive) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'QUEUE_INACTIVE',
          message: 'Associated queue is no longer active',
        },
        message: 'Associated queue is no longer active',
      });
    }

    // 5. Staff authorization check: Counter department/location/org match entry
    const staffDeptId = counter.departmentId._id ? counter.departmentId._id.toString() : counter.departmentId.toString();
    const staffLocId = counter.locationId._id ? counter.locationId._id.toString() : counter.locationId.toString();
    const staffOrgId = counter.organizationId._id ? counter.organizationId._id.toString() : counter.organizationId.toString();

    const entryDeptId = entry.departmentId.toString();
    const entryLocId = entry.locationId.toString();
    const entryOrgId = entry.organizationId.toString();

    if (staffDeptId !== entryDeptId || staffLocId !== entryLocId || staffOrgId !== entryOrgId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized for this queue',
        },
        message: 'You are not authorized for this queue',
      });
    }

    // 6. QueueEntry eligibility check
    if (!entry.isActive || ['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(entry.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QR_NOT_ACTIVE',
          message: 'This QR ticket is no longer active.',
        },
        message: 'This QR ticket is no longer active.',
      });
    }

    // 7. Duplicate check-in protection
    if (entry.checkedInAt != null) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_CHECKED_IN',
          message: 'Customer is already checked in.',
        },
        message: 'Customer is already checked in.',
        data: {
          ticketNumber: entry.ticketNumber,
          status: entry.status,
          checkedInAt: entry.checkedInAt,
        },
      });
    }

    // 8. Atomic check-in mutation
    const checkedInTime = new Date();
    const updatedEntry = await QueueEntry.findOneAndUpdate(
      {
        _id: entry._id,
        checkedInAt: null,
        status: { $in: ['WAITING', 'CALLED', 'SERVING'] },
        isActive: true,
      },
      {
        $set: {
          checkedInAt: checkedInTime,
        },
      },
      { new: true }
    );

    if (!updatedEntry) {
      const currentDoc = await QueueEntry.findById(entry._id);
      if (currentDoc && currentDoc.checkedInAt) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_CHECKED_IN',
            message: 'Customer is already checked in.',
          },
          message: 'Customer is already checked in.',
          data: {
            ticketNumber: currentDoc.ticketNumber,
            status: currentDoc.status,
            checkedInAt: currentDoc.checkedInAt,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'QR_NOT_ACTIVE',
          message: 'This QR ticket is no longer active.',
        },
        message: 'This QR ticket is no longer active.',
      });
    }

    // 9. Real-Time Socket.IO notification to customer private room
    emitUserQueueUpdate(updatedEntry.customerId.toString(), {
      checkedIn: true,
      checkedInAt: updatedEntry.checkedInAt,
      ticketNumber: updatedEntry.ticketNumber,
      status: updatedEntry.status,
      entryId: updatedEntry._id.toString(),
      queueId: updatedEntry.queueId.toString(),
    });

    // 10. Return structured response
    return res.status(200).json({
      success: true,
      message: 'Customer checked in successfully',
      data: {
        ticketNumber: updatedEntry.ticketNumber,
        status: updatedEntry.status,
        checkedInAt: updatedEntry.checkedInAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyCounter,
  updateCounterStatus,
  getWaitingQueue,
  callNext,
  startService,
  completeService,
  noShow,
  getStaffHistory,
  getStaffHistorySummary,
  updateQueueEntryPriority,
  checkInCustomerQr,
};


