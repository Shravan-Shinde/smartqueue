const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateInput,
  validateQueueIdParam,
  validateEntryIdParam,
  validateDepartmentIdParam,
  validateCheckInInput,
} = require('../validators/queueEntryValidators');

const {
  customerJoinQueue,
  customerGetActiveEntry,
  customerGetEntryById,
  customerGetEntryWaitTime,
  customerGetEntryQrToken,
  customerCancelEntry,
  getPublicQueuesForDepartment,
  getPublicQueueById,
} = require('../controllers/queueEntryController');

const { submitReview, getEntryReview } = require('../controllers/reviewController');

const { checkInCustomerQr } = require('../controllers/staffController');
const { apiMutationRateLimiter } = require('../middleware/rateLimiter');

// ==========================================
// Staff Operations Endpoint
// ==========================================
router.post(
  '/queues/check-in',
  apiMutationRateLimiter,
  protect,
  authorizeRoles('STAFF'),
  validateCheckInInput,
  validateInput,
  checkInCustomerQr
);

// ==========================================
// Public / Customer Discovery Endpoints
// ==========================================
router.get(
  '/departments/:departmentId/queues',
  validateDepartmentIdParam,
  validateInput,
  getPublicQueuesForDepartment
);

router.get(
  '/queues/my-active-entry',
  protect,
  authorizeRoles('CUSTOMER'),
  customerGetActiveEntry
);

router.get(
  '/queues/:queueId',
  validateQueueIdParam,
  validateInput,
  getPublicQueueById
);

// ==========================================
// Protected Customer Queue Operations
// ==========================================
router.post(
  '/queues/:queueId/join',
  apiMutationRateLimiter,
  protect,
  authorizeRoles('CUSTOMER'),
  validateQueueIdParam,
  validateInput,
  customerJoinQueue
);

router.get(
  '/queue-entries/:entryId/qr',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  customerGetEntryQrToken
);

router.get(
  '/queue-entries/:entryId/wait-time',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  customerGetEntryWaitTime
);

router.get(
  '/queue-entries/:entryId',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  customerGetEntryById
);

router.patch(
  '/queue-entries/:entryId/cancel',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  customerCancelEntry
);

router.post(
  '/queue-entries/:entryId/review',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  submitReview
);

router.get(
  '/queue-entries/:entryId/review',
  protect,
  authorizeRoles('CUSTOMER'),
  validateEntryIdParam,
  validateInput,
  getEntryReview
);

module.exports = router;
