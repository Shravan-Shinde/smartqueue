const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getAnalyticsOverview,
  getAnalyticsQueues,
  getAnalyticsCounters,
  getAnalyticsTraffic,
  getAnalyticsCrowd,
} = require('../controllers/adminAnalyticsController');

// All Admin Analytics routes require authentication and ADMIN role
router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.get('/overview', getAnalyticsOverview);
router.get('/queues', getAnalyticsQueues);
router.get('/counters', getAnalyticsCounters);
router.get('/traffic', getAnalyticsTraffic);
router.get('/crowd', getAnalyticsCrowd);

module.exports = router;
