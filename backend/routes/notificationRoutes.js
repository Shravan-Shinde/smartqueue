const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

// All notification endpoints require authentication and CUSTOMER role
router.use(protect);
router.use(authorizeRoles('CUSTOMER'));

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:notificationId/read', markNotificationAsRead);

module.exports = router;
