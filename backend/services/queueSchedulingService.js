const QueueEntry = require('../models/QueueEntry');

/**
 * Base Priority Scores mapping
 */
const BASE_PRIORITY_SCORES = {
  NORMAL: 10,
  APPOINTMENT: 20,
  PRIORITY: 30,
  EMERGENCY: 40,
};

/**
 * Get base priority score for a priority string (defaults to NORMAL = 10)
 */
const getBasePriorityScore = (priorityStr) => {
  const p = (priorityStr || 'NORMAL').toUpperCase();
  return BASE_PRIORITY_SCORES[p] ?? BASE_PRIORITY_SCORES.NORMAL;
};

/**
 * Calculate aging bonus: waitingMinutes * 0.5, capped at 30
 * waitingMinutes = (referenceTime - joinedAt) / 60000
 */
const calculateAgingBonus = (joinedAt, referenceTime = Date.now()) => {
  if (!joinedAt) return 0;
  const joinedMs = new Date(joinedAt).getTime();
  const refMs = new Date(referenceTime).getTime();
  const waitingMs = Math.max(0, refMs - joinedMs);
  const waitingMinutes = waitingMs / 60000;
  return Math.min(waitingMinutes * 0.5, 30);
};

/**
 * Calculate effective priority score: basePriorityScore + agingBonus
 */
const calculateEffectiveScore = (entry, referenceTime = Date.now()) => {
  const baseScore = getBasePriorityScore(entry.priority);
  const bonus = calculateAgingBonus(entry.joinedAt, referenceTime);
  return baseScore + bonus;
};

/**
 * Deterministic comparison function for sorting candidates
 * Priority order:
 * 1. effectiveScore DESC
 * 2. joinedAt ASC
 * 3. sequenceNumber ASC
 */
const compareCandidates = (entryA, entryB, referenceTime = Date.now()) => {
  const scoreA = calculateEffectiveScore(entryA, referenceTime);
  const scoreB = calculateEffectiveScore(entryB, referenceTime);

  if (scoreB !== scoreA) {
    return scoreB - scoreA; // Higher score first
  }

  const timeA = new Date(entryA.joinedAt || 0).getTime();
  const timeB = new Date(entryB.joinedAt || 0).getTime();

  if (timeA !== timeB) {
    return timeA - timeB; // Earlier timestamp first
  }

  return (entryA.sequenceNumber || 0) - (entryB.sequenceNumber || 0); // Lower sequence number first
};

/**
 * Sort a list of WAITING entries using deterministic priority scheduling rules
 */
const sortQueueEntries = (entries, referenceTime = Date.now()) => {
  const list = [...entries];
  list.sort((a, b) => compareCandidates(a, b, referenceTime));
  return list;
};

/**
 * Recalculate positions for all WAITING entries in a queue and emit socket updates & notifications
 */
const recalculateQueuePositions = async (queueId, referenceTime = Date.now()) => {
  const { emitUserQueueUpdate } = require('../socket/socketServer');
  const notificationService = require('./notificationService');
  const Queue = require('../models/Queue');

  const queue = await Queue.findById(queueId).lean();

  // Fetch all active WAITING entries for queue
  const waitingEntries = await QueueEntry.find({
    queueId,
    status: 'WAITING',
    isActive: true,
  }).lean();

  // Sort entries using deterministic priority scheduler
  const sortedEntries = sortQueueEntries(waitingEntries, referenceTime);

  const waitTimeService = require('./waitTimeService');

  for (let i = 0; i < sortedEntries.length; i++) {
    const activeEntry = sortedEntries[i];
    const newPos = i + 1;
    const newAhead = i;

    const waitTime = await waitTimeService.calculateWaitTimeForEntry(activeEntry, queue);

    emitUserQueueUpdate(activeEntry.customerId.toString(), {
      entryId: activeEntry._id.toString(),
      queueId: queueId.toString(),
      status: activeEntry.status,
      priority: activeEntry.priority || 'NORMAL',
      position: newPos,
      peopleAhead: newAhead,
      ticketNumber: activeEntry.ticketNumber,
      sequenceNumber: activeEntry.sequenceNumber,
      waitTime,
    });

    notificationService.notifyPositionUpdated({
      userId: activeEntry.customerId,
      queueId,
      queueEntryId: activeEntry._id,
      ticketNumber: activeEntry.ticketNumber,
      newPosition: newPos,
      peopleAhead: newAhead,
      queueName: queue?.name,
    });
  }

  return sortedEntries;
};

/**
 * Select bounded candidate batch for Call Next & return sorted list
 */
const getPriorityCallNextCandidates = async (queueId, candidateLimit = 50, referenceTime = Date.now()) => {
  // Query oldest/relevant candidate batch
  const waitingBatch = await QueueEntry.find({
    queueId,
    status: 'WAITING',
    isActive: true,
  })
    .sort({ joinedAt: 1, sequenceNumber: 1 })
    .limit(candidateLimit)
    .lean();

  // Sort candidate batch by effectiveScore DESC, joinedAt ASC, sequenceNumber ASC
  return sortQueueEntries(waitingBatch, referenceTime);
};

module.exports = {
  BASE_PRIORITY_SCORES,
  getBasePriorityScore,
  calculateAgingBonus,
  calculateEffectiveScore,
  compareCandidates,
  sortQueueEntries,
  recalculateQueuePositions,
  getPriorityCallNextCandidates,
};
