const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
      maxlength: [150, 'Location name cannot exceed 150 characters'],
    },
    address: {
      type: String,
      required: [true, 'Location address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },
    postalCode: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
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

// Database Indexes
locationSchema.index({ organizationId: 1 });
locationSchema.index({ city: 1 });
locationSchema.index({ isActive: 1 });

const Location = mongoose.model('Location', locationSchema);

module.exports = Location;
