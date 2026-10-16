const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getMyCounter,
  updateCounterStatus,
  getWaitingQueue,
  callNext,
  startService,
  completeService,
  noShow,
  getStaffHistory,
  getStaffHistorySummary,
  updateQueueEntryPriority,
  checkInCustomerQr,
} = require('../controllers/staffController');
const { validateCheckInInput, validateInput } = require('../validators/queueEntryValidators');

// All staff operational routes require authentication and STAFF role
router.use(protect);
router.use(authorizeRoles('STAFF'));

router.post('/check-in', validateCheckInInput, validateInput, checkInCustomerQr);
router.get('/my-counter', getMyCounter);
router.patch('/my-counter/status', updateCounterStatus);
router.get('/history', getStaffHistory);
router.get('/history/summary', getStaffHistorySummary);
router.get('/queues/:queueId/waiting', getWaitingQueue);
router.post('/queues/:queueId/call-next', callNext);
router.patch('/queue-entries/:entryId/priority', updateQueueEntryPriority);
router.post('/queue-entries/:entryId/start', startService);
router.post('/queue-entries/:entryId/complete', completeService);
router.post('/queue-entries/:entryId/no-show', noShow);


module.exports = router;

