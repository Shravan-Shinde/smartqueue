const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateInput,
  validateHierarchyParams,
  validateCounterIdParam,
  validateQueueIdParam,
  createCounterValidators,
  updateCounterValidators,
  updateCounterStatusValidators,
  createQueueValidators,
  updateQueueValidators,
  updateQueueStatusValidators,
} = require('../validators/adminCounterQueueValidators');

const {
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
} = require('../controllers/adminCounterQueueController');

// All Admin Counter & Queue routes require authentication and ADMIN role
router.use(protect);
router.use(authorizeRoles('ADMIN'));

// ==========================================
// Counter Admin Endpoints
// ==========================================
router.get(
  '/:organizationId/locations/:locationId/departments/:departmentId/counters',
  validateHierarchyParams,
  validateInput,
  adminGetCounters
);
router.post(
  '/:organizationId/locations/:locationId/departments/:departmentId/counters',
  createCounterValidators,
  validateInput,
  adminCreateCounter
);
router.get(
  '/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId',
  validateHierarchyParams,
  validateCounterIdParam,
  validateInput,
  adminGetCounterById
);
router.patch(
  '/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId',
  updateCounterValidators,
  validateInput,
  adminUpdateCounter
);
router.patch(
  '/:organizationId/locations/:locationId/departments/:departmentId/counters/:counterId/status',
  updateCounterStatusValidators,
  validateInput,
  adminToggleCounterStatus
);
router.patch('/counters/:counterId/assign-staff', validateCounterIdParam, validateInput, assignStaffToCounter);
router.patch('/counters/:counterId/remove-staff', validateCounterIdParam, validateInput, removeStaffFromCounter);

// ==========================================
// Queue Admin Endpoints
// ==========================================
router.get(
  '/:organizationId/locations/:locationId/departments/:departmentId/queues',
  validateHierarchyParams,
  validateInput,
  adminGetQueues
);
router.post(
  '/:organizationId/locations/:locationId/departments/:departmentId/queues',
  createQueueValidators,
  validateInput,
  adminCreateQueue
);
router.get(
  '/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId',
  validateHierarchyParams,
  validateQueueIdParam,
  validateInput,
  adminGetQueueById
);
router.patch(
  '/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId',
  updateQueueValidators,
  validateInput,
  adminUpdateQueue
);
router.patch(
  '/:organizationId/locations/:locationId/departments/:departmentId/queues/:queueId/status',
  updateQueueStatusValidators,
  validateInput,
  adminToggleQueueStatus
);

module.exports = router;
