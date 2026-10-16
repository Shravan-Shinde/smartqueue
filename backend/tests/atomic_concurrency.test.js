const http = require('http');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

const { callNext } = require('../controllers/staffController');
const { assignStaffToCounter } = require('../controllers/adminCounterQueueController');

const runConcurrencyTest = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE — ATOMIC QUEUE CONCURRENCY VERIFICATION');
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
    await connectDB();

    // 1. Cleanup Test Records
    await Organization.deleteMany({ slug: 'concurrency-test-org' });
    await User.deleteMany({ email: { $regex: /concurrency.*@test\.com/ } });

    // 2. Create Users
    const staffA = await User.create({
      name: 'Concurrency Staff A',
      email: 'concurrencystaffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffB = await User.create({
      name: 'Concurrency Staff B',
      email: 'concurrencystaffb@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customer1 = await User.create({
      name: 'Concurrency Customer 1',
      email: 'concurrencyc1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Concurrency Customer 2',
      email: 'concurrencyc2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    // 3. Create Org Hierarchy
    const org = await Organization.create({
      name: 'Concurrency Test Bank',
      description: 'Concurrency test bank facility',
      slug: 'concurrency-test-org',
      category: 'BANK',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Branch',
      address: '100 Concurrency St',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Teller Services',
      prefix: 'CONC',
      avgServiceTimeMins: 5,
      isActive: true,
    });

    const counter1 = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Counter 01',
      number: 'C1',
      status: 'AVAILABLE',
      isActive: true,
    });

    const counter2 = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Counter 02',
      number: 'C2',
      status: 'AVAILABLE',
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Atomic Concurrency Queue',
      prefix: 'CONC',
      avgServiceTimeMins: 5,
      maxCapacity: 20,
      status: 'OPEN',
      isActive: true,
    });

    // Assign Staff to Counters
    await assignStaffToCounter(
      { params: { counterId: counter1._id.toString() }, body: { staffUserId: staffA._id.toString() } },
      { status: () => ({ json: () => {} }) }
    );
    await assignStaffToCounter(
      { params: { counterId: counter2._id.toString() }, body: { staffUserId: staffB._id.toString() } },
      { status: () => ({ json: () => {} }) }
    );

    // Create 2 Waiting Tickets
    const todayStr = new Date().toISOString().split('T')[0];
    const ticket1 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'CONC-001',
      sequenceNumber: 1,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      isActive: true,
    });

    const ticket2 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      customerId: customer2._id,
      ticketNumber: 'CONC-002',
      sequenceNumber: 2,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      isActive: true,
    });

    // Mock Express Req/Res objects
    const reqA = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { queueId: queue._id.toString() } };
    const resA = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    const reqB = { user: { id: staffB._id.toString(), role: 'STAFF' }, params: { queueId: queue._id.toString() } };
    const resB = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    // 4. Issue SIMULTANEOUS CONCURRENT callNext requests
    console.log('[TEST] Executing 2 concurrent callNext requests against MongoDB...');
    await Promise.all([callNext(reqA, resA), callNext(reqB, resB)]);

    const ticket1Claimed = resA.responseData?.data?.ticketNumber;
    const ticket2Claimed = resB.responseData?.data?.ticketNumber;

    console.log(`  • Request A Claimed: ${ticket1Claimed} (HTTP ${resA.statusCode})`);
    console.log(`  • Request B Claimed: ${ticket2Claimed} (HTTP ${resB.statusCode})`);

    assert(resA.statusCode === 200 && resB.statusCode === 200, 'Both concurrent requests succeed with HTTP 200');
    assert(ticket1Claimed !== ticket2Claimed, 'Request A and Request B claimed DISTINCT tickets (No double-claim)');
    assert(
      (ticket1Claimed === 'CONC-001' && ticket2Claimed === 'CONC-002') ||
        (ticket1Claimed === 'CONC-002' && ticket2Claimed === 'CONC-001'),
      'Both waiting tickets CONC-001 and CONC-002 were claimed atomically without race conditions'
    );

    // Verify DB state
    const dbTicket1 = await QueueEntry.findById(ticket1._id);
    const dbTicket2 = await QueueEntry.findById(ticket2._id);

    assert(dbTicket1.status === 'CALLED' && dbTicket2.status === 'CALLED', 'MongoDB reflects CALLED status for both claimed entries');
    assert(
      dbTicket1.calledByCounterId.toString() !== dbTicket2.calledByCounterId.toString(),
      'Each ticket is attributed to a unique counter'
    );

    // 5. Cleanup
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, customer1._id, customer2._id] } });

    console.log('\n====================================================');
    console.log(`ATOMIC CONCURRENCY RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('[CONCURRENCY TEST FATAL ERROR]', err);
    process.exit(1);
  }
};

runConcurrencyTest();
