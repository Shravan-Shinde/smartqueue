const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  createStaffUser,
  getStaffUsers,
  updateStaffUser,
  toggleStaffStatus,
} = require('../controllers/adminStaffController');

router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.post('/', createStaffUser);
router.get('/', getStaffUsers);
router.patch('/:staffId', updateStaffUser);
router.patch('/:staffId/status', toggleStaffStatus);

module.exports = router;
