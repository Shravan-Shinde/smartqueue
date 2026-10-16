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
const Notification = require('../models/Notification');

// Services & Controllers
const queueSchedulingService = require('../services/queueSchedulingService');
const { customerJoinQueue, cancelQueueEntry } = require('../controllers/queueEntryController');
const { assignStaffToCounter } = require('../controllers/adminCounterQueueController');
const {
  callNext,
  startService,
  completeService,
  noShow,
  updateQueueEntryPriority,
} = require('../controllers/staffController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 10 — PRIORITY SCHEDULING VERIFICATION SUITE');
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
    console.log('[DB] Connected to MongoDB for Sprint 10 verification.');

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
    await Organization.deleteMany({ slug: 'sprint10-test-org' });
    await User.deleteMany({ email: { $regex: /sprint10.*@test\.com/ } });

    // 2. Unit Testing queueSchedulingService Score Mapping & Aging Logic
    const baseNormal = queueSchedulingService.getBasePriorityScore('NORMAL');
    const baseAppt = queueSchedulingService.getBasePriorityScore('APPOINTMENT');
    const basePrio = queueSchedulingService.getBasePriorityScore('PRIORITY');
    const baseEmerg = queueSchedulingService.getBasePriorityScore('EMERGENCY');

    assert(
      baseNormal === 10 && baseAppt === 20 && basePrio === 30 && baseEmerg === 40,
      'Test 14: Base priority score mapping correct (NORMAL=10, APPOINTMENT=20, PRIORITY=30, EMERGENCY=40)'
    );

    // Aging bonus calculation (20 minutes waiting -> 20 * 0.5 = 10)
    const now = Date.now();
    const twentyMinsAgo = new Date(now - 20 * 60 * 1000);
    const bonus20 = queueSchedulingService.calculateAgingBonus(twentyMinsAgo, now);
    assert(bonus20 === 10, 'Test 15: Aging bonus calculation correct (20 mins * 0.5 = 10)');

    // Aging bonus capping (80 minutes waiting -> 80 * 0.5 = 40, capped at 30)
    const eightyMinsAgo = new Date(now - 80 * 60 * 1000);
    const bonusCap = queueSchedulingService.calculateAgingBonus(eightyMinsAgo, now);
    assert(bonusCap === 30, 'Test 16: Aging bonus capped at maximum 30');

    // Effective score calculation
    const dummyEntry = { priority: 'NORMAL', joinedAt: twentyMinsAgo };
    const effScore = queueSchedulingService.calculateEffectiveScore(dummyEntry, now);
    assert(effScore === 20, 'Test 17: Effective score calculation correct (10 base + 10 aging = 20)');

    // 3. Create Users (Staff A, Staff B, Customers A, B, C, Admin)
    const staffA = await User.create({
      name: 'Sprint10 Staff A',
      email: 'sprint10staffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffB = await User.create({
      name: 'Sprint10 Staff B',
      email: 'sprint10staffb@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerA = await User.create({
      name: 'Sprint10 Customer A',
      email: 'sprint10ca@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerB = await User.create({
      name: 'Sprint10 Customer B',
      email: 'sprint10cb@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerC = await User.create({
      name: 'Sprint10 Customer C',
      email: 'sprint10cc@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const admin = await User.create({
      name: 'Sprint10 Admin',
      email: 'sprint10admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    const tokenCA = jwt.sign({ userId: customerA._id.toString(), role: customerA.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenCB = jwt.sign({ userId: customerB._id.toString(), role: customerB.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenCC = jwt.sign({ userId: customerC._id.toString(), role: customerC.role }, JWT_SECRET, { expiresIn: '1d' });

    // Connect Customer Socket Clients
    const connectSocketClient = (token) => {
      return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, { auth: { token }, reconnection: false });
        client.on('connect', () => resolve(client));
        client.on('connect_error', (err) => reject(err));
      });
    };

    const clientCA = await connectSocketClient(tokenCA);
    const clientCB = await connectSocketClient(tokenCB);
    const clientCC = await connectSocketClient(tokenCC);

    // 4. Setup Org Hierarchy & Counters
    const org = await Organization.create({
      name: 'Sprint10 Test Hospital',
      description: 'Priority scheduling triage',
      slug: 'sprint10-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Emergency Center',
      address: '100 Health Blvd',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Triage Services',
      prefix: 'TRG',
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
      assignedStaffId: staffA._id,
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Emergency Triage Queue',
      prefix: 'TRG',
      avgServiceTimeMins: 5,
      maxCapacity: 20,
      status: 'OPEN',
      isActive: true,
    });

    // Helper for HTTP controller calls
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
    // TEST 1, 4: Customer Join Queue (Default Priority = NORMAL)
    // ----------------------------------------------------
    // Test 4: Customer attempts to send priority = EMERGENCY in body (server ignores and assigns NORMAL)
    const { req: rJoinA, res: sJoinA } = makeReqRes(
      { id: customerA._id.toString(), role: 'CUSTOMER' },
      { priority: 'EMERGENCY' },
      { queueId: queue._id.toString() }
    );
    await customerJoinQueue(rJoinA, sJoinA);

    assert(
      sJoinA.statusCode === 201 && sJoinA.responseData.data.entry.priority === 'NORMAL',
      'Test 1 & 4: Customer A joins queue; priority defaults to NORMAL (server rejects customer self-selected EMERGENCY)'
    );

    // Customer B & C join
    const { req: rJoinB, res: sJoinB } = makeReqRes(
      { id: customerB._id.toString(), role: 'CUSTOMER' },
      {},
      { queueId: queue._id.toString() }
    );
    await customerJoinQueue(rJoinB, sJoinB);

    const { req: rJoinC, res: sJoinC } = makeReqRes(
      { id: customerC._id.toString(), role: 'CUSTOMER' },
      {},
      { queueId: queue._id.toString() }
    );
    await customerJoinQueue(rJoinC, sJoinC);

    const entryAId = sJoinA.responseData.data.entry.id.toString();
    const entryBId = sJoinB.responseData.data.entry.id.toString();
    const entryCId = sJoinC.responseData.data.entry.id.toString();

    // ----------------------------------------------------
    // TEST 2, 3, 5, 11, 12, 13: Priority Change Validation & Security
    // ----------------------------------------------------
    // Test 3: Invalid priority label rejected
    const { req: rBadPrio, res: sBadPrio } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      { priority: 'SUPER_HIGH' },
      { entryId: entryCId }
    );
    await updateQueueEntryPriority(rBadPrio, sBadPrio);
    assert(sBadPrio.statusCode === 400, 'Test 3: Invalid priority label SUPER_HIGH is rejected with HTTP 400');

    // Test 12: Customer cannot access staff priority endpoint
    const { req: rCustPrio, res: sCustPrio } = makeReqRes(
      { id: customerA._id.toString(), role: 'CUSTOMER' },
      { priority: 'EMERGENCY' },
      { entryId: entryCId }
    );
    await updateQueueEntryPriority(rCustPrio, sCustPrio);
    assert(sCustPrio.statusCode === 403 || sCustPrio.statusCode === 404, 'Test 12: CUSTOMER attempting staff priority endpoint is rejected (403/404)');

    // Test 5 & 24 & 25 & 26: Staff elevates Customer C (TRG-003) to PRIORITY
    const cCSocketPromise = new Promise((resolve) => {
      clientCC.on('yourQueueUpdated', (data) => {
        if (data && data.priority === 'PRIORITY') {
          resolve(data);
        }
      });
    });
    const cCNotifPromise = new Promise((resolve) => {
      clientCC.on('notificationCreated', (notif) => {
        if (notif.type === 'QUEUE_PRIORITY_UPDATED') {
          resolve(notif);
        }
      });
    });

    const { req: rStaffPrioC, res: sStaffPrioC } = makeReqRes(

      { id: staffA._id.toString(), role: 'STAFF' },
      { priority: 'PRIORITY' },
      { entryId: entryCId }
    );
    await updateQueueEntryPriority(rStaffPrioC, sStaffPrioC);
    assert(
      sStaffPrioC.statusCode === 200 && sStaffPrioC.responseData.data.priority === 'PRIORITY',
      'Test 5: Staff A updates Customer C (TRG-003) priority to PRIORITY'
    );

    const socketDataC = await cCSocketPromise;
    assert(
      socketDataC && socketDataC.priority === 'PRIORITY' && socketDataC.position === 1,
      'Test 22 & 23 & 24: Customer C receives real-time `yourQueueUpdated` with updated priority PRIORITY and position #1'
    );

    const notifDataC = await cCNotifPromise;
    assert(
      notifDataC && notifDataC.type === 'QUEUE_PRIORITY_UPDATED',
      'Test 25 & 26: Customer C receives QUEUE_PRIORITY_UPDATED notification ("Your queue priority was updated to PRIORITY")'
    );

    // ----------------------------------------------------
    // TEST 18, 19, 20: Priority-Aware Call Next & Deterministic Tie-Breaking
    // ----------------------------------------------------
    // Initial Queue: A (NORMAL), B (NORMAL), C (PRIORITY)
    // Priority-aware Call Next should pick Customer C (TRG-003) first despite joining last!
    const { req: rCallNext1, res: sCallNext1 } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { queueId: queue._id.toString() }
    );
    await callNext(rCallNext1, sCallNext1);
    assert(
      sCallNext1.statusCode === 200 && sCallNext1.responseData.data.ticketNumber === 'TRG-003',
      'Test 18: Call Next selects Customer C (TRG-003) first because PRIORITY score (30) > NORMAL score (10)'
    );

    // Complete service for C
    const { req: rStartC, res: sStartC } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryCId });
    await startService(rStartC, sStartC);
    const { req: rCompC, res: sCompC } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryCId });
    await completeService(rCompC, sCompC);

    // Now test tie-breaking: A & B are both NORMAL. Customer A joined before Customer B.
    // Call Next should pick Customer A (TRG-001) due to earlier joinedAt.
    const { req: rCallNext2, res: sCallNext2 } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { queueId: queue._id.toString() }
    );
    await callNext(rCallNext2, sCallNext2);
    assert(
      sCallNext2.statusCode === 200 && sCallNext2.responseData.data.ticketNumber === 'TRG-001',
      'Test 19 & 20: Call Next tie-breaking selects Customer A (TRG-001) over Customer B due to earlier joinedAt & sequenceNumber'
    );

    // Start service for A
    const { req: rStartA, res: sStartA } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryAId });
    await startService(rStartA, sStartA);

    // ----------------------------------------------------
    // TEST 6, 7, 8, 9, 10: Reject Priority Change on Non-WAITING States
    // ----------------------------------------------------
    // Test 7: Cannot change priority for SERVING entry A
    const { req: rPrioServing, res: sPrioServing } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      { priority: 'EMERGENCY' },
      { entryId: entryAId }
    );
    await updateQueueEntryPriority(rPrioServing, sPrioServing);
    assert(
      sPrioServing.statusCode === 409,
      'Test 7: Updating priority for SERVING entry is rejected with HTTP 409 Conflict'
    );

    // Complete service for A
    const { req: rCompA, res: sCompA } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryAId });
    await completeService(rCompA, sCompA);

    // Test 8: Cannot change priority for COMPLETED entry A
    const { req: rPrioComp, res: sPrioComp } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      { priority: 'EMERGENCY' },
      { entryId: entryAId }
    );
    await updateQueueEntryPriority(rPrioComp, sPrioComp);
    assert(
      sPrioComp.statusCode === 409,
      'Test 8: Updating priority for COMPLETED entry is rejected with HTTP 409 Conflict'
    );

    // ----------------------------------------------------
    // TEST 21: Concurrent Call Next (Atomic Claim Safety)
    // ----------------------------------------------------
    const reqCon1 = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { queueId: queue._id.toString() });
    const reqCon2 = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { queueId: queue._id.toString() });

    await Promise.all([
      callNext(reqCon1.req, reqCon1.res),
      callNext(reqCon2.req, reqCon2.res),
    ]);

    const successCount = [reqCon1.res.statusCode, reqCon2.res.statusCode].filter((c) => c === 200).length;
    assert(
      successCount === 1,
      'Test 21: Concurrent Call Next calls atomically claim exactly 1 customer (no double claims)'
    );

    // Clean up
    clientCA.disconnect();
    clientCB.disconnect();
    clientCC.disconnect();

    await Notification.deleteMany({ userId: { $in: [customerA._id, customerB._id, customerC._id] } });
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, customerA._id, customerB._id, customerC._id, admin._id] } });

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
