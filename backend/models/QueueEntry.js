const mongoose = require('mongoose');

const queueEntrySchema = new mongoose.Schema(
  {
    queueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      required: [true, 'Queue ID is required'],
    },
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
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required'],
    },
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      trim: true,
    },
    sequenceNumber: {
      type: Number,
      required: [true, 'Sequence number is required'],
      min: [1, 'Sequence number must be at least 1'],
    },
    sequenceDate: {
      type: String,
      required: [true, 'Sequence date is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
        message: 'Queue entry status must be WAITING, CALLED, SERVING, COMPLETED, NO_SHOW, or CANCELLED',
      },
      default: 'WAITING',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    calledAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    noShowAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    calledByCounterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counter',
      default: null,
    },
    calledByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    priority: {
      type: String,
      enum: {
        values: ['NORMAL', 'APPOINTMENT', 'PRIORITY', 'EMERGENCY'],
        message: 'Priority must be NORMAL, APPOINTMENT, PRIORITY, or EMERGENCY',
      },
      default: 'NORMAL',
    },
    priorityChangedAt: {
      type: Date,
      default: null,
    },
    priorityChangedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    previousPriority: {
      type: String,
      default: null,
    },
    qrToken: {
      type: String,
      default: null,
    },
    qrTokenCreatedAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
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
queueEntrySchema.index({ organizationId: 1 });
queueEntrySchema.index({ locationId: 1 });
queueEntrySchema.index({ departmentId: 1 });

// Fast lookup for customer active entry & historical queries
queueEntrySchema.index({ customerId: 1, isActive: 1 });
queueEntrySchema.index({ customerId: 1, status: 1, joinedAt: -1 });

// Fast lookup for queue position & ordering
queueEntrySchema.index({ queueId: 1, isActive: 1, sequenceNumber: 1 });
queueEntrySchema.index({ queueId: 1, isActive: 1, status: 1, joinedAt: 1 });

// Unique Index for non-null QR Token lookup
queueEntrySchema.index(
  { qrToken: 1 },
  { unique: true, partialFilterExpression: { qrToken: { $type: 'string' } } }
);

// Partial Unique Index: Prevent multiple active WAITING entries for the same customer in the same queue
queueEntrySchema.index(
  { queueId: 1, customerId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Index for counter attribution & analytics aggregation
queueEntrySchema.index({ calledByCounterId: 1, status: 1 });

// Compound indexes for date-range analytics and historical aggregations
queueEntrySchema.index({ organizationId: 1, createdAt: -1 });
queueEntrySchema.index({ queueId: 1, createdAt: -1 });


const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);

module.exports = QueueEntry;
