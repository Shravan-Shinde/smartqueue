const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const { emitQueueStatusChange, emitLiveCrowdUpdate } = require('../socket/socketServer');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');

/**
 * Strict Parent Hierarchy Verification Helper
 * Verifies organization, location, and department exist, are active, and belong to each other.
 */
const verifyHierarchy = async (organizationId, locationId, departmentId) => {
  const organization = await Organization.findById(organizationId);
  if (!organization || !organization.isActive) {
    return {
      valid: false,
      statusCode: 404,
      message: 'Organization not found or is inactive',
    };
  }

  const location = await Location.findById(locationId);
  if (
    !location ||
    !location.isActive ||
    location.organizationId.toString() !== organizationId
  ) {
    return {
      valid: false,
      statusCode: 404,
      message: 'Location not found, is inactive, or does not belong to specified organization',
    };
  }

  const department = await Department.findById(departmentId);
  if (
    !department ||
    !department.isActive ||
    department.locationId.toString() !== locationId ||
    department.organizationId.toString() !== organizationId
  ) {
    return {
      valid: false,
      statusCode: 404,
      message: 'Department not found, is inactive, or does not belong to specified hierarchy',
    };
  }

  return { valid: true, organization, location, department };
};

// ==========================================
// ADMIN COUNTER CONTROLLERS
// ==========================================

/**
 * @desc    Get all counters for a department
 * @route   GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/counters
 * @access  Private/Admin
 */
const adminGetCounters = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const { status, includeInactive } = req.query;
    const filter = {
      organizationId,
      locationId,
      departmentId,
    };

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (includeInactive !== 'true') {
      // By default return all counters for admin dashboard view unless specified
    }

    const counters = await Counter.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: counters.length,
      data: counters,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a counter in a department
 * @route   POST /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/counters
 * @access  Private/Admin
 */
const adminCreateCounter = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const { name, number, status, isActive } = req.body;

    const counterData = {
      organizationId,
      locationId,
      departmentId,
      name,
      number: number || '',
      status: status ? status.toUpperCase() : 'OFFLINE',
      isActive: isActive !== undefined ? isActive : true,
    };

    const counter = await Counter.create(counterData);

    res.status(201).json({
      success: true,
      message: 'Counter created successfully',
      data: counter,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A counter with this name already exists in this department',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get single counter details
 * @route   GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId
 * @access  Private/Admin
 */
const adminGetCounterById = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, counterId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const counter = await Counter.findOne({
      _id: counterId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found in specified department hierarchy',
      });
    }

    res.status(200).json({
      success: true,
      data: counter,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update counter details
 * @route   PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId
 * @access  Private/Admin
 */
const adminUpdateCounter = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, counterId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const counter = await Counter.findOne({
      _id: counterId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found in specified department hierarchy',
      });
    }

    const allowedFields = ['name', 'number', 'status', 'isActive'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'status') {
          counter[field] = req.body[field].toUpperCase();
        } else {
          counter[field] = req.body[field];
        }
      }
    });

    await counter.save();

    res.status(200).json({
      success: true,
      message: 'Counter updated successfully',
      data: counter,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A counter with this name already exists in this department',
      });
    }
    next(error);
  }
};

/**
 * @desc    Update counter status or toggle active state
 * @route   PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId/status
 * @access  Private/Admin
 */
const adminToggleCounterStatus = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, counterId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const counter = await Counter.findOne({
      _id: counterId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!counter) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found in specified department hierarchy',
      });
    }

    if (req.body.status !== undefined) {
      counter.status = req.body.status.toUpperCase();
    }

    if (req.body.isActive !== undefined) {
      counter.isActive = Boolean(req.body.isActive);
    }

    await counter.save();

    res.status(200).json({
      success: true,
      message: 'Counter status updated successfully',
      data: counter,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ADMIN QUEUE CONTROLLERS
// ==========================================

/**
 * @desc    Get all queues for a department
 * @route   GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/queues
 * @access  Private/Admin
 */
const adminGetQueues = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const { status } = req.query;
    const filter = {
      organizationId,
      locationId,
      departmentId,
    };

    if (status) {
      filter.status = status.toUpperCase();
    }

    const queues = await Queue.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: queues.length,
      data: queues,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a queue in a department
 * @route   POST /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/queues
 * @access  Private/Admin
 */
const adminCreateQueue = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const {
      name,
      prefix,
      description,
      avgServiceTimeMins,
      maxCapacity,
      status,
      isActive,
    } = req.body;

    const queueData = {
      organizationId,
      locationId,
      departmentId,
      name,
      prefix: prefix ? prefix.toUpperCase() : 'GEN',
      description: description || '',
      avgServiceTimeMins: avgServiceTimeMins || 15,
      maxCapacity: maxCapacity || 100,
      status: status ? status.toUpperCase() : 'CLOSED',
      isActive: isActive !== undefined ? isActive : true,
      lastSequenceNumber: 0,
    };

    const queue = await Queue.create(queueData);

    await cacheService.deletePattern(`smartqueue:department-queues:${departmentId}:*`);

    res.status(201).json({
      success: true,
      message: 'Queue created successfully',
      data: queue,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A queue with this prefix already exists in this department',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get single queue details
 * @route   GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId
 * @access  Private/Admin
 */
const adminGetQueueById = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, queueId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const queue = await Queue.findOne({
      _id: queueId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found in specified department hierarchy',
      });
    }

    res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update queue details
 * @route   PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId
 * @access  Private/Admin
 */
const adminUpdateQueue = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, queueId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const queue = await Queue.findOne({
      _id: queueId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found in specified department hierarchy',
      });
    }

    const allowedFields = [
      'name',
      'prefix',
      'description',
      'avgServiceTimeMins',
      'maxCapacity',
      'status',
      'isActive',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'prefix') {
          queue.prefix = req.body.prefix.toUpperCase();
        } else if (field === 'status') {
          queue.status = req.body.status.toUpperCase();
        } else {
          queue[field] = req.body[field];
        }
      }
    });

    await queue.save();

    await cacheService.delete(`smartqueue:queue:${queueId}`);
    await cacheService.deletePattern(`smartqueue:department-queues:${departmentId}:*`);

    try {
      emitQueueStatusChange(queue._id.toString(), queue.status);
      emitLiveCrowdUpdate(queue._id.toString());

      const activeEntries = await QueueEntry.find({ queueId: queue._id, isActive: true });
      for (const entry of activeEntries) {
        notificationService.notifyQueueStatusChanged({
          userId: entry.customerId,
          queueId: queue._id,
          queueName: queue.name,
          status: queue.status,
        });
      }
    } catch (socketErr) {
      console.error('[SOCKET EMIT ERROR on Queue Update]', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Queue updated successfully',
      data: queue,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A queue with this prefix already exists in this department',
      });
    }
    next(error);
  }
};

/**
 * @desc    Update queue status or toggle active state
 * @route   PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId/status
 * @access  Private/Admin
 */
const adminToggleQueueStatus = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId, queueId } = req.params;

    const check = await verifyHierarchy(organizationId, locationId, departmentId);
    if (!check.valid) {
      return res.status(check.statusCode).json({ success: false, message: check.message });
    }

    const queue = await Queue.findOne({
      _id: queueId,
      organizationId,
      locationId,
      departmentId,
    });

    if (!queue) {
      return res.status(404).json({
        success: false,
        message: 'Queue not found in specified department hierarchy',
      });
    }

    if (req.body.status !== undefined) {
      queue.status = req.body.status.toUpperCase();
    }

    if (req.body.isActive !== undefined) {
      queue.isActive = Boolean(req.body.isActive);
    }

    await queue.save();

    await cacheService.delete(`smartqueue:queue:${queueId}`);
    await cacheService.deletePattern(`smartqueue:department-queues:${departmentId}:*`);

    try {
      emitQueueStatusChange(queue._id.toString(), queue.status);
      emitLiveCrowdUpdate(queue._id.toString());

      const activeEntries = await QueueEntry.find({ queueId: queue._id, isActive: true });
      for (const entry of activeEntries) {
        notificationService.notifyQueueStatusChanged({
          userId: entry.customerId,
          queueId: queue._id,
          queueName: queue.name,
          status: queue.status,
        });
      }
    } catch (socketErr) {
      console.error('[SOCKET EMIT ERROR on Queue Status Toggle]', socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Queue status updated successfully',
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign a STAFF user to a counter (ADMIN ONLY)
 * @route   PATCH /api/v1/admin/counters/:counterId/assign-staff
 * @access  Private/Admin
 */
const assignStaffToCounter = async (req, res, next) => {
  try {
    const { counterId } = req.params;
    const { staffUserId } = req.body;

    if (!staffUserId) {
      return res.status(400).json({
        success: false,
        message: 'staffUserId is required',
      });
    }

    const counter = await Counter.findById(counterId);
    if (!counter || !counter.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found or inactive',
      });
    }

    // Verify staff user exists, is active, and has STAFF role
    const staffUser = await User.findById(staffUserId);
    if (!staffUser || !staffUser.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found or inactive',
      });
    }

    if (staffUser.role !== 'STAFF') {
      return res.status(400).json({
        success: false,
        message: 'User must have STAFF role to be assigned to a counter',
      });
    }

    // One Staff / One Counter Rule: Check if staff member is already assigned elsewhere
    const existingAssignment = await Counter.findOne({
      assignedStaffId: staffUserId,
      _id: { $ne: counterId },
      isActive: true,
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        message: 'Staff member is already assigned to another counter',
      });
    }

    counter.assignedStaffId = staffUserId;
    await counter.save();

    res.status(200).json({
      success: true,
      message: 'Staff member assigned to counter successfully',
      data: counter,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove assigned STAFF user from counter (ADMIN ONLY)
 * @route   PATCH /api/v1/admin/counters/:counterId/remove-staff
 * @access  Private/Admin
 */
const removeStaffFromCounter = async (req, res, next) => {
  try {
    const { counterId } = req.params;

    const counter = await Counter.findById(counterId);
    if (!counter || !counter.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Counter not found or inactive',
      });
    }

    counter.assignedStaffId = null;
    await counter.save();

    res.status(200).json({
      success: true,
      message: 'Staff member removed from counter successfully',
      data: counter,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminGetCounters,
  adminCreateCounter,
  adminGetCounterById,
  adminUpdateCounter,
  adminToggleCounterStatus,
  adminGetQueues,
  adminCreateQueue,
  adminGetQueueById,
  adminUpdateQueue,
  adminToggleQueueStatus,
  assignStaffToCounter,
  removeStaffFromCounter,
};
