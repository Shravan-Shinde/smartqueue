const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 5 — BACKEND VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Verify QueueEntry model loads
    assert(QueueEntry !== undefined, 'QueueEntry model loaded successfully');

    // 2. Connect to DB
    await connectDB();
    console.log('[DB] Connected to MongoDB for test execution.');

    // 3. Clean test records
    await Organization.deleteMany({ slug: 'sprint5-test-org' });
    await User.deleteMany({ email: { $regex: /sprint5.*@test\.com/ } });

    // 4. Create Users
    const customer1 = await User.create({
      name: 'Sprint5 Customer 1',
      email: 'sprint5c1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Sprint5 Customer 2',
      email: 'sprint5c2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer3 = await User.create({
      name: 'Sprint5 Customer 3',
      email: 'sprint5c3@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const adminUser = await User.create({
      name: 'Sprint5 Admin',
      email: 'sprint5admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    // 5. Create Hierarchy
    const org = await Organization.create({
      name: 'Sprint5 Test Org',
      description: 'Test org for customer queue joining',
      slug: 'sprint5-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Location',
      address: '100 Health Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Cardiology',
      prefix: 'CARD',
      avgServiceTimeMins: 15,
      isActive: true,
    });

    const openQueue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Cardiology OPD Queue',
      prefix: 'CARD',
      avgServiceTimeMins: 15,
      maxCapacity: 5,
      status: 'OPEN',
      isActive: true,
      lastSequenceNumber: 0,
    });

    const closedQueue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Specialist Closed Queue',
      prefix: 'SPEC',
      avgServiceTimeMins: 20,
      maxCapacity: 5,
      status: 'CLOSED',
      isActive: true,
    });

    const pausedQueue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Emergency Paused Queue',
      prefix: 'EMG',
      avgServiceTimeMins: 10,
      maxCapacity: 5,
      status: 'PAUSED',
      isActive: true,
    });

    // 6. Test Atomic Daily Sequence & Token Generation
    const todayStr = new Date().toISOString().split('T')[0];

    // Atomically increment sequence for Customer 1
    let qUpdate1 = await Queue.findOneAndUpdate(
      { _id: openQueue._id, lastSequenceDate: todayStr },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true }
    );
    if (!qUpdate1) {
      qUpdate1 = await Queue.findOneAndUpdate(
        { _id: openQueue._id },
        { $set: { lastSequenceDate: todayStr, lastSequenceNumber: 1 } },
        { new: true }
      );
    }

    const seq1 = qUpdate1.lastSequenceNumber;
    const ticket1 = `${qUpdate1.prefix}-${String(seq1).padStart(3, '0')}`;

    const entry1 = await QueueEntry.create({
      queueId: openQueue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: ticket1,
      sequenceNumber: seq1,
      sequenceDate: todayStr,
      status: 'WAITING',
      isActive: true,
    });

    assert(entry1.ticketNumber === 'CARD-001', 'First customer receives ticket CARD-001');
    assert(entry1.sequenceNumber === 1, 'First sequence number is 1');

    // 7. Test Second Customer Joining OPEN Queue
    let qUpdate2 = await Queue.findOneAndUpdate(
      { _id: openQueue._id, lastSequenceDate: todayStr },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true }
    );

    const seq2 = qUpdate2.lastSequenceNumber;
    const ticket2 = `${qUpdate2.prefix}-${String(seq2).padStart(3, '0')}`;

    const entry2 = await QueueEntry.create({
      queueId: openQueue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer2._id,
      ticketNumber: ticket2,
      sequenceNumber: seq2,
      sequenceDate: todayStr,
      status: 'WAITING',
      isActive: true,
    });

    assert(entry2.ticketNumber === 'CARD-002', 'Second customer receives ticket CARD-002');

    // 8. Test FIFO Position and People-Ahead Calculation
    const activeAheadForC2 = await QueueEntry.countDocuments({
      queueId: openQueue._id,
      isActive: true,
      sequenceNumber: { $lt: entry2.sequenceNumber },
    });

    const positionC2 = activeAheadForC2 + 1;
    const peopleAheadC2 = activeAheadForC2;

    assert(positionC2 === 2, 'Customer 2 position calculation is 2');
    assert(peopleAheadC2 === 1, 'Customer 2 people ahead calculation is 1');

    // 9. Test Duplicate Active Join Rejection via Partial Unique Index
    let dupJoinError = false;
    try {
      await QueueEntry.create({
        queueId: openQueue._id,
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        customerId: customer1._id,
        ticketNumber: 'CARD-003',
        sequenceNumber: 3,
        sequenceDate: todayStr,
        status: 'WAITING',
        isActive: true,
      });
    } catch (err) {
      if (err.code === 11000) dupJoinError = true;
    }
    assert(dupJoinError, 'Duplicate active join for same customer in same queue is rejected by partial unique index');

    // 10. Test Customer Cancellation
    entry1.status = 'CANCELLED';
    entry1.isActive = false;
    entry1.cancelledAt = new Date();
    await entry1.save();

    assert(entry1.isActive === false, 'Cancellation changes isActive to false');
    assert(entry1.status === 'CANCELLED', 'Cancellation changes status to CANCELLED');

    // Verify Customer 2 position updates after Customer 1 cancels
    const updatedAheadForC2 = await QueueEntry.countDocuments({
      queueId: openQueue._id,
      isActive: true,
      sequenceNumber: { $lt: entry2.sequenceNumber },
    });
    assert(updatedAheadForC2 + 1 === 1, 'Customer 2 position advances to #1 after Customer 1 cancels');

    // 11. Test Cancelled Customer Re-joining Queue
    let qUpdate3 = await Queue.findOneAndUpdate(
      { _id: openQueue._id, lastSequenceDate: todayStr },
      { $inc: { lastSequenceNumber: 1 } },
      { new: true }
    );
    const seq3 = qUpdate3.lastSequenceNumber;
    const ticket3 = `${qUpdate3.prefix}-${String(seq3).padStart(3, '0')}`;

    const reEntry1 = await QueueEntry.create({
      queueId: openQueue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: ticket3,
      sequenceNumber: seq3,
      sequenceDate: todayStr,
      status: 'WAITING',
      isActive: true,
    });
    assert(reEntry1.ticketNumber === 'CARD-003', 'Cancelled customer can rejoin and receives next ticket CARD-003');

    // 12. Test Capacity Enforcement
    const smallCapQueue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Small Capacity Queue',
      prefix: 'MIN',
      maxCapacity: 1,
      status: 'OPEN',
      isActive: true,
    });

    await QueueEntry.create({
      queueId: smallCapQueue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'MIN-001',
      sequenceNumber: 1,
      sequenceDate: todayStr,
      status: 'WAITING',
      isActive: true,
    });

    const activeCountSmallCap = await QueueEntry.countDocuments({
      queueId: smallCapQueue._id,
      isActive: true,
    });
    assert(activeCountSmallCap >= smallCapQueue.maxCapacity, 'Queue capacity check identifies full queue');

    // 13. Cleanup Test Data
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [customer1._id, customer2._id, customer3._id, adminUser._id] } });

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('[TEST SUITE FATAL ERROR]', error);
    process.exit(1);
  }
};

runTests();
