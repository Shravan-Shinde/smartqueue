const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  googleAuth,
} = require('../controllers/authController');

const {
  registerValidators,
  loginValidators,
  googleValidators,
  validateInput,
} = require('../validators/authValidators');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { authRateLimiter } = require('../middleware/rateLimiter');

// Public Authentication Endpoints
router.post('/register', authRateLimiter, registerValidators, validateInput, registerUser);
router.post('/login', authRateLimiter, loginValidators, validateInput, loginUser);
router.post('/google', authRateLimiter, googleValidators, validateInput, googleAuth);

// Protected Authentication Endpoints
router.get('/me', protect, getMe);
router.post('/logout', logoutUser);

// RBAC Authorization Test Verification Endpoints
router.get('/test/customer', protect, authorizeRoles('CUSTOMER'), (req, res) => {
  res.status(200).json({ success: true, message: 'Authorized for CUSTOMER role' });
});

router.get('/test/staff', protect, authorizeRoles('STAFF'), (req, res) => {
  res.status(200).json({ success: true, message: 'Authorized for STAFF role' });
});

router.get('/test/admin', protect, authorizeRoles('ADMIN'), (req, res) => {
  res.status(200).json({ success: true, message: 'Authorized for ADMIN role' });
});

module.exports = router;
