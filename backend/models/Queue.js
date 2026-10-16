const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: [true, 'Location ID is required'],
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Queue name is required'],
      trim: true,
      maxlength: [100, 'Queue name cannot exceed 100 characters'],
    },
    prefix: {
      type: String,
      required: [true, 'Queue prefix is required'],
      trim: true,
      uppercase: true,
      maxlength: [10, 'Prefix cannot exceed 10 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    avgServiceTimeMins: {
      type: Number,
      required: [true, 'Average service time is required'],
      default: 15,
      min: [1, 'Average service time must be at least 1 minute'],
      max: [480, 'Average service time cannot exceed 480 minutes'],
    },
    status: {
      type: String,
      enum: {
        values: ['OPEN', 'PAUSED', 'CLOSED'],
        message: 'Queue status must be OPEN, PAUSED, or CLOSED',
      },
      default: 'CLOSED',
    },
    maxCapacity: {
      type: Number,
      required: [true, 'Maximum capacity is required'],
      default: 100,
      min: [1, 'Maximum capacity must be at least 1'],
      max: [10000, 'Maximum capacity cannot exceed 10,000'],
    },
    lastSequenceNumber: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSequenceDate: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
queueSchema.index({ organizationId: 1 });
queueSchema.index({ locationId: 1 });
queueSchema.index({ departmentId: 1 });
queueSchema.index({ status: 1 });
queueSchema.index({ isActive: 1 });
queueSchema.index({ departmentId: 1, isActive: 1 });

// Ensure unique queue prefix per department
queueSchema.index({ departmentId: 1, prefix: 1 }, { unique: true });

const Queue = mongoose.model('Queue', queueSchema);

module.exports = Queue;
