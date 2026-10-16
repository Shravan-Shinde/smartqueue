const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    prefix: {
      type: String,
      trim: true,
      default: 'A',
      maxlength: [10, 'Prefix cannot exceed 10 characters'],
    },
    avgServiceTimeMins: {
      type: Number,
      default: 15,
      min: [1, 'Average service time must be at least 1 minute'],
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

// Database Indexes
departmentSchema.index({ organizationId: 1 });
departmentSchema.index({ locationId: 1 });
departmentSchema.index({ isActive: 1 });

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;
