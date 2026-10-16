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

const validateQueueIdParam = [
  param('queueId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid queue ID format');
    }
    return true;
  }),
];

const validateEntryIdParam = [
  param('entryId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid queue entry ID format');
    }
    return true;
  }),
];

const validateDepartmentIdParam = [
  param('departmentId').custom((val) => {
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new Error('Invalid department ID format');
    }
    return true;
  }),
];

const validateCheckInInput = [
  body('qrToken')
    .notEmpty()
    .withMessage('QR token is required')
    .isString()
    .withMessage('QR token must be a string')
    .trim(),
];

module.exports = {
  validateInput,
  validateQueueIdParam,
  validateEntryIdParam,
  validateDepartmentIdParam,
  validateCheckInInput,
};
