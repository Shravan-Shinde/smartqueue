const analyticsService = require('../services/analyticsService');

/**
 * @desc    Get admin high-level operational overview analytics
 * @route   GET /api/v1/admin/analytics/overview
 * @access  Private/Admin
 */
const getAnalyticsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate, from, to, organizationId, locationId, departmentId, queueId } = req.query;

    const dateRes = analyticsService.parseDateRange(startDate, endDate, from, to);
    if (!dateRes.valid) {
      return res.status(400).json({
        success: false,
        message: dateRes.error,
      });
    }

    const hierarchyRes = await analyticsService.validateHierarchy({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });
    if (!hierarchyRes.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchyRes.error,
      });
    }

    const overview = await analyticsService.getOverviewMetrics({
      organizationId,
      locationId,
      departmentId,
      queueId,
      startDate: dateRes.startDate,
      endDate: dateRes.endDate,
    });

    res.status(200).json({
      success: true,
      data: overview,
      meta: {
        from: dateRes.from,
        to: dateRes.to,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin queue-level performance analytics
 * @route   GET /api/v1/admin/analytics/queues
 * @access  Private/Admin
 */
const getAnalyticsQueues = async (req, res, next) => {
  try {
    const { startDate, endDate, from, to, organizationId, locationId, departmentId, queueId } = req.query;

    const dateRes = analyticsService.parseDateRange(startDate, endDate, from, to);
    if (!dateRes.valid) {
      return res.status(400).json({
        success: false,
        message: dateRes.error,
      });
    }

    const hierarchyRes = await analyticsService.validateHierarchy({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });
    if (!hierarchyRes.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchyRes.error,
      });
    }

    const queuesMetrics = await analyticsService.getQueueMetrics({
      organizationId,
      locationId,
      departmentId,
      queueId,
      startDate: dateRes.startDate,
      endDate: dateRes.endDate,
    });

    res.status(200).json({
      success: true,
      count: queuesMetrics.length,
      data: queuesMetrics,
      meta: {
        from: dateRes.from,
        to: dateRes.to,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin counter-level operational performance analytics
 * @route   GET /api/v1/admin/analytics/counters
 * @access  Private/Admin
 */
const getAnalyticsCounters = async (req, res, next) => {
  try {
    const { startDate, endDate, from, to, organizationId, locationId, departmentId, queueId } = req.query;

    const dateRes = analyticsService.parseDateRange(startDate, endDate, from, to);
    if (!dateRes.valid) {
      return res.status(400).json({
        success: false,
        message: dateRes.error,
      });
    }

    const hierarchyRes = await analyticsService.validateHierarchy({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });
    if (!hierarchyRes.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchyRes.error,
      });
    }

    const countersMetrics = await analyticsService.getCounterMetrics({
      organizationId,
      locationId,
      departmentId,
      queueId,
      startDate: dateRes.startDate,
      endDate: dateRes.endDate,
    });

    res.status(200).json({
      success: true,
      count: countersMetrics.length,
      data: countersMetrics,
      meta: {
        from: dateRes.from,
        to: dateRes.to,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin traffic, throughput & peak-hour analytics
 * @route   GET /api/v1/admin/analytics/traffic
 * @access  Private/Admin
 */
const getAnalyticsTraffic = async (req, res, next) => {
  try {
    const { startDate, endDate, from, to, organizationId, locationId, departmentId, queueId } = req.query;

    const dateRes = analyticsService.parseDateRange(startDate, endDate, from, to);
    if (!dateRes.valid) {
      return res.status(400).json({
        success: false,
        message: dateRes.error,
      });
    }

    const hierarchyRes = await analyticsService.validateHierarchy({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });
    if (!hierarchyRes.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchyRes.error,
      });
    }

    const trafficMetrics = await analyticsService.getTrafficMetrics({
      organizationId,
      locationId,
      departmentId,
      queueId,
      startDate: dateRes.startDate,
      endDate: dateRes.endDate,
    });

    res.status(200).json({
      success: true,
      data: trafficMetrics,
      meta: {
        from: dateRes.from,
        to: dateRes.to,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin live crowd status & queue waiting breakdown
 * @route   GET /api/v1/admin/analytics/crowd
 * @access  Private/Admin
 */
const getAnalyticsCrowd = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, queueId } = req.query;

    const hierarchyRes = await analyticsService.validateHierarchy({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });
    if (!hierarchyRes.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchyRes.error,
      });
    }

    const crowdMetrics = await analyticsService.getCrowdMetrics({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });

    res.status(200).json({
      success: true,
      data: crowdMetrics,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsOverview,
  getAnalyticsQueues,
  getAnalyticsCounters,
  getAnalyticsTraffic,
  getAnalyticsCrowd,
};
