const mongoose = require('mongoose');
const Review = require('../models/Review');
const QueueEntry = require('../models/QueueEntry');

/**
 * Create a new customer review for a completed queue ticket
 */
const createReview = async ({ customerId, queueEntryId, rating, comment }) => {
  // Validate Rating (Must be an integer between 1 and 5)
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    const err = new Error('Rating must be an integer between 1 and 5');
    err.statusCode = 400;
    throw err;
  }

  // Validate Comment Length (Max 500 chars)
  if (comment && typeof comment === 'string' && comment.length > 500) {
    const err = new Error('Comment cannot exceed 500 characters');
    err.statusCode = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(queueEntryId)) {
    const err = new Error('Invalid queue entry ID');
    err.statusCode = 400;
    throw err;
  }

  // Find QueueEntry
  const queueEntry = await QueueEntry.findById(queueEntryId);
  if (!queueEntry) {
    const err = new Error('Queue entry not found');
    err.statusCode = 404;
    throw err;
  }

  // Ownership Check
  if (queueEntry.customerId.toString() !== customerId.toString()) {
    const err = new Error('You are not authorized to submit a review for this ticket');
    err.statusCode = 403;
    throw err;
  }

  // Completed Status Check
  if (queueEntry.status !== 'COMPLETED') {
    const err = new Error('Reviews can only be submitted for completed queue tickets');
    err.statusCode = 400;
    throw err;
  }

  // Duplicate Check
  const existingReview = await Review.findOne({ queueEntryId });
  if (existingReview) {
    const err = new Error('A review has already been submitted for this queue entry');
    err.statusCode = 409;
    throw err;
  }

  try {
    const review = await Review.create({
      customerId,
      organizationId: queueEntry.organizationId,
      locationId: queueEntry.locationId,
      departmentId: queueEntry.departmentId,
      queueId: queueEntry.queueId,
      queueEntryId,
      rating: numRating,
      comment: comment ? comment.trim() : '',
      status: 'PUBLISHED',
    });

    return review;
  } catch (error) {
    if (error.code === 11000) {
      const err = new Error('A review has already been submitted for this queue entry');
      err.statusCode = 409;
      throw err;
    }
    throw error;
  }
};

/**
 * Get review for a customer's specific queue entry
 */
const getReviewForEntry = async ({ customerId, queueEntryId }) => {
  if (!mongoose.Types.ObjectId.isValid(queueEntryId)) {
    const err = new Error('Invalid queue entry ID');
    err.statusCode = 400;
    throw err;
  }

  const queueEntry = await QueueEntry.findById(queueEntryId).select('customerId').lean();
  if (!queueEntry) {
    const err = new Error('Queue entry not found');
    err.statusCode = 404;
    throw err;
  }

  if (queueEntry.customerId.toString() !== customerId.toString()) {
    const err = new Error('You are not authorized to access this review');
    err.statusCode = 403;
    throw err;
  }

  const review = await Review.findOne({ queueEntryId }).lean();
  return review;
};

/**
 * Get paginated reviews for Admin with filters
 */
const getAdminReviews = async (filterParams = {}) => {
  const {
    organizationId,
    locationId,
    departmentId,
    queueId,
    rating,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = filterParams;

  const query = {};

  if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
    query.organizationId = organizationId;
  }
  if (locationId && mongoose.Types.ObjectId.isValid(locationId)) {
    query.locationId = locationId;
  }
  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    query.departmentId = departmentId;
  }
  if (queueId && mongoose.Types.ObjectId.isValid(queueId)) {
    query.queueId = queueId;
  }

  if (rating) {
    const numRating = Number(rating);
    if (!isNaN(numRating)) {
      query.rating = numRating;
    }
  }

  if (status && typeof status === 'string' && ['PUBLISHED', 'HIDDEN'].includes(status.toUpperCase())) {
    query.status = status.toUpperCase();
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      if (typeof endDate === 'string' && endDate.length === 10) {
        end.setUTCHours(23, 59, 59, 999);
      }
      query.createdAt.$lte = end;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('customerId', 'fullName name email')
      .populate('queueEntryId', 'ticketNumber status completedAt calledByCounterId')
      .populate('queueId', 'name prefix')
      .populate('departmentId', 'name')
      .populate('locationId', 'name')
      .populate('organizationId', 'name')
      .lean(),
    Review.countDocuments(query),
  ]);

  return {
    reviews,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Get aggregate review summary stats (rating breakdown, average rating, count)
 */
const getAdminReviewSummary = async (filterParams = {}) => {
  const { organizationId, locationId, departmentId, queueId, startDate, endDate } = filterParams;

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

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      match.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      if (typeof endDate === 'string' && endDate.length === 10) {
        end.setUTCHours(23, 59, 59, 999);
      }
      match.createdAt.$lte = end;
    }
  }

  const result = await Review.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        totalRatingSum: { $sum: '$rating' },
        star1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        star2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        star3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        star4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        star5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
  ]);

  if (!result || result.length === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      breakdown: {
        1: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        5: { count: 0, percentage: 0 },
      },
    };
  }

  const stats = result[0];
  const total = stats.totalReviews;
  const avg = total > 0 ? Math.round((stats.totalRatingSum / total) * 10) / 10 : 0;

  const calcPct = (count) => (total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0);

  return {
    totalReviews: total,
    averageRating: avg,
    breakdown: {
      1: { count: stats.star1, percentage: calcPct(stats.star1) },
      2: { count: stats.star2, percentage: calcPct(stats.star2) },
      3: { count: stats.star3, percentage: calcPct(stats.star3) },
      4: { count: stats.star4, percentage: calcPct(stats.star4) },
      5: { count: stats.star5, percentage: calcPct(stats.star5) },
    },
  };
};

/**
 * Moderate review status (PUBLISHED <-> HIDDEN)
 */
const updateReviewStatus = async ({ reviewId, status }) => {
  if (!status || !['PUBLISHED', 'HIDDEN'].includes(status.toUpperCase())) {
    const err = new Error('Status must be PUBLISHED or HIDDEN');
    err.statusCode = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    const err = new Error('Invalid review ID');
    err.statusCode = 400;
    throw err;
  }

  const review = await Review.findById(reviewId);
  if (!review) {
    const err = new Error('Review not found');
    err.statusCode = 404;
    throw err;
  }

  review.status = status.toUpperCase();
  await review.save();

  return review;
};

module.exports = {
  createReview,
  getReviewForEntry,
  getAdminReviews,
  getAdminReviewSummary,
  updateReviewStatus,
};
