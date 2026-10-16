const mongoose = require('mongoose');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const Counter = require('../models/Counter');

/**
 * Classify waiting queue length into crowd level
 * Thresholds: LOW (0-10), MEDIUM (11-30), HIGH (31-60), VERY HIGH (61+)
 */
const getCrowdLevel = (waitingCount) => {
  const count = Number(waitingCount) || 0;
  if (count <= 10) return 'LOW';
  if (count <= 30) return 'MEDIUM';
  if (count <= 60) return 'HIGH';
  return 'VERY HIGH';
};

/**
 * Compute live operational metrics for queues matching hierarchy filter
 */
const getLiveQueueMetrics = async ({ queueId, organizationId, locationId, departmentId }) => {
  const query = {};
  if (organizationId) query.organizationId = organizationId;
  if (locationId) query.locationId = locationId;
  if (departmentId) query.departmentId = departmentId;
  if (queueId) query._id = queueId;

  const queues = await Queue.find(query)
    .select('name prefix maxCapacity status departmentId organizationId locationId')
    .populate('departmentId', 'name')
    .lean();

  if (!queues.length) return [];

  const queueIds = queues.map((q) => q._id);
  const departmentIds = [
    ...new Set(queues.map((q) => (q.departmentId?._id || q.departmentId)?.toString()).filter(Boolean)),
  ];

  // Batch aggregate QueueEntry active counts (WAITING, SERVING)
  const entryCounts = await QueueEntry.aggregate([
    {
      $match: {
        queueId: { $in: queueIds },
        isActive: true,
        status: { $in: ['WAITING', 'SERVING'] },
      },
    },
    {
      $group: {
        _id: { queueId: '$queueId', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Build entry counts map: key `${queueId}_${status}` => count
  const entryMap = new Map();
  for (const item of entryCounts) {
    entryMap.set(`${item._id.queueId.toString()}_${item._id.status}`, item.count);
  }

  // Batch aggregate Counter counts per department
  const counterCounts = await Counter.aggregate([
    {
      $match: {
        departmentId: { $in: departmentIds.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    {
      $group: {
        _id: '$departmentId',
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$isActive', true] },
                  { $in: ['$status', ['AVAILABLE', 'BUSY']] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  // Build counter counts map: deptId string => { total, active }
  const counterMap = new Map();
  for (const item of counterCounts) {
    counterMap.set(item._id.toString(), { total: item.total, active: item.active });
  }

  return queues.map((q) => {
    const qIdStr = q._id.toString();
    const deptIdStr = (q.departmentId?._id || q.departmentId)?.toString() || '';

    const waiting = entryMap.get(`${qIdStr}_WAITING`) || 0;
    const serving = entryMap.get(`${qIdStr}_SERVING`) || 0;

    const counterStats = counterMap.get(deptIdStr) || { total: 0, active: 0 };
    const activeCounters = counterStats.active;
    const totalCounters = counterStats.total;

    const maxCap = Number(q.maxCapacity) || 0;
    const capacityPercentage = maxCap > 0 ? Number(((waiting / maxCap) * 100).toFixed(1)) : 0;

    return {
      queueId: qIdStr,
      queueName: q.name,
      prefix: q.prefix || 'Q',
      organizationId: q.organizationId?.toString() || '',
      locationId: q.locationId?.toString() || '',
      departmentId: deptIdStr,
      departmentName: q.departmentId?.name || '',
      status: q.status || 'OPEN',
      waiting,
      serving,
      crowdLevel: getCrowdLevel(waiting),
      activeCounters,
      totalCounters,
      maxCapacity: maxCap,
      capacityPercentage,
    };
  });
};

/**
 * Generate full Admin Live Crowd REST Snapshot payload
 */
const getLiveCrowdSnapshot = async (filterParams = {}) => {
  const queues = await getLiveQueueMetrics(filterParams);

  let totalWaiting = 0;
  let totalServing = 0;
  let openQueues = 0;
  let pausedQueues = 0;
  let closedQueues = 0;
  let highCrowdQueues = 0;
  let veryHighCrowdQueues = 0;

  queues.forEach((q) => {
    totalWaiting += q.waiting;
    totalServing += q.serving;

    if (q.status === 'OPEN') openQueues++;
    if (q.status === 'PAUSED') pausedQueues++;
    if (q.status === 'CLOSED') closedQueues++;

    if (q.crowdLevel === 'HIGH') highCrowdQueues++;
    if (q.crowdLevel === 'VERY HIGH') veryHighCrowdQueues++;
  });

  return {
    queues,
    summary: {
      totalWaiting,
      totalServing,
      openQueues,
      pausedQueues,
      closedQueues,
      highCrowdQueues,
      veryHighCrowdQueues,
      totalQueues: queues.length,
    },
  };
};

module.exports = {
  getCrowdLevel,
  getLiveQueueMetrics,
  getLiveCrowdSnapshot,
};
