const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getAdminReviews,
  getAdminReviewSummary,
  updateReviewStatus,
} = require('../controllers/adminReviewController');

// All Admin Review routes require authentication and ADMIN role
router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.get('/summary', getAdminReviewSummary);
router.get('/', getAdminReviews);
router.patch('/:reviewId/status', updateReviewStatus);

module.exports = router;
