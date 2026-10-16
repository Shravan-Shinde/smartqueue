const Counter = require('../models/Counter');
const QueueEntry = require('../models/QueueEntry');
const Queue = require('../models/Queue');
const Department = require('../models/Department');
const queueSchedulingService = require('./queueSchedulingService');

/**
 * Get count of active operational counters for a department
 * Counter is active when isActive = true and status IN ['AVAILABLE', 'BUSY']
 */
const getActiveCountersCount = async (departmentId) => {
  if (!departmentId) return 0;
  return Counter.countDocuments({
    departmentId,
    isActive: true,
    status: { $in: ['AVAILABLE', 'BUSY'] },
  });
};

/**
 * Calculate historical average service time in minutes based on recent completed entries
 * Uses latest 50-100 completed records for the queue.
 * Clamps durations between 1 min and 60 mins.
 * Falls back to queue.avgServiceTimeMins -> department.avgServiceTimeMins -> 5 if sample < 3.
 */
const getAverageServiceTimeMinutes = async (queueId, queueAvgFallback, deptAvgFallback) => {
  const completedEntries = await QueueEntry.find({
    queueId,
    status: 'COMPLETED',
    startedAt: { $ne: null },
    completedAt: { $ne: null },
  })
    .sort({ completedAt: -1 })
    .limit(100)
    .select('startedAt completedAt')
    .lean();

  const validDurations = [];
  for (const entry of completedEntries) {
    const startMs = new Date(entry.startedAt).getTime();
    const endMs = new Date(entry.completedAt).getTime();
    if (!isNaN(startMs) && !isNaN(endMs) && endMs >= startMs) {
      const durationMins = (endMs - startMs) / 60000;
      // Clamp outlier values between 1 minute and 60 minutes
      const clamped = Math.max(1, Math.min(durationMins, 60));
      validDurations.push(clamped);
    }
  }

  if (validDurations.length >= 3) {
    const sum = validDurations.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / validDurations.length;
    return {
      averageServiceTimeMinutes: Math.round(avg * 10) / 10,
      sampleCount: validDurations.length,
      isFallback: false,
    };
  }

  const fallback = queueAvgFallback || deptAvgFallback || 5;
  return {
    averageServiceTimeMinutes: fallback,
    sampleCount: validDurations.length,
    isFallback: true,
  };
};

/**
 * Calculate wait-time estimation for a given queue entry and queue document
 */
const calculateWaitTimeForEntry = async (entry, queueDoc) => {
  if (!queueDoc) {
    queueDoc = await Queue.findById(entry.queueId).lean();
  }

  if (!queueDoc) {
    return {
      queueId: entry.queueId?.toString(),
      entryId: entry._id?.toString(),
      status: entry.status,
      position: 0,
      peopleAhead: 0,
      activeCounters: 0,
      averageServiceTimeMinutes: 5,
      estimatedWaitMinutes: null,
      estimatedWaitRange: null,
      formattedWaitTime: 'Wait time unavailable',
      estimateQuality: 'LOW',
      state: 'NO_ACTIVE_COUNTERS',
    };
  }

  // Queue state checks
  if (queueDoc.status === 'PAUSED') {
    return {
      queueId: queueDoc._id.toString(),
      entryId: entry._id.toString(),
      status: entry.status,
      position: 0,
      peopleAhead: 0,
      activeCounters: 0,
      averageServiceTimeMinutes: queueDoc.avgServiceTimeMins || 5,
      estimatedWaitMinutes: null,
      estimatedWaitRange: null,
      formattedWaitTime: 'Queue paused',
      estimateQuality: 'LOW',
      state: 'QUEUE_PAUSED',
    };
  }

  if (queueDoc.status === 'CLOSED') {
    return {
      queueId: queueDoc._id.toString(),
      entryId: entry._id.toString(),
      status: entry.status,
      position: 0,
      peopleAhead: 0,
      activeCounters: 0,
      averageServiceTimeMinutes: queueDoc.avgServiceTimeMins || 5,
      estimatedWaitMinutes: null,
      estimatedWaitRange: null,
      formattedWaitTime: 'Queue closed',
      estimateQuality: 'LOW',
      state: 'QUEUE_CLOSED',
    };
  }

  // Check if entry status is WAITING
  if (entry.status !== 'WAITING' || !entry.isActive) {
    let formattedText = 'Status unavailable';
    if (entry.status === 'CALLED') formattedText = 'Your turn — proceed to counter';
    else if (entry.status === 'SERVING') formattedText = 'Service in progress';
    else if (entry.status === 'COMPLETED') formattedText = 'Service completed';
    else if (entry.status === 'NO_SHOW') formattedText = 'Marked as no-show';
    else if (entry.status === 'CANCELLED') formattedText = 'Queue entry cancelled';

    return {
      queueId: queueDoc._id.toString(),
      entryId: entry._id.toString(),
      status: entry.status,
      position: 0,
      peopleAhead: 0,
      activeCounters: 0,
      averageServiceTimeMinutes: queueDoc.avgServiceTimeMins || 5,
      estimatedWaitMinutes: null,
      estimatedWaitRange: null,
      formattedWaitTime: formattedText,
      estimateQuality: 'LOW',
      state: 'NOT_WAITING',
    };
  }

  // Check active counters count
  const activeCounters = await getActiveCountersCount(queueDoc.departmentId);
  if (activeCounters === 0) {
    return {
      queueId: queueDoc._id.toString(),
      entryId: entry._id.toString(),
      status: entry.status,
      position: 0,
      peopleAhead: 0,
      activeCounters: 0,
      averageServiceTimeMinutes: queueDoc.avgServiceTimeMins || 5,
      estimatedWaitMinutes: null,
      estimatedWaitRange: null,
      formattedWaitTime: 'Wait time unavailable',
      estimateQuality: 'LOW',
      state: 'NO_ACTIVE_COUNTERS',
    };
  }

  // Fetch department fallback if necessary
  let deptAvgFallback = 5;
  if (!queueDoc.avgServiceTimeMins) {
    const dept = await Department.findById(queueDoc.departmentId).select('avgServiceTimeMins').lean();
    if (dept && dept.avgServiceTimeMins) {
      deptAvgFallback = dept.avgServiceTimeMins;
    }
  }

  // Calculate average service time
  const { averageServiceTimeMinutes, sampleCount, isFallback } =
    await getAverageServiceTimeMinutes(queueDoc._id, queueDoc.avgServiceTimeMins, deptAvgFallback);

  // Calculate priority-aware position and people ahead
  const allWaiting = await QueueEntry.find({
    queueId: queueDoc._id,
    status: 'WAITING',
    isActive: true,
  })
    .select('priority joinedAt sequenceNumber _id')
    .lean();

  const sortedWaiting = queueSchedulingService.sortQueueEntries(allWaiting, Date.now());
  const myIndex = sortedWaiting.findIndex((e) => e._id.toString() === entry._id.toString());

  const position = myIndex >= 0 ? myIndex + 1 : 1;
  const peopleAhead = myIndex >= 0 ? myIndex : 0;

  // Base estimate formula: (peopleAhead * averageServiceTimeMinutes) / activeCounters
  const rawMinutes = (peopleAhead * averageServiceTimeMinutes) / activeCounters;
  const estimatedWaitMinutes = Math.round(rawMinutes);

  // Range calculation
  let min = 0;
  let max = 0;
  let formattedWaitTime = '';

  if (peopleAhead === 0 || rawMinutes < 1) {
    min = 0;
    max = 1;
    formattedWaitTime = 'Under 1 min';
  } else {
    min = Math.max(1, Math.floor(rawMinutes * 0.9));
    max = Math.max(min + 1, Math.ceil(rawMinutes * 1.2));
    formattedWaitTime = `~${min}–${max} min`;
  }

  // Estimate Quality
  let estimateQuality = 'LOW';
  if (!isFallback && sampleCount >= 10 && activeCounters >= 1) {
    estimateQuality = 'HIGH';
  } else if (!isFallback && sampleCount >= 3 && activeCounters >= 1) {
    estimateQuality = 'MEDIUM';
  } else if (activeCounters >= 1) {
    estimateQuality = 'LOW'; // Fallback used
  }

  return {
    queueId: queueDoc._id.toString(),
    entryId: entry._id.toString(),
    status: entry.status,
    position,
    peopleAhead,
    activeCounters,
    averageServiceTimeMinutes,
    estimatedWaitMinutes,
    estimatedWaitRange: { min, max },
    formattedWaitTime,
    estimateQuality,
    state: 'ESTIMATED',
  };
};

/**
 * Convenience helper to calculate wait-time by entry ID directly
 */
const calculateWaitTimeByEntryId = async (entryId) => {
  const entry = await QueueEntry.findById(entryId).lean();
  if (!entry) return null;
  const queueDoc = await Queue.findById(entry.queueId).lean();
  return calculateWaitTimeForEntry(entry, queueDoc);
};

module.exports = {
  getActiveCountersCount,
  getAverageServiceTimeMinutes,
  calculateWaitTimeForEntry,
  calculateWaitTimeByEntryId,
};
