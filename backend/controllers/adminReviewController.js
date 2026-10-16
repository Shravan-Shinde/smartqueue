const reviewService = require('../services/reviewService');

/**
 * @desc    Get paginated admin reviews list with filters
 * @route   GET /api/v1/admin/reviews
 * @access  Private/Admin
 */
const getAdminReviews = async (req, res, next) => {
  try {
    const result = await reviewService.getAdminReviews(req.query);
    res.status(200).json({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
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
 * @desc    Get aggregate review rating summary stats
 * @route   GET /api/v1/admin/reviews/summary
 * @access  Private/Admin
 */
const getAdminReviewSummary = async (req, res, next) => {
  try {
    const summary = await reviewService.getAdminReviewSummary(req.query);
    res.status(200).json({
      success: true,
      data: summary,
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
 * @desc    Update review status (PUBLISHED / HIDDEN)
 * @route   PATCH /api/v1/admin/reviews/:reviewId/status
 * @access  Private/Admin
 */
const updateReviewStatus = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;

    const updatedReview = await reviewService.updateReviewStatus({
      reviewId,
      status,
    });

    res.status(200).json({
      success: true,
      message: `Review status updated to ${updatedReview.status}`,
      data: updatedReview,
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
  getAdminReviews,
  getAdminReviewSummary,
  updateReviewStatus,
};
