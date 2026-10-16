const customerHistoryService = require('../services/customerHistoryService');

/**
 * @desc    Get authenticated customer's past service history
 * @route   GET /api/v1/customers/me/history
 * @access  Private (Customer)
 */
const getHistory = async (req, res, next) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { status, dateFrom, dateTo, page, limit } = req.query;

    const result = await customerHistoryService.getCustomerHistory({
      customerId,
      status,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * @desc    Get detailed customer history record for a specific entry
 * @route   GET /api/v1/customers/me/history/:entryId
 * @access  Private (Customer)
 */
const getHistoryDetail = async (req, res, next) => {
  try {
    const customerId = req.user._id || req.user.id;
    const { entryId } = req.params;

    const detail = await customerHistoryService.getCustomerHistoryDetail({
      customerId,
      entryId,
    });

    res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getHistory,
  getHistoryDetail,
};
