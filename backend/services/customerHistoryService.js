const mongoose = require('mongoose');
const QueueEntry = require('../models/QueueEntry');
const Review = require('../models/Review');

const ALLOWED_HISTORICAL_STATUSES = ['COMPLETED', 'NO_SHOW', 'CANCELLED'];

/**
 * Get paginated customer historical queue entries
 */
const getCustomerHistory = async ({
  customerId,
  status,
  dateFrom,
  dateTo,
  page = 1,
  limit = 10,
}) => {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error('Invalid customer ID format');
    err.statusCode = 400;
    throw err;
  }

  // Build Query
  const query = { customerId };

  // Status Filter
  if (status) {
    const upperStatus = String(status).toUpperCase();
    if (!ALLOWED_HISTORICAL_STATUSES.includes(upperStatus)) {
      const err = new Error(
        `Invalid history status filter. Allowed values: ${ALLOWED_HISTORICAL_STATUSES.join(', ')}`
      );
      err.statusCode = 400;
      throw err;
    }
    query.status = upperStatus;
  } else {
    query.status = { $in: ALLOWED_HISTORICAL_STATUSES };
  }

  // Date Filtering on joinedAt
  if (dateFrom || dateTo) {
    if ((dateFrom && typeof dateFrom !== 'string') || (dateTo && typeof dateTo !== 'string')) {
      const err = new Error('Invalid date parameters');
      err.statusCode = 400;
      throw err;
    }
    query.joinedAt = {};

    if (dateFrom) {
      const dFrom = new Date(dateFrom);
      if (isNaN(dFrom.getTime())) {
        const err = new Error('Invalid dateFrom format');
        err.statusCode = 400;
        throw err;
      }
      query.joinedAt.$gte = dFrom;
    }

    if (dateTo) {
      const dTo = new Date(dateTo);
      if (isNaN(dTo.getTime())) {
        const err = new Error('Invalid dateTo format');
        err.statusCode = 400;
        throw err;
      }
      if (typeof dateTo === 'string' && dateTo.length === 10) {
        dTo.setUTCHours(23, 59, 59, 999);
      }
      query.joinedAt.$lte = dTo;
    }

    if (
      dateFrom &&
      dateTo &&
      query.joinedAt.$gte &&
      query.joinedAt.$lte &&
      query.joinedAt.$gte > query.joinedAt.$lte
    ) {
      const err = new Error('dateFrom cannot be after dateTo');
      err.statusCode = 400;
      throw err;
    }
  }

  // Pagination Validation
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    const err = new Error('Page must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  if (isNaN(limitNum) || limitNum < 1) {
    const err = new Error('Limit must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  // Enforce reasonable maximum limit
  const limitClamped = Math.min(100, limitNum);
  const skip = (pageNum - 1) * limitClamped;

  // Execute Query with Deterministic Sorting (joinedAt DESC, _id DESC)
  const [entries, totalItems] = await Promise.all([
    QueueEntry.find(query)
      .sort({ joinedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitClamped)
      .populate('organizationId', 'name description category')
      .populate('locationId', 'name address city')
      .populate('departmentId', 'name prefix')
      .populate('queueId', 'name prefix')
      .populate('calledByCounterId', 'name number')
      .lean(),
    QueueEntry.countDocuments(query),
  ]);

  const entryIds = entries.map((e) => e._id);
  const reviews = await Review.find({ queueEntryId: { $in: entryIds } }).lean();
  const reviewMap = new Map(reviews.map((r) => [r.queueEntryId.toString(), r]));

  // Transform and enrich items
  const items = entries.map((entry) => {
    const entryObj = { ...entry };

    // Calculate Durations
    let actualWaitDurationSec = null;
    if (entry.calledAt && entry.joinedAt) {
      const waitMs = new Date(entry.calledAt).getTime() - new Date(entry.joinedAt).getTime();
      actualWaitDurationSec = Math.max(0, Math.round(waitMs / 1000));
    }

    let actualServiceDurationSec = null;
    if (entry.completedAt && entry.startedAt) {
      const svcMs = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
      actualServiceDurationSec = Math.max(0, Math.round(svcMs / 1000));
    }

    // Attach Review Information
    const existingReview = reviewMap.get(entry._id.toString());
    const reviewInfo = existingReview
      ? {
          submitted: true,
          rating: existingReview.rating,
          comment: existingReview.comment || '',
          status: existingReview.status,
        }
      : {
          submitted: false,
        };

    // Sanitize Privacy-Sensitive Fields
    delete entryObj.qrToken;
    delete entryObj.qrTokenCreatedAt;

    return {
      ...entryObj,
      actualWaitDurationSec,
      actualServiceDurationSec,
      review: reviewInfo,
    };
  });

  const totalPages = Math.ceil(totalItems / limitClamped) || 0;

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitClamped,
      totalItems,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
    },
  };
};

/**
 * Get detailed customer history record by entry ID
 */
const getCustomerHistoryDetail = async ({ customerId, entryId }) => {
  if (!mongoose.Types.ObjectId.isValid(entryId)) {
    const err = new Error('Invalid queue entry ID format');
    err.statusCode = 400;
    throw err;
  }

  const entry = await QueueEntry.findById(entryId)
    .populate('organizationId', 'name description category')
    .populate('locationId', 'name address city')
    .populate('departmentId', 'name prefix')
    .populate('queueId', 'name prefix')
    .populate('calledByCounterId', 'name number')
    .lean();

  // Ownership Check: Must belong strictly to the authenticated customer
  if (!entry || entry.customerId.toString() !== customerId.toString()) {
    const err = new Error('Historical service record not found');
    err.statusCode = 404;
    throw err;
  }

  const entryObj = { ...entry };

  // Durations
  let actualWaitDurationSec = null;
  if (entry.calledAt && entry.joinedAt) {
    const waitMs = new Date(entry.calledAt).getTime() - new Date(entry.joinedAt).getTime();
    actualWaitDurationSec = Math.max(0, Math.round(waitMs / 1000));
  }

  let actualServiceDurationSec = null;
  if (entry.completedAt && entry.startedAt) {
    const svcMs = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
    actualServiceDurationSec = Math.max(0, Math.round(svcMs / 1000));
  }

  // Fetch Review
  const existingReview = await Review.findOne({ queueEntryId: entry._id }).lean();
  const reviewInfo = existingReview
    ? {
        submitted: true,
        rating: existingReview.rating,
        comment: existingReview.comment || '',
        status: existingReview.status,
      }
    : {
        submitted: false,
      };

  // Sanitize
  delete entryObj.qrToken;
  delete entryObj.qrTokenCreatedAt;

  return {
    ...entryObj,
    actualWaitDurationSec,
    actualServiceDurationSec,
    review: reviewInfo,
  };
};

module.exports = {
  getCustomerHistory,
  getCustomerHistoryDetail,
};
