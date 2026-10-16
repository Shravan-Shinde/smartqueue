const liveCrowdService = require('../services/liveCrowdService');
const analyticsService = require('../services/analyticsService');

/**
 * @desc    Get admin real-time live crowd snapshot
 * @route   GET /api/v1/admin/live-crowd
 * @access  Private/Admin
 */
const getLiveCrowdSnapshot = async (req, res, next) => {
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

    const snapshot = await liveCrowdService.getLiveCrowdSnapshot({
      organizationId,
      locationId,
      departmentId,
      queueId,
    });

    res.status(200).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLiveCrowdSnapshot,
};
