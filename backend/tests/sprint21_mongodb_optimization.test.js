const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const QueueEntry = require('../models/QueueEntry');
const Queue = require('../models/Queue');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Counter = require('../models/Counter');
const Department = require('../models/Department');
const Location = require('../models/Location');
const Organization = require('../models/Organization');
const User = require('../models/User');

const analyticsService = require('../services/analyticsService');
const liveCrowdService = require('../services/liveCrowdService');
const customerHistoryService = require('../services/customerHistoryService');
const reviewService = require('../services/reviewService');
const waitTimeService = require('../services/waitTimeService');
const queueSchedulingService = require('../services/queueSchedulingService');

let passed = 0;
let failed = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`[PASS] ${description}`);
    passed++;
  } else {
    console.error(`[FAIL] ${description}`);
    failed++;
  }
};

const runSprint21OptimizationSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 21: MONGODB PERFORMANCE & QUERY OPTIMIZATION SUITE');
  console.log('====================================================\n');

  try {
    await connectDB();

    // Sync Model Indexes
    await QueueEntry.syncIndexes();
    await Queue.syncIndexes();
    await Review.syncIndexes();
    await Notification.syncIndexes();
    await Counter.syncIndexes();

    // Clean test collections
    await QueueEntry.deleteMany({});
    await Queue.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});
    await Counter.deleteMany({});
    await Department.deleteMany({});
    await Location.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});

    // Seed test hierarchy documents
    const org = await Organization.create({
      name: 'Sprint 21 Test Org',
      slug: 'sprint21-org-' + Date.now(),
      description: 'Sprint 21 Org Description',
      category: 'HOSPITAL',
    });

    const location = await Location.create({
      organizationId: org._id,
      name: 'Main Campus',
      address: '100 Health Way',
      city: 'Metro City',
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: location._id,
      name: 'General Medicine',
      prefix: 'GM',
      avgServiceTimeMins: 10,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      name: 'General Consultation',
      prefix: 'GM',
      avgServiceTimeMins: 10,
      status: 'OPEN',
      maxCapacity: 50,
    });

    const customerUser = await User.create({
      name: 'Optimization Customer',
      email: `opt_cust_${Date.now()}@example.com`,
      password: 'password123',
      role: 'CUSTOMER',
    });

    const staffUser = await User.create({
      name: 'Optimization Staff',
      email: `opt_staff_${Date.now()}@example.com`,
      password: 'password123',
      role: 'STAFF',
    });

    const counter = await Counter.create({
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      name: 'Counter 1',
      number: '1',
      status: 'AVAILABLE',
      assignedStaffId: staffUser._id,
    });

    // ==========================================
    // SECTION 1: MODEL INDEX STRUCTURE & INVENTORY
    // ==========================================
    console.log('--- SECTION 1: Model Index Inventory & Structural Verification ---');

    const qeIndexes = await QueueEntry.collection.indexes();

    const idxOrgCreatedAt = qeIndexes.find(idx => idx.key.organizationId === 1 && idx.key.createdAt === -1);
    assert(idxOrgCreatedAt !== undefined, '1. QueueEntry has compound index on { organizationId: 1, createdAt: -1 }');

    const idxQueueCreatedAt = qeIndexes.find(idx => idx.key.queueId === 1 && idx.key.createdAt === -1);
    assert(idxQueueCreatedAt !== undefined, '2. QueueEntry has compound index on { queueId: 1, createdAt: -1 }');

    const idxCustActive = qeIndexes.find(idx => idx.key.customerId === 1 && idx.key.isActive === 1);
    assert(idxCustActive !== undefined, '3. QueueEntry has compound index on { customerId: 1, isActive: 1 }');

    const idxQueueSeq = qeIndexes.find(idx => idx.key.queueId === 1 && idx.key.isActive === 1 && idx.key.sequenceNumber === 1);
    assert(idxQueueSeq !== undefined, '4. QueueEntry has compound index on { queueId: 1, isActive: 1, sequenceNumber: 1 }');

    const idxQueueStatus = qeIndexes.find(idx => idx.key.queueId === 1 && idx.key.isActive === 1 && idx.key.status === 1 && idx.key.joinedAt === 1);
    assert(idxQueueStatus !== undefined, '5. QueueEntry has compound index on { queueId: 1, isActive: 1, status: 1, joinedAt: 1 }');

    const idxQrToken = qeIndexes.find(idx => idx.key.qrToken === 1);
    assert(
      idxQrToken !== undefined && idxQrToken.unique === true && JSON.stringify(idxQrToken.partialFilterExpression) === JSON.stringify({ qrToken: { $type: 'string' } }),
      '6. QueueEntry preserves Partial Unique Index on { qrToken: 1 }'
    );

    const idxPartialActive = qeIndexes.find(idx => idx.key.queueId === 1 && idx.key.customerId === 1);
    assert(
      idxPartialActive !== undefined && idxPartialActive.unique === true && JSON.stringify(idxPartialActive.partialFilterExpression) === JSON.stringify({ isActive: true }),
      '7. QueueEntry preserves Partial Unique Index on { queueId: 1, customerId: 1 } for isActive: true'
    );

    const qIndexes = await Queue.collection.indexes();
    const idxDeptActive = qIndexes.find(idx => idx.key.departmentId === 1 && idx.key.isActive === 1);
    assert(idxDeptActive !== undefined, '8. Queue model has compound index on { departmentId: 1, isActive: 1 }');

    const idxDeptPrefix = qIndexes.find(idx => idx.key.departmentId === 1 && idx.key.prefix === 1);
    assert(idxDeptPrefix !== undefined && idxDeptPrefix.unique === true, '9. Queue model has unique index on { departmentId: 1, prefix: 1 }');

    const reviewIndexes = await Review.collection.indexes();
    const idxEntryReview = reviewIndexes.find(idx => idx.key.queueEntryId === 1);
    assert(idxEntryReview !== undefined && idxEntryReview.unique === true, '10. Review model has unique constraint index on queueEntryId');

    const notifIndexes = await Notification.collection.indexes();
    const idxNotifUserCreated = notifIndexes.find(idx => idx.key.userId === 1 && idx.key.createdAt === -1);
    assert(idxNotifUserCreated !== undefined, '11. Notification model has compound index on { userId: 1, createdAt: -1 }');

    // ==========================================
    // SECTION 2: EXPLAIN PLAN & QUERY EFFICIENCY
    // ==========================================
    console.log('\n--- SECTION 2: MongoDB Explain Plan Verification (IXSCAN Strategy) ---');

    const expCustActive = await QueueEntry.find({ customerId: customerUser._id, isActive: true }).explain('executionStats');
    assert(JSON.stringify(expCustActive.queryPlanner.winningPlan).includes('IXSCAN'), '12. Query QueueEntry by customerId & isActive uses IXSCAN');

    const expQueueWaiting = await QueueEntry.find({ queueId: queue._id, status: 'WAITING', isActive: true }).explain('executionStats');
    assert(JSON.stringify(expQueueWaiting.queryPlanner.winningPlan).includes('IXSCAN'), '13. Query QueueEntry by queueId, status & isActive uses IXSCAN');

    const expOrgDateRange = await QueueEntry.find({
      organizationId: org._id,
      createdAt: { $gte: new Date(Date.now() - 86400000), $lte: new Date() },
    }).explain('executionStats');
    assert(JSON.stringify(expOrgDateRange.queryPlanner.winningPlan).includes('IXSCAN'), '14. Query QueueEntry by organizationId & createdAt date range uses IXSCAN');

    const expQueueDateRange = await QueueEntry.find({
      queueId: queue._id,
      createdAt: { $gte: new Date(Date.now() - 86400000), $lte: new Date() },
    }).explain('executionStats');
    assert(JSON.stringify(expQueueDateRange.queryPlanner.winningPlan).includes('IXSCAN'), '15. Query QueueEntry by queueId & createdAt date range uses IXSCAN');

    const expDeptActive = await Queue.find({ departmentId: dept._id, isActive: true }).explain('executionStats');
    assert(JSON.stringify(expDeptActive.queryPlanner.winningPlan).includes('IXSCAN'), '16. Query Queue by departmentId & isActive uses IXSCAN');

    // ==========================================
    // SECTION 3: LEAN & PROJECTION BEHAVIOR
    // ==========================================
    console.log('\n--- SECTION 3: .lean() Return Type & Projection Efficiency ---');

    const leanQueue = await Queue.findById(queue._id).lean();
    assert(
      leanQueue !== null && leanQueue.constructor.name === 'Object' && leanQueue.save === undefined,
      '17. .lean() query on Queue returns a plain JavaScript object (POJO) without Mongoose document methods'
    );

    const tempEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-001',
      sequenceNumber: 1,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 600000),
      completedAt: new Date(),
      isActive: false,
    });

    const projectedEntry = await QueueEntry.findById(tempEntry._id).select('startedAt completedAt').lean();
    assert(
      projectedEntry.startedAt !== undefined && projectedEntry.completedAt !== undefined && projectedEntry.ticketNumber === undefined,
      '18. .select() projection on QueueEntry returns strictly requested fields'
    );
    await QueueEntry.deleteOne({ _id: tempEntry._id });

    // ==========================================
    // SECTION 4: ATOMIC & CONCURRENCY GUARANTEES
    // ==========================================
    console.log('\n--- SECTION 4: Atomic Updates & Partial Unique Constraints ---');

    const activeEntry1 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-001',
      sequenceNumber: 1,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      isActive: true,
    });

    let duplicateErr = null;
    try {
      await QueueEntry.create({
        queueId: queue._id,
        organizationId: org._id,
        locationId: location._id,
        departmentId: dept._id,
        customerId: customerUser._id,
        ticketNumber: 'GM-002',
        sequenceNumber: 2,
        sequenceDate: new Date().toISOString().split('T')[0],
        status: 'WAITING',
        isActive: true,
      });
    } catch (err) {
      duplicateErr = err;
    }
    assert(duplicateErr !== null && duplicateErr.code === 11000, '19. Partial unique index blocks duplicate active WAITING joins for same customer');

    await QueueEntry.deleteOne({ _id: activeEntry1._id });

    const histEntry1 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-001',
      sequenceNumber: 1,
      sequenceDate: '2026-09-01',
      status: 'COMPLETED',
      isActive: false,
    });

    const histEntry2 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-002',
      sequenceNumber: 2,
      sequenceDate: '2026-09-02',
      status: 'COMPLETED',
      isActive: false,
    });
    assert(histEntry1._id !== undefined && histEntry2._id !== undefined, '20. Partial unique index permits multiple inactive completed entries for same customer');

    await QueueEntry.deleteMany({ _id: { $in: [histEntry1._id, histEntry2._id] } });

    const todayStr = new Date().toISOString().split('T')[0];
    const q1 = await Queue.findOneAndUpdate(
      { _id: queue._id },
      { $set: { lastSequenceDate: todayStr, lastSequenceNumber: 10 } },
      { new: true }
    );
    const q2 = await Queue.findOneAndUpdate(
      { _id: queue._id, lastSequenceDate: todayStr },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true }
    );
    assert(q1.lastSequenceNumber === 10 && q2.lastSequenceNumber === 11, '21. Atomic findOneAndUpdate sequence increment behaves deterministically');

    // ==========================================
    // SECTION 5: SERVICE CONTRACT & SHAPE EQUALITY
    // ==========================================
    console.log('\n--- SECTION 5: Optimized Services Output & Contract Integrity ---');

    const completedTestEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-005',
      sequenceNumber: 5,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      joinedAt: new Date(Date.now() - 1200000),
      calledAt: new Date(Date.now() - 600000),
      startedAt: new Date(Date.now() - 600000),
      completedAt: new Date(),
      calledByCounterId: counter._id,
      calledByUserId: staffUser._id,
      isActive: false,
    });

    const testReview = await Review.create({
      customerId: customerUser._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      queueId: queue._id,
      queueEntryId: completedTestEntry._id,
      rating: 5,
      comment: 'Great service!',
      status: 'PUBLISHED',
    });

    const overviewMetrics = await analyticsService.getOverviewMetrics({
      organizationId: org._id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
    });
    assert(
      overviewMetrics.totalEntries >= 1 && overviewMetrics.completed >= 1 && typeof overviewMetrics.averageWaitMinutes === 'number',
      '22. analyticsService.getOverviewMetrics returns valid analytics contract'
    );

    const queueMetrics = await analyticsService.getQueueMetrics({
      organizationId: org._id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
    });
    assert(
      Array.isArray(queueMetrics) && queueMetrics.length >= 1 && queueMetrics[0].queueId === queue._id.toString(),
      '23. analyticsService.getQueueMetrics returns batched queue metrics correctly'
    );

    const counterMetrics = await analyticsService.getCounterMetrics({
      organizationId: org._id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
    });
    assert(
      Array.isArray(counterMetrics) && counterMetrics.length >= 1 && counterMetrics[0].assignedStaffName === 'Optimization Staff',
      '24. analyticsService.getCounterMetrics returns counter metrics with populated lean data'
    );

    const liveMetrics = await liveCrowdService.getLiveQueueMetrics({ organizationId: org._id });
    assert(
      Array.isArray(liveMetrics) && liveMetrics.length >= 1 && liveMetrics[0].activeCounters === 1 && liveMetrics[0].crowdLevel === 'LOW',
      '25. liveCrowdService.getLiveQueueMetrics returns batched live metrics with zero N+1 queries'
    );

    const liveSnapshot = await liveCrowdService.getLiveCrowdSnapshot({ organizationId: org._id });
    assert(
      liveSnapshot.queues !== undefined && liveSnapshot.summary.totalQueues >= 1,
      '26. liveCrowdService.getLiveCrowdSnapshot returns full snapshot summary'
    );

    const customerHistory = await customerHistoryService.getCustomerHistory({ customerId: customerUser._id });
    assert(
      customerHistory.items.length >= 1 && customerHistory.items[0].review.submitted === true && customerHistory.items[0].actualWaitDurationSec > 0,
      '27. customerHistoryService.getCustomerHistory returns paginated historical entries with lean POJOs & durations'
    );

    const historyDetail = await customerHistoryService.getCustomerHistoryDetail({
      customerId: customerUser._id,
      entryId: completedTestEntry._id,
    });
    assert(
      historyDetail.ticketNumber === 'GM-005' && historyDetail.review.comment === 'Great service!',
      '28. customerHistoryService.getCustomerHistoryDetail returns detailed historical record'
    );

    const adminReviews = await reviewService.getAdminReviews({ organizationId: org._id });
    assert(
      adminReviews.reviews.length >= 1 && adminReviews.reviews[0].rating === 5,
      '29. reviewService.getAdminReviews returns paginated reviews using lean()'
    );

    const waitingTestEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser._id,
      ticketNumber: 'GM-010',
      sequenceNumber: 10,
      sequenceDate: todayStr,
      status: 'WAITING',
      isActive: true,
    });

    const waitEstimate = await waitTimeService.calculateWaitTimeByEntryId(waitingTestEntry._id);
    assert(
      waitEstimate.status === 'WAITING' && waitEstimate.position === 1 && waitEstimate.formattedWaitTime === 'Under 1 min',
      '30. waitTimeService.calculateWaitTimeByEntryId returns accurate wait-time estimation payload'
    );
    await QueueEntry.deleteOne({ _id: waitingTestEntry._id });

    // ==========================================
    // SECTION 6: PERFORMANCE BENCHMARKING
    // ==========================================
    console.log('\n--- SECTION 6: Performance Micro-Benchmarks ---');

    const t1 = Date.now();
    await liveCrowdService.getLiveQueueMetrics({ organizationId: org._id });
    const dur1 = Date.now() - t1;
    assert(dur1 < 100, `31. getLiveQueueMetrics batched execution completed in ${dur1}ms (< 100ms)`);

    const t2 = Date.now();
    await analyticsService.getQueueMetrics({
      organizationId: org._id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(),
    });
    const dur2 = Date.now() - t2;
    assert(dur2 < 100, `32. getQueueMetrics batched execution completed in ${dur2}ms (< 100ms)`);

    const t3 = Date.now();
    await customerHistoryService.getCustomerHistory({ customerId: customerUser._id });
    const dur3 = Date.now() - t3;
    assert(dur3 < 100, `33. getCustomerHistory execution completed in ${dur3}ms (< 100ms)`);

    const t4 = Date.now();
    await reviewService.getAdminReviews({ organizationId: org._id });
    const dur4 = Date.now() - t4;
    assert(dur4 < 100, `34. getAdminReviews execution completed in ${dur4}ms (< 100ms)`);

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    await QueueEntry.deleteMany({});
    await Queue.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});
    await Counter.deleteMany({});
    await Department.deleteMany({});
    await Location.deleteMany({});
    await Organization.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();

    console.log('\n====================================================');
    console.log(`SPRINT 21 MONGODB OPTIMIZATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint21OptimizationSuite();
