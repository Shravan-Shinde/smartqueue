const { body, validationResult } = require('express-validator');

/**
 * Registration Input Validation Rules
 */
const registerValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (value && value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
];

/**
 * Login Input Validation Rules
 */
const loginValidators = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * Google Auth Input Validation Rules
 */
const googleValidators = [
  body('idToken')
    .notEmpty()
    .withMessage('Google ID token is required')
    .isString()
    .withMessage('Google ID token must be a string'),
];

/**
 * Middleware to check validation errors and format response
 */
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  registerValidators,
  loginValidators,
  googleValidators,
  validateInput,
};
