const Organization = require('../models/Organization');
const Department = require('../models/Department');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

/**
 * Utility helper to safely escape regex special characters
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * GET /api/v1/search/global
 * Multi-entity search across Organizations, Services/Departments, Queues, and Token IDs
 */
const globalSearch = async (req, res, next) => {
  try {
    const queryStr = req.query.q ? String(req.query.q).trim() : '';

    if (!queryStr || queryStr.length < 2) {
      return res.status(200).json({
        success: true,
        data: {
          organizations: [],
          departments: [],
          queues: [],
          myToken: null,
          query: queryStr,
        },
      });
    }

    const sanitized = escapeRegex(queryStr);
    const searchRegex = new RegExp(sanitized, 'i');

    // 1. Search Organizations
    const organizations = await Organization.find({
      isActive: true,
      $or: [{ name: searchRegex }, { description: searchRegex }, { category: searchRegex }],
    })
      .select('name slug category description logoUrl')
      .limit(5)
      .lean();

    // 2. Search Departments / Services
    const departments = await Department.find({
      isActive: true,
      $or: [{ name: searchRegex }, { description: searchRegex }, { code: searchRegex }, { prefix: searchRegex }],
    })
      .select('name code prefix description organizationId locationId')
      .populate('organizationId', 'name slug category')
      .limit(5)
      .lean();

    // 3. Search Queues
    const queues = await Queue.find({
      isActive: true,
      $or: [{ name: searchRegex }, { prefix: searchRegex }],
    })
      .select('name prefix status maxCapacity organizationId locationId departmentId')
      .populate('organizationId', 'name')
      .limit(5)
      .lean();

    // 4. Token ID Lookup (e.g. SPA-104, OPD-099)
    let myToken = null;
    const tokenRegex = /^[A-Z0-9]{2,6}-\d{3,4}$/i;
    if (tokenRegex.test(queryStr)) {
      const entry = await QueueEntry.findOne({
        ticketNumber: queryStr.toUpperCase(),
      })
        .populate('organizationId', 'name')
        .populate('queueId', 'name prefix')
        .lean();

      if (entry) {
        // Authorization check: Only return detailed ticket info if requested by owner, staff, or admin
        const currentUserId = req.user?.id || req.user?._id;
        const isOwner = currentUserId && entry.customerId.toString() === currentUserId.toString();
        const isStaffOrAdmin = req.user && (req.user.role === 'STAFF' || req.user.role === 'ADMIN');

        if (isOwner || isStaffOrAdmin) {
          myToken = {
            id: entry._id,
            ticketNumber: entry.ticketNumber,
            status: entry.status,
            organizationName: entry.organizationId?.name || 'Organization',
            queueName: entry.queueId?.name || 'Queue',
            isAuthorized: true,
          };
        } else {
          // Public sanitized response without private PII
          myToken = {
            ticketNumber: entry.ticketNumber,
            status: entry.status,
            organizationName: entry.organizationId?.name || 'Organization',
            queueName: entry.queueId?.name || 'Queue',
            isAuthorized: false,
          };
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        organizations,
        departments,
        queues,
        myToken,
        query: queryStr,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  globalSearch,
};
