const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
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
      required: [true, 'Counter name is required'],
      trim: true,
      maxlength: [100, 'Counter name cannot exceed 100 characters'],
    },
    number: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['AVAILABLE', 'BUSY', 'OFFLINE'],
        message: 'Counter status must be AVAILABLE, BUSY, or OFFLINE',
      },
      default: 'OFFLINE',
    },
    assignedStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    currentQueueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      default: null,
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
counterSchema.index({ organizationId: 1 });
counterSchema.index({ locationId: 1 });
counterSchema.index({ departmentId: 1 });
counterSchema.index({ isActive: 1 });

// Ensure unique counter identity per department
counterSchema.index({ departmentId: 1, name: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
