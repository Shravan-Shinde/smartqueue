const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [150, 'Organization name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Organization description is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      lowercase: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'HOSPITAL',
        'BANK',
        'GOVERNMENT',
        'COLLEGE',
        'SALON',
        'RESTAURANT',
        'SERVICE_CENTER',
        'OTHER',
      ],
      default: 'OTHER',
    },
    logo: {
      type: String,
      default: null,
    },
    banner: {
      type: String,
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
organizationSchema.index({ category: 1 });
organizationSchema.index({ isActive: 1 });

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
