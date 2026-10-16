const mongoose = require('mongoose');
const QueueEntry = require('../models/QueueEntry');
const Queue = require('../models/Queue');
const Counter = require('../models/Counter');
const Department = require('../models/Department');
const Location = require('../models/Location');
const Organization = require('../models/Organization');

/**
 * Validate and parse date range query parameters into UTC Date objects.
 * Defaults to last 30 days if unspecified.
 */
const parseDateRange = (startDateStr, endDateStr, fromStr, toStr) => {
  const startInput = startDateStr || fromStr;
  const endInput = endDateStr || toStr;

  let startDate;
  let endDate;

  if (startInput) {
    startDate = new Date(startInput);
    if (isNaN(startDate.getTime())) {
      return { valid: false, error: 'Invalid startDate format' };
    }
  } else {
    // Default start: 30 days ago at 00:00:00.000Z
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setUTCHours(0, 0, 0, 0);
  }

  if (endInput) {
    endDate = new Date(endInput);
    if (isNaN(endDate.getTime())) {
      return { valid: false, error: 'Invalid endDate format' };
    }
    // If YYYY-MM-DD input without time, set to end of day
    if (typeof endInput === 'string' && endInput.length === 10) {
      endDate.setUTCHours(23, 59, 59, 999);
    }
  } else {
    // Default end: now at 23:59:59.999Z
    endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999);
  }

  if (startDate.getTime() > endDate.getTime()) {
    return { valid: false, error: 'startDate cannot be after endDate' };
  }

  return {
    valid: true,
    startDate,
    endDate,
    from: startDate.toISOString(),
    to: endDate.toISOString(),
  };
};

/**
 * Validate organizational hierarchy relationships to prevent mismatched combinations.
 */
const validateHierarchy = async ({ organizationId, locationId, departmentId, queueId }) => {
  if (locationId) {
    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return { valid: false, error: 'Invalid location ID format' };
    }
    const location = await Location.findById(locationId).lean();
    if (!location) {
      return { valid: false, error: 'Location not found' };
    }
    if (organizationId && location.organizationId.toString() !== organizationId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Location does not belong to specified Organization',
      };
    }
  }

  if (departmentId) {
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return { valid: false, error: 'Invalid department ID format' };
    }
    const dept = await Department.findById(departmentId).lean();
    if (!dept) {
      return { valid: false, error: 'Department not found' };
    }
    if (locationId && dept.locationId.toString() !== locationId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Department does not belong to specified Location',
      };
    }
    if (organizationId && dept.organizationId.toString() !== organizationId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Department does not belong to specified Organization',
      };
    }
  }

  if (queueId) {
    if (!mongoose.Types.ObjectId.isValid(queueId)) {
      return { valid: false, error: 'Invalid queue ID format' };
    }
    const queue = await Queue.findById(queueId).lean();
    if (!queue) {
      return { valid: false, error: 'Queue not found' };
    }
    if (departmentId && queue.departmentId.toString() !== departmentId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Queue does not belong to specified Department',
      };
    }
    if (locationId && queue.locationId.toString() !== locationId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Queue does not belong to specified Location',
      };
    }
    if (organizationId && queue.organizationId.toString() !== organizationId.toString()) {
      return {
        valid: false,
        error: 'Invalid hierarchy combination: Queue does not belong to specified Organization',
      };
    }
  }

  return { valid: true };
};

/**
 * Helper to build hierarchy MongoDB match query object
 */
const buildHierarchyMatch = ({ organizationId, locationId, departmentId, queueId }) => {
  const match = {};
  if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
    match.organizationId = new mongoose.Types.ObjectId(organizationId);
  }
  if (locationId && mongoose.Types.ObjectId.isValid(locationId)) {
    match.locationId = new mongoose.Types.ObjectId(locationId);
  }
  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    match.departmentId = new mongoose.Types.ObjectId(departmentId);
  }
  if (queueId && mongoose.Types.ObjectId.isValid(queueId)) {
    match.queueId = new mongoose.Types.ObjectId(queueId);
  }
  return match;
};

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
 * 1. Overview Analytics Engine
 */
const getOverviewMetrics = async ({
  organizationId,
  locationId,
  departmentId,
  queueId,
  startDate,
  endDate,
}) => {
  const hierarchyMatch = buildHierarchyMatch({ organizationId, locationId, departmentId, queueId });

  // Historical date-filtered match
  const historicalMatch = {
    ...hierarchyMatch,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const [historicalFacet] = await QueueEntry.aggregate([
    { $match: historicalMatch },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalEntries: { $sum: 1 },
              uniqueCustomers: { $addToSet: '$customerId' },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
              },
              noShow: {
                $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] },
              },
            },
          },
        ],
        waitTimes: [
          {
            $match: {
              status: 'COMPLETED',
              calledAt: { $ne: null },
              joinedAt: { $ne: null },
              $expr: { $gte: ['$calledAt', '$joinedAt'] },
            },
          },
          {
            $project: {
              waitSec: { $divide: [{ $subtract: ['$calledAt', '$joinedAt'] }, 1000] },
            },
          },
          {
            $match: { waitSec: { $gte: 0, $lte: 86400 } },
          },
          {
            $group: {
              _id: null,
              avgWaitSec: { $avg: '$waitSec' },
              minWaitSec: { $min: '$waitSec' },
              maxWaitSec: { $max: '$waitSec' },
              count: { $sum: 1 },
            },
          },
        ],
        serviceTimes: [
          {
            $match: {
              status: 'COMPLETED',
              startedAt: { $ne: null },
              completedAt: { $ne: null },
              $expr: { $gte: ['$completedAt', '$startedAt'] },
            },
          },
          {
            $project: {
              serviceSec: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000] },
            },
          },
          {
            $match: { serviceSec: { $gte: 0, $lte: 86400 } },
          },
          {
            $group: {
              _id: null,
              avgServiceSec: { $avg: '$serviceSec' },
              minServiceSec: { $min: '$serviceSec' },
              maxServiceSec: { $max: '$serviceSec' },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const totalsObj = historicalFacet?.totals[0] || {};
  const waitObj = historicalFacet?.waitTimes[0] || {};
  const serviceObj = historicalFacet?.serviceTimes[0] || {};

  const totalEntries = totalsObj.totalEntries || 0;
  const totalVisitors = totalsObj.uniqueCustomers ? totalsObj.uniqueCustomers.length : totalEntries;
  const completed = totalsObj.completed || 0;
  const cancelled = totalsObj.cancelled || 0;
  const noShow = totalsObj.noShow || 0;

  // Live operational state (unconstrained by date filter)
  const liveMatch = { ...hierarchyMatch, isActive: true };
  const [liveCounts] = await QueueEntry.aggregate([
    { $match: liveMatch },
    {
      $group: {
        _id: null,
        currentlyWaiting: {
          $sum: { $cond: [{ $eq: ['$status', 'WAITING'] }, 1, 0] },
        },
        currentlyServing: {
          $sum: { $cond: [{ $eq: ['$status', 'SERVING'] }, 1, 0] },
        },
      },
    },
  ]);

  const currentlyWaiting = liveCounts?.currentlyWaiting || 0;
  const currentlyServing = liveCounts?.currentlyServing || 0;

  const completionRate = totalEntries > 0 ? Number(((completed / totalEntries) * 100).toFixed(1)) : 0;
  const cancellationRate = totalEntries > 0 ? Number(((cancelled / totalEntries) * 100).toFixed(1)) : 0;
  const noShowRate = totalEntries > 0 ? Number(((noShow / totalEntries) * 100).toFixed(1)) : 0;

  const averageWaitMinutes = waitObj.avgWaitSec != null ? Number((waitObj.avgWaitSec / 60).toFixed(1)) : 0;
  const averageServiceMinutes = serviceObj.avgServiceSec != null ? Number((serviceObj.avgServiceSec / 60).toFixed(1)) : 0;

  return {
    totalVisitors,
    totalEntries,
    completed,
    cancelled,
    noShow,
    currentlyWaiting,
    currentlyServing,
    averageWaitMinutes,
    averageServiceMinutes,
    completionRate,
    cancellationRate,
    noShowRate,
    throughput: completed,
  };
};

/**
 * 2. Queue-Level Analytics Engine
 */
const getQueueMetrics = async ({
  organizationId,
  locationId,
  departmentId,
  queueId,
  startDate,
  endDate,
}) => {
  const queueQuery = {};
  if (organizationId) queueQuery.organizationId = organizationId;
  if (locationId) queueQuery.locationId = locationId;
  if (departmentId) queueQuery.departmentId = departmentId;
  if (queueId) queueQuery._id = queueId;

  const queues = await Queue.find(queueQuery).select('name prefix maxCapacity status departmentId').lean();

  if (!queues.length) return [];

  const queueIds = queues.map((q) => q._id);

  // Batch aggregate live counts per queue
  const liveCounts = await QueueEntry.aggregate([
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

  const liveMap = new Map();
  for (const item of liveCounts) {
    liveMap.set(`${item._id.queueId.toString()}_${item._id.status}`, item.count);
  }

  const result = [];

  for (const q of queues) {
    const historicalMatch = {
      queueId: q._id,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [facet] = await QueueEntry.aggregate([
      { $match: historicalMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalEntries: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
                noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
              },
            },
          ],
          waitTimes: [
            {
              $match: {
                status: 'COMPLETED',
                calledAt: { $ne: null },
                joinedAt: { $ne: null },
                $expr: { $gte: ['$calledAt', '$joinedAt'] },
              },
            },
            {
              $project: {
                waitSec: { $divide: [{ $subtract: ['$calledAt', '$joinedAt'] }, 1000] },
              },
            },
            { $match: { waitSec: { $gte: 0, $lte: 86400 } } },
            {
              $group: {
                _id: null,
                avgWaitSec: { $avg: '$waitSec' },
                minWaitSec: { $min: '$waitSec' },
                maxWaitSec: { $max: '$waitSec' },
              },
            },
          ],
          serviceTimes: [
            {
              $match: {
                status: 'COMPLETED',
                startedAt: { $ne: null },
                completedAt: { $ne: null },
                $expr: { $gte: ['$completedAt', '$startedAt'] },
              },
            },
            {
              $project: {
                serviceSec: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000] },
              },
            },
            { $match: { serviceSec: { $gte: 0, $lte: 86400 } } },
            {
              $group: {
                _id: null,
                avgServiceSec: { $avg: '$serviceSec' },
                minServiceSec: { $min: '$serviceSec' },
                maxServiceSec: { $max: '$serviceSec' },
              },
            },
          ],
        },
      },
    ]);

    const totals = facet?.totals[0] || {};
    const wait = facet?.waitTimes[0] || {};
    const service = facet?.serviceTimes[0] || {};

    const totalEntries = totals.totalEntries || 0;
    const completed = totals.completed || 0;
    const cancelled = totals.cancelled || 0;
    const noShow = totals.noShow || 0;

    const qIdStr = q._id.toString();
    const liveWaiting = liveMap.get(`${qIdStr}_WAITING`) || 0;
    const liveServing = liveMap.get(`${qIdStr}_SERVING`) || 0;

    result.push({
      queueId: qIdStr,
      queueName: q.name,
      prefix: q.prefix,
      maxCapacity: q.maxCapacity,
      totalEntries,
      completed,
      cancelled,
      noShow,
      completionRate: totalEntries > 0 ? Number(((completed / totalEntries) * 100).toFixed(1)) : 0,
      cancellationRate: totalEntries > 0 ? Number(((cancelled / totalEntries) * 100).toFixed(1)) : 0,
      noShowRate: totalEntries > 0 ? Number(((noShow / totalEntries) * 100).toFixed(1)) : 0,
      averageWaitMinutes: wait.avgWaitSec != null ? Number((wait.avgWaitSec / 60).toFixed(1)) : 0,
      minWaitMinutes: wait.minWaitSec != null ? Number((wait.minWaitSec / 60).toFixed(1)) : 0,
      maxWaitMinutes: wait.maxWaitSec != null ? Number((wait.maxWaitSec / 60).toFixed(1)) : 0,
      averageServiceMinutes: service.avgServiceSec != null ? Number((service.avgServiceSec / 60).toFixed(1)) : 0,
      minServiceMinutes: service.minServiceSec != null ? Number((service.minServiceSec / 60).toFixed(1)) : 0,
      maxServiceMinutes: service.maxServiceSec != null ? Number((service.maxServiceSec / 60).toFixed(1)) : 0,
      currentlyWaiting: liveWaiting,
      currentlyServing: liveServing,
      crowdLevel: getCrowdLevel(liveWaiting),
    });
  }

  return result;
};

/**
 * 3. Counter-Level Analytics Engine
 */
const getCounterMetrics = async ({
  organizationId,
  locationId,
  departmentId,
  queueId,
  startDate,
  endDate,
}) => {
  const counterQuery = {};
  if (organizationId) counterQuery.organizationId = organizationId;
  if (locationId) counterQuery.locationId = locationId;
  if (departmentId) counterQuery.departmentId = departmentId;

  const counters = await Counter.find(counterQuery)
    .populate('assignedStaffId', 'name email')
    .populate('departmentId', 'name')
    .lean();

  const result = [];

  for (const c of counters) {
    const historicalMatch = {
      calledByCounterId: c._id,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [facet] = await QueueEntry.aggregate([
      { $match: historicalMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalCalled: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
              },
            },
          ],
          serviceTimes: [
            {
              $match: {
                status: 'COMPLETED',
                startedAt: { $ne: null },
                completedAt: { $ne: null },
                $expr: { $gte: ['$completedAt', '$startedAt'] },
              },
            },
            {
              $project: {
                serviceSec: { $divide: [{ $subtract: ['$completedAt', '$startedAt'] }, 1000] },
              },
            },
            { $match: { serviceSec: { $gte: 0, $lte: 86400 } } },
            {
              $group: {
                _id: null,
                avgServiceSec: { $avg: '$serviceSec' },
              },
            },
          ],
          waitTimes: [
            {
              $match: {
                calledAt: { $ne: null },
                joinedAt: { $ne: null },
                $expr: { $gte: ['$calledAt', '$joinedAt'] },
              },
            },
            {
              $project: {
                waitSec: { $divide: [{ $subtract: ['$calledAt', '$joinedAt'] }, 1000] },
              },
            },
            { $match: { waitSec: { $gte: 0, $lte: 86400 } } },
            {
              $group: {
                _id: null,
                avgWaitSec: { $avg: '$waitSec' },
              },
            },
          ],
        },
      },
    ]);

    const totals = facet?.totals[0] || {};
    const service = facet?.serviceTimes[0] || {};
    const wait = facet?.waitTimes[0] || {};

    const completedServices = totals.completed || 0;

    result.push({
      counterId: c._id.toString(),
      counterName: c.name,
      number: c.number || '',
      departmentName: c.departmentId?.name || '',
      assignedStaffName: c.assignedStaffId?.name || 'Unassigned',
      status: c.status, // AVAILABLE, BUSY, OFFLINE
      completedServices,
      handledServices: completedServices,
      serviceLoad: completedServices,
      utilizationNote:
        'True time-based counter utilization requires counter state duration logging. handledServices represents operational load.',
      averageServiceMinutes: service.avgServiceSec != null ? Number((service.avgServiceSec / 60).toFixed(1)) : 0,
      averageWaitMinutes: wait.avgWaitSec != null ? Number((wait.avgWaitSec / 60).toFixed(1)) : 0,
    });
  }

  return result;
};

/**
 * 4. Traffic & Peak Hours Analytics Engine
 */
const getTrafficMetrics = async ({
  organizationId,
  locationId,
  departmentId,
  queueId,
  startDate,
  endDate,
}) => {
  const hierarchyMatch = buildHierarchyMatch({ organizationId, locationId, departmentId, queueId });
  const historicalMatch = {
    ...hierarchyMatch,
    createdAt: { $gte: startDate, $lte: endDate },
  };

  // 1. Daily Throughput (completed services grouped by date YYYY-MM-DD)
  const throughputData = await QueueEntry.aggregate([
    {
      $match: {
        ...historicalMatch,
        status: 'COMPLETED',
      },
    },
    {
      $group: {
        _id: { $substr: ['$sequenceDate', 0, 10] },
        completed: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const throughput = throughputData.map((item) => ({
    date: item._id || 'Unknown',
    completed: item.completed,
  }));

  // 2. Peak Hours Analysis (Arrivals by joinedAt hour & Completions by calledAt/completedAt hour)
  const hourlyArrivals = await QueueEntry.aggregate([
    {
      $match: {
        ...historicalMatch,
        joinedAt: { $ne: null },
      },
    },
    {
      $group: {
        _id: { $hour: '$joinedAt' },
        arrivals: { $sum: 1 },
      },
    },
  ]);

  const hourlyCompletions = await QueueEntry.aggregate([
    {
      $match: {
        ...historicalMatch,
        status: 'COMPLETED',
        completedAt: { $ne: null },
      },
    },
    {
      $group: {
        _id: { $hour: '$completedAt' },
        completed: { $sum: 1 },
      },
    },
  ]);

  const arrivalsMap = {};
  hourlyArrivals.forEach((item) => {
    arrivalsMap[item._id] = item.arrivals;
  });

  const completionsMap = {};
  hourlyCompletions.forEach((item) => {
    completionsMap[item._id] = item.completed;
  });

  const peakHours = [];
  for (let h = 0; h < 24; h++) {
    const hourLabel = `${String(h).padStart(2, '0')}:00`;
    peakHours.push({
      hour: hourLabel,
      hour24: h,
      arrivals: arrivalsMap[h] || 0,
      completed: completionsMap[h] || 0,
      count: arrivalsMap[h] || 0,
    });
  }

  return {
    throughput,
    peakHours,
  };
};

/**
 * 5. Crowd Metrics Engine (Live operational state)
 */
const getCrowdMetrics = async ({ organizationId, locationId, departmentId, queueId }) => {
  const queueQuery = {};
  if (organizationId) queueQuery.organizationId = organizationId;
  if (locationId) queueQuery.locationId = locationId;
  if (departmentId) queueQuery.departmentId = departmentId;
  if (queueId) queueQuery._id = queueId;

  const queues = await Queue.find(queueQuery).select('name prefix maxCapacity status departmentId').lean();

  if (!queues.length) {
    return {
      currentWaitingCount: 0,
      crowdStatus: getCrowdLevel(0),
      crowdLevel: getCrowdLevel(0),
      queues: [],
    };
  }

  const queueIds = queues.map((q) => q._id);
  const liveCounts = await QueueEntry.aggregate([
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

  const liveMap = new Map();
  for (const item of liveCounts) {
    liveMap.set(`${item._id.queueId.toString()}_${item._id.status}`, item.count);
  }

  let totalLiveWaiting = 0;
  const queueBreakdown = [];

  for (const q of queues) {
    const qIdStr = q._id.toString();
    const liveWaiting = liveMap.get(`${qIdStr}_WAITING`) || 0;
    const liveServing = liveMap.get(`${qIdStr}_SERVING`) || 0;

    totalLiveWaiting += liveWaiting;

    queueBreakdown.push({
      queueId: qIdStr,
      queueName: q.name,
      prefix: q.prefix,
      maxCapacity: q.maxCapacity,
      waitingCount: liveWaiting,
      servingCount: liveServing,
      crowdLevel: getCrowdLevel(liveWaiting),
    });
  }

  return {
    currentWaitingCount: totalLiveWaiting,
    crowdStatus: getCrowdLevel(totalLiveWaiting),
    crowdLevel: getCrowdLevel(totalLiveWaiting),
    queues: queueBreakdown,
  };
};

module.exports = {
  parseDateRange,
  validateHierarchy,
  getCrowdLevel,
  getOverviewMetrics,
  getQueueMetrics,
  getCounterMetrics,
  getTrafficMetrics,
  getCrowdMetrics,
};
