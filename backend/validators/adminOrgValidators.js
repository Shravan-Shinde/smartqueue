const { body, param, validationResult } = require('express-validator');

/**
 * Helper to check validation errors and format 400 Bad Request response
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

/**
 * Organization Creation Validators
 */
const createOrgValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Organization name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Organization name must be between 2 and 150 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Organization description is required'),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'HOSPITAL',
      'BANK',
      'GOVERNMENT',
      'COLLEGE',
      'SALON',
      'RESTAURANT',
      'SERVICE_CENTER',
      'OTHER',
    ])
    .withMessage('Invalid organization category'),
  body('logo').optional({ checkFalsy: true }).isString(),
  body('banner').optional({ checkFalsy: true }).isString(),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

/**
 * Organization Update Validators
 */
const updateOrgValidators = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Organization name must be between 2 and 150 characters'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  body('category')
    .optional()
    .trim()
    .isIn([
      'HOSPITAL',
      'BANK',
      'GOVERNMENT',
      'COLLEGE',
      'SALON',
      'RESTAURANT',
      'SERVICE_CENTER',
      'OTHER',
    ])
    .withMessage('Invalid organization category'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

/**
 * Location Creation Validators
 */
const createLocationValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Location name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Location name must be between 2 and 150 characters'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('isActive').optional().isBoolean(),
];

/**
 * Location Update Validators
 */
const updateLocationValidators = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Location name must be between 2 and 150 characters'),
  body('address').optional().trim().notEmpty(),
  body('city').optional().trim().notEmpty(),
  body('isActive').optional().isBoolean(),
];

/**
 * Department Creation Validators
 */
const createDepartmentValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  body('description').optional().trim(),
  body('prefix')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Prefix must be between 1 and 10 characters'),
  body('avgServiceTimeMins')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Average service time must be between 1 and 480 minutes'),
  body('isActive').optional().isBoolean(),
];

/**
 * Department Update Validators
 */
const updateDepartmentValidators = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  body('avgServiceTimeMins')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Average service time must be between 1 and 480 minutes'),
  body('isActive').optional().isBoolean(),
];

module.exports = {
  validateInput,
  createOrgValidators,
  updateOrgValidators,
  createLocationValidators,
  updateLocationValidators,
  createDepartmentValidators,
  updateDepartmentValidators,
};
