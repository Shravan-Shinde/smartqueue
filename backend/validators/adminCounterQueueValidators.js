const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

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

const validateHierarchyParams = [
  param('organizationId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid organization ID format');
    }
    return true;
  }),
  param('locationId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid location ID format');
    }
    return true;
  }),
  param('departmentId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid department ID format');
    }
    return true;
  }),
];

const validateCounterIdParam = [
  param('counterId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid counter ID format');
    }
    return true;
  }),
];

const validateQueueIdParam = [
  param('queueId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid queue ID format');
    }
    return true;
  }),
];

/**
 * Counter Validators
 */
const createCounterValidators = [
  ...validateHierarchyParams,
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Counter name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Counter name must be between 1 and 100 characters'),
  body('number').optional().trim(),
  body('status')
    .optional()
    .isIn(['AVAILABLE', 'BUSY', 'OFFLINE'])
    .withMessage('Counter status must be AVAILABLE, BUSY, or OFFLINE'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateCounterValidators = [
  ...validateHierarchyParams,
  ...validateCounterIdParam,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Counter name must be between 1 and 100 characters'),
  body('number').optional().trim(),
  body('status')
    .optional()
    .isIn(['AVAILABLE', 'BUSY', 'OFFLINE'])
    .withMessage('Counter status must be AVAILABLE, BUSY, or OFFLINE'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateCounterStatusValidators = [
  ...validateHierarchyParams,
  ...validateCounterIdParam,
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Counter status is required')
    .isIn(['AVAILABLE', 'BUSY', 'OFFLINE'])
    .withMessage('Counter status must be AVAILABLE, BUSY, or OFFLINE'),
];

/**
 * Queue Validators
 */
const createQueueValidators = [
  ...validateHierarchyParams,
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Queue name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Queue name must be between 1 and 100 characters'),
  body('prefix')
    .trim()
    .notEmpty()
    .withMessage('Queue prefix is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Queue prefix must be between 1 and 10 characters')
    .matches(/^[A-Z0-9]+$/i)
    .withMessage('Queue prefix must contain only letters and numbers'),
  body('description').optional().trim(),
  body('avgServiceTimeMins')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Average service time must be between 1 and 480 minutes'),
  body('maxCapacity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Maximum capacity must be between 1 and 10,000'),
  body('status')
    .optional()
    .isIn(['OPEN', 'PAUSED', 'CLOSED'])
    .withMessage('Queue status must be OPEN, PAUSED, or CLOSED'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateQueueValidators = [
  ...validateHierarchyParams,
  ...validateQueueIdParam,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Queue name must be between 1 and 100 characters'),
  body('prefix')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Queue prefix must be between 1 and 10 characters')
    .matches(/^[A-Z0-9]+$/i)
    .withMessage('Queue prefix must contain only letters and numbers'),
  body('description').optional().trim(),
  body('avgServiceTimeMins')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Average service time must be between 1 and 480 minutes'),
  body('maxCapacity')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Maximum capacity must be between 1 and 10,000'),
  body('status')
    .optional()
    .isIn(['OPEN', 'PAUSED', 'CLOSED'])
    .withMessage('Queue status must be OPEN, PAUSED, or CLOSED'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

const updateQueueStatusValidators = [
  ...validateHierarchyParams,
  ...validateQueueIdParam,
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Queue status is required')
    .isIn(['OPEN', 'PAUSED', 'CLOSED'])
    .withMessage('Queue status must be OPEN, PAUSED, or CLOSED'),
];

module.exports = {
  validateInput,
  validateHierarchyParams,
  validateCounterIdParam,
  validateQueueIdParam,
  createCounterValidators,
  updateCounterValidators,
  updateCounterStatusValidators,
  createQueueValidators,
  updateQueueValidators,
  updateQueueStatusValidators,
};
