const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getHistory,
  getHistoryDetail,
} = require('../controllers/customerHistoryController');

// All customer history routes require authentication and CUSTOMER role
router.use(protect);
router.use(authorizeRoles('CUSTOMER'));

router.get('/', getHistory);
router.get('/:entryId', getHistoryDetail);

module.exports = router;
