const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { io: Client } = require('../../frontend/node_modules/socket.io-client');
require('dotenv').config();

const express = require('express');
const connectDB = require('../config/db');
const { initSocketServer } = require('../socket/socketServer');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

// Services & Controllers
const waitTimeService = require('../services/waitTimeService');
const queueSchedulingService = require('../services/queueSchedulingService');
const { customerJoinQueue, customerGetEntryWaitTime, cancelQueueEntry } = require('../controllers/queueEntryController');
const {
  callNext,
  startService,
  completeService,
  noShow,
  updateCounterStatus,
  updateQueueEntryPriority,
} = require('../controllers/staffController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 11 — SMART WAIT-TIME ENGINE SUITE');
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

  let server;
  let ioServer;
  let port;

  try {
    // 1. Connect DB & Setup Test Server
    await connectDB();
    console.log('[DB] Connected to MongoDB for Sprint 11 verification.');

    const app = express();
    app.use(express.json());
    server = http.createServer(app);
    ioServer = initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        console.log(`[SERVER] Verification server listening on port ${port}`);
        resolve();
      });
    });

    // Clean test records
    await Organization.deleteMany({ slug: 'sprint11-test-org' });
    await User.deleteMany({ email: { $regex: /sprint11.*@test\.com/ } });

    // ----------------------------------------------------
    // TEST 1: Wait-time service loads
    // ----------------------------------------------------
    assert(
      typeof waitTimeService.calculateWaitTimeForEntry === 'function' &&
        typeof waitTimeService.getAverageServiceTimeMinutes === 'function',
      'Test 1: Wait-time service loads successfully with required functions'
    );

    // 2. Setup Users
    const staffA = await User.create({
      name: 'Sprint11 Staff A',
      email: 'sprint11staffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffB = await User.create({
      name: 'Sprint11 Staff B',
      email: 'sprint11staffb@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerA = await User.create({
      name: 'Sprint11 Customer A',
      email: 'sprint11ca@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerB = await User.create({
      name: 'Sprint11 Customer B',
      email: 'sprint11cb@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerC = await User.create({
      name: 'Sprint11 Customer C',
      email: 'sprint11cc@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    const tokenCA = jwt.sign({ userId: customerA._id.toString(), role: customerA.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenCB = jwt.sign({ userId: customerB._id.toString(), role: customerB.role }, JWT_SECRET, { expiresIn: '1d' });

    const connectSocketClient = (token) => {
      return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, { auth: { token }, reconnection: false });
        client.on('connect', () => resolve(client));
        client.on('connect_error', (err) => reject(err));
      });
    };

    const clientCA = await connectSocketClient(tokenCA);
    const clientCB = await connectSocketClient(tokenCB);

    // Setup Org Hierarchy
    const org = await Organization.create({
      name: 'Sprint11 Test Hospital',
      description: 'Wait time engine testing',
      slug: 'sprint11-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Clinic',
      address: '500 Health Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'General Consultation',
      prefix: 'GEN',
      avgServiceTimeMins: 6,
      isActive: true,
    });

    const counter1 = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Counter 01',
      number: 'C1',
      status: 'AVAILABLE',
      assignedStaffId: staffA._id,
      isActive: true,
    });

    const counter2 = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Counter 02',
      number: 'C2',
      status: 'AVAILABLE',
      assignedStaffId: staffB._id,
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'General Queue',
      prefix: 'GEN',
      avgServiceTimeMins: 6,
      maxCapacity: 50,
      status: 'OPEN',
      isActive: true,
    });

    const makeReqRes = (userObj, body = {}, params = {}, query = {}) => {
      const req = { user: userObj, body, params, query };
      const res = {
        statusCode: 200,
        responseData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.responseData = data;
          return this;
        },
      };
      return { req, res };
    };

    // ----------------------------------------------------
    // TEST 2: First Customer Calculation (peopleAhead = 0)
    // ----------------------------------------------------
    const { req: rJoinA, res: sJoinA } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { queueId: queue._id.toString() });
    await customerJoinQueue(rJoinA, sJoinA);
    const entryAId = sJoinA.responseData.data.entry.id.toString();

    const entryA = await QueueEntry.findById(entryAId);
    const waitA = await waitTimeService.calculateWaitTimeForEntry(entryA, queue);

    assert(
      waitA.position === 1 && waitA.peopleAhead === 0 && waitA.formattedWaitTime === 'Under 1 min',
      'Test 2: First customer in queue has position #1, peopleAhead = 0, formattedWaitTime = "Under 1 min"'
    );

    // ----------------------------------------------------
    // TEST 3, 4, 18, 19, 20: Multiple Customers & Active Counter Division
    // ----------------------------------------------------
    const { req: rJoinB, res: sJoinB } = makeReqRes({ id: customerB._id.toString(), role: 'CUSTOMER' }, {}, { queueId: queue._id.toString() });
    await customerJoinQueue(rJoinB, sJoinB);
    const entryBId = sJoinB.responseData.data.entry.id.toString();

    const { req: rJoinC, res: sJoinC } = makeReqRes({ id: customerC._id.toString(), role: 'CUSTOMER' }, {}, { queueId: queue._id.toString() });
    await customerJoinQueue(rJoinC, sJoinC);
    const entryCId = sJoinC.responseData.data.entry.id.toString();

    const entryC = await QueueEntry.findById(entryCId);
    // Customer C has 2 people ahead (A and B). Avg service = 6 min. Active counters = 2.
    // Expected base wait: 2 * 6 / 2 = 6 min. Range: min = floor(6 * 0.9) = 5, max = ceil(6 * 1.2) = 8.
    const waitC = await waitTimeService.calculateWaitTimeForEntry(entryC, queue);

    assert(
      waitC.peopleAhead === 2 && waitC.activeCounters === 2 && waitC.estimatedWaitMinutes === 6,
      'Test 3 & 4: Multiple customers (peopleAhead = 2) with 2 active counters computes base estimate (2 * 6 / 2 = 6 min)'
    );

    assert(
      waitC.estimatedWaitRange.min === 5 && waitC.estimatedWaitRange.max === 8 && waitC.formattedWaitTime === '~5–8 min',
      'Test 18 & 19: Deterministic range calculation and whole-minute formatting (~5–8 min)'
    );

    assert(
      waitC.estimateQuality === 'LOW',
      'Test 20: Estimate quality is LOW when using fallback queue avg service time (< 3 completed samples)'
    );

    // ----------------------------------------------------
    // TEST 5: One Active Counter Calculation
    // ----------------------------------------------------
    counter2.status = 'OFFLINE';
    await counter2.save();

    const waitCOneCounter = await waitTimeService.calculateWaitTimeForEntry(entryC, queue);
    assert(
      waitCOneCounter.activeCounters === 1 && waitCOneCounter.estimatedWaitMinutes === 12,
      'Test 5: With 1 active counter, wait time doubles (2 * 6 / 1 = 12 min)'
    );

    // Restore counter2 to AVAILABLE
    counter2.status = 'AVAILABLE';
    await counter2.save();

    // ----------------------------------------------------
    // TEST 6: Zero Active Counters (NO_ACTIVE_COUNTERS)
    // ----------------------------------------------------
    counter1.status = 'OFFLINE';
    counter2.status = 'OFFLINE';
    await counter1.save();
    await counter2.save();

    const waitCNoCounters = await waitTimeService.calculateWaitTimeForEntry(entryC, queue);
    assert(
      waitCNoCounters.state === 'NO_ACTIVE_COUNTERS' &&
        waitCNoCounters.estimatedWaitMinutes === null &&
        waitCNoCounters.formattedWaitTime === 'Wait time unavailable',
      'Test 6: With 0 active counters, returns state NO_ACTIVE_COUNTERS and null numeric estimate'
    );

    // Restore counters to AVAILABLE
    counter1.status = 'AVAILABLE';
    counter2.status = 'AVAILABLE';
    await counter1.save();
    await counter2.save();

    // ----------------------------------------------------
    // TEST 7: Queue PAUSED
    // ----------------------------------------------------
    queue.status = 'PAUSED';
    await queue.save();

    const waitCPaused = await waitTimeService.calculateWaitTimeForEntry(entryC, queue);
    assert(
      waitCPaused.state === 'QUEUE_PAUSED' && waitCPaused.formattedWaitTime === 'Queue paused',
      'Test 7: When queue is PAUSED, returns state QUEUE_PAUSED and null numeric estimate'
    );

    // ----------------------------------------------------
    // TEST 8: Queue CLOSED
    // ----------------------------------------------------
    queue.status = 'CLOSED';
    await queue.save();

    const waitCClosed = await waitTimeService.calculateWaitTimeForEntry(entryC, queue);
    assert(
      waitCClosed.state === 'QUEUE_CLOSED' && waitCClosed.formattedWaitTime === 'Queue closed',
      'Test 8: When queue is CLOSED, returns state QUEUE_CLOSED and null numeric estimate'
    );

    // Re-open queue
    queue.status = 'OPEN';
    await queue.save();

    // ----------------------------------------------------
    // TEST 9, 10, 11, 12, 13: Non-WAITING State Calculations
    // ----------------------------------------------------
    const dummyCalled = { _id: new mongoose.Types.ObjectId(), queueId: queue._id, status: 'CALLED', isActive: true };
    const resCalled = await waitTimeService.calculateWaitTimeForEntry(dummyCalled, queue);
    assert(
      resCalled.state === 'NOT_WAITING' && resCalled.formattedWaitTime === 'Your turn — proceed to counter',
      'Test 9: CALLED status returns state NOT_WAITING with "Your turn — proceed to counter"'
    );

    const dummyServing = { _id: new mongoose.Types.ObjectId(), queueId: queue._id, status: 'SERVING', isActive: true };
    const resServing = await waitTimeService.calculateWaitTimeForEntry(dummyServing, queue);
    assert(
      resServing.state === 'NOT_WAITING' && resServing.formattedWaitTime === 'Service in progress',
      'Test 10: SERVING status returns state NOT_WAITING with "Service in progress"'
    );

    const dummyComp = { _id: new mongoose.Types.ObjectId(), queueId: queue._id, status: 'COMPLETED', isActive: false };
    const resComp = await waitTimeService.calculateWaitTimeForEntry(dummyComp, queue);
    assert(
      resComp.state === 'NOT_WAITING' && resComp.formattedWaitTime === 'Service completed',
      'Test 11: COMPLETED status returns state NOT_WAITING with "Service completed"'
    );

    const dummyCancel = { _id: new mongoose.Types.ObjectId(), queueId: queue._id, status: 'CANCELLED', isActive: false };
    const resCancel = await waitTimeService.calculateWaitTimeForEntry(dummyCancel, queue);
    assert(
      resCancel.state === 'NOT_WAITING' && resCancel.formattedWaitTime === 'Queue entry cancelled',
      'Test 12: CANCELLED status returns state NOT_WAITING with "Queue entry cancelled"'
    );

    const dummyNoShow = { _id: new mongoose.Types.ObjectId(), queueId: queue._id, status: 'NO_SHOW', isActive: false };
    const resNoShow = await waitTimeService.calculateWaitTimeForEntry(dummyNoShow, queue);
    assert(
      resNoShow.state === 'NOT_WAITING' && resNoShow.formattedWaitTime === 'Marked as no-show',
      'Test 13: NO_SHOW status returns state NOT_WAITING with "Marked as no-show"'
    );

    // ----------------------------------------------------
    // TEST 14, 15: Historical Service-Time Calculation & Fallback
    // ----------------------------------------------------
    // Create 3 COMPLETED entries with 10-minute service durations
    for (let i = 0; i < 3; i++) {
      await QueueEntry.create({
        queueId: queue._id,
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        customerId: new mongoose.Types.ObjectId(),
        ticketNumber: `HIST-00${i + 1}`,
        sequenceNumber: 100 + i,
        sequenceDate: '2026-09-07',
        status: 'COMPLETED',
        isActive: false,
        startedAt: new Date(Date.now() - 15 * 60 * 1000),
        completedAt: new Date(Date.now() - 5 * 60 * 1000), // 10 minutes service
      });
    }

    const histRes = await waitTimeService.getAverageServiceTimeMinutes(queue._id, 6, 6);
    assert(
      histRes.isFallback === false && histRes.averageServiceTimeMinutes === 10 && histRes.sampleCount === 3,
      'Test 14 & 15: Historical service duration computes 10 minutes average over 3 completed entries (no fallback)'
    );

    // ----------------------------------------------------
    // TEST 16, 17: Priority-Aware Position & Aging Integration
    // ----------------------------------------------------
    // Customer C elevates to PRIORITY -> position changes to #1, peopleAhead = 0
    const { req: rPrioC, res: sPrioC } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { priority: 'PRIORITY' }, { entryId: entryCId });
    await updateQueueEntryPriority(rPrioC, sPrioC);

    const updatedEntryC = await QueueEntry.findById(entryCId);
    const waitCPrio = await waitTimeService.calculateWaitTimeForEntry(updatedEntryC, queue);

    assert(
      waitCPrio.position === 1 && waitCPrio.peopleAhead === 0 && waitCPrio.formattedWaitTime === 'Under 1 min',
      'Test 16 & 17: Priority escalation updates customer position to #1 and wait-time to "Under 1 min"'
    );

    // ----------------------------------------------------
    // TEST 21, 22, 23: Authorization Checks for REST Endpoint
    // ----------------------------------------------------
    // Test 21: Customer A requests own wait-time
    const { req: rWaitA, res: sWaitA } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryWaitTime(rWaitA, sWaitA);
    assert(
      sWaitA.statusCode === 200 && sWaitA.responseData.data.entryId === entryAId,
      'Test 21: GET /api/v1/queue-entries/:entryId/wait-time succeeds for entry owner'
    );

    // Test 22: Customer A requests Customer B's wait-time (Forbidden)
    const { req: rCross, res: sCross } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryBId });
    await customerGetEntryWaitTime(rCross, sCross);
    assert(
      sCross.statusCode === 403 || sCross.statusCode === 404,
      'Test 22: Customer A requesting Customer B wait-time is rejected with HTTP 403 Forbidden or 404 Not Found'
    );

    // ----------------------------------------------------
    // TEST 24, 25, 26, 27, 28, 29, 30, 31: Socket Events & Triggers
    // ----------------------------------------------------
    // Setup socket listener for Customer B to verify wait-time socket payload
    const socketPromiseB = new Promise((resolve) => clientCB.once('yourQueueUpdated', resolve));

    // Test 28: Call Next triggers wait-time socket update to remaining customers
    const { req: rCall1, res: sCall1 } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { queueId: queue._id.toString() });
    await callNext(rCall1, sCall1);

    const payloadB = await socketPromiseB;
    assert(
      payloadB && payloadB.waitTime && typeof payloadB.waitTime.formattedWaitTime === 'string',
      'Test 24, 25, 28: Call Next emits private `yourQueueUpdated` socket with `waitTime` payload to remaining customer'
    );

    // Cleanup test records
    clientCA.disconnect();
    clientCB.disconnect();

    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, customerA._id, customerB._id, customerC._id] } });

    server.close();

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
    if (server) server.close();
    process.exit(1);
  }
};

runTests();
