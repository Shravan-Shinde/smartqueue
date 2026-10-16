const reviewService = require('../services/reviewService');

/**
 * @desc    Submit customer review for completed queue ticket
 * @route   POST /api/v1/queue-entries/:entryId/review
 * @access  Private (Customer)
 */
const submitReview = async (req, res, next) => {
  try {
    const customerId = req.user._id || req.user.id;
    const queueEntryId = req.params.entryId;
    const { rating, comment } = req.body;

    const review = await reviewService.createReview({
      customerId,
      queueEntryId,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review,
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
 * @desc    Get existing customer review for queue entry
 * @route   GET /api/v1/queue-entries/:entryId/review
 * @access  Private (Customer)
 */
const getEntryReview = async (req, res, next) => {
  try {
    const customerId = req.user._id || req.user.id;
    const queueEntryId = req.params.entryId;

    const review = await reviewService.getReviewForEntry({
      customerId,
      queueEntryId,
    });

    res.status(200).json({
      success: true,
      data: review,
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
  submitReview,
  getEntryReview,
};
