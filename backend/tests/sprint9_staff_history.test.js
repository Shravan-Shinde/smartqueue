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

// Controllers
const { customerJoinQueue } = require('../controllers/queueEntryController');
const { assignStaffToCounter } = require('../controllers/adminCounterQueueController');
const {
  getMyCounter,
  updateCounterStatus,
  getWaitingQueue,
  callNext,
  startService,
  completeService,
  noShow,
  getStaffHistory,
  getStaffHistorySummary,
} = require('../controllers/staffController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 9 — STAFF HISTORY & COUNTER SUITE');
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
    // 1. Connect to DB & HTTP + Socket Server
    await connectDB();
    console.log('[DB] Connected to MongoDB for Sprint 9 verification.');

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

    // 2. Clean test records
    await Organization.deleteMany({ slug: 'sprint9-test-org' });
    await User.deleteMany({ email: { $regex: /sprint9.*@test\.com/ } });

    // 3. Create Users (Staff A, Staff B, Unassigned Staff, Customer 1, Customer 2, Admin)
    const staffA = await User.create({
      name: 'Sprint9 Staff A',
      email: 'sprint9staffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffB = await User.create({
      name: 'Sprint9 Staff B',
      email: 'sprint9staffb@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const unassignedStaff = await User.create({
      name: 'Sprint9 Unassigned Staff',
      email: 'sprint9unassigned@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customer1 = await User.create({
      name: 'Sprint9 Customer 1',
      email: 'sprint9c1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Sprint9 Customer 2',
      email: 'sprint9c2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const admin = await User.create({
      name: 'Sprint9 Admin',
      email: 'sprint9admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    // 4. Create Org Hierarchy & Counters
    const org = await Organization.create({
      name: 'Sprint9 Test Bank',
      description: 'Staff history verification bank',
      slug: 'sprint9-test-org',
      category: 'BANK',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Branch',
      address: '900 History Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Customer Service',
      prefix: 'CS',
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
      name: 'General Service Queue',
      prefix: 'CS',
      avgServiceTimeMins: 5,
      maxCapacity: 20,
      status: 'OPEN',
      isActive: true,
    });

    // Helper for mock HTTP requests
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
    // TEST 1 & 14 & 15 & 16: Counter Status Control Validation
    // ----------------------------------------------------

    // Test 16: Staff cannot manually set BUSY
    const { req: rBusy, res: sBusy } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'BUSY' });
    await updateCounterStatus(rBusy, sBusy);
    assert(sBusy.statusCode === 400, 'Test 16: STAFF manually requesting status BUSY is rejected with HTTP 400');

    // Test 14: Staff can set assigned counter OFFLINE
    const { req: rOff, res: sOff } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'OFFLINE' });
    await updateCounterStatus(rOff, sOff);
    assert(
      sOff.statusCode === 200 && sOff.responseData.data.status === 'OFFLINE',
      'Test 14: Staff A sets assigned Counter 01 to OFFLINE (HTTP 200)'
    );

    // Test 19: CALL NEXT rejected while counter OFFLINE
    const { req: rCallNextOff, res: sCallNextOff } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { queueId: queue._id.toString() }
    );
    await callNext(rCallNextOff, sCallNextOff);
    assert(
      sCallNextOff.statusCode === 409,
      'Test 19: Calling next customer while counter is OFFLINE is rejected with HTTP 409 Conflict'
    );

    // Test 15: Staff can return counter to AVAILABLE
    const { req: rAvail, res: sAvail } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'AVAILABLE' });
    await updateCounterStatus(rAvail, sAvail);
    assert(
      sAvail.statusCode === 200 && sAvail.responseData.data.status === 'AVAILABLE',
      'Test 15: Staff A sets assigned Counter 01 back to AVAILABLE (HTTP 200)'
    );

    // ----------------------------------------------------
    // TEST 20 & 21: Join Queue & Call Next Customer
    // ----------------------------------------------------
    const { req: rJoin1, res: sJoin1 } = makeReqRes(
      { id: customer1._id.toString(), role: 'CUSTOMER' },
      {},
      { queueId: queue._id.toString() }
    );
    await customerJoinQueue(rJoin1, sJoin1);

    const { req: rJoin2, res: sJoin2 } = makeReqRes(
      { id: customer2._id.toString(), role: 'CUSTOMER' },
      {},
      { queueId: queue._id.toString() }
    );
    await customerJoinQueue(rJoin2, sJoin2);

    assert(sJoin1.statusCode === 201 && sJoin2.statusCode === 201, 'Test 21: Customer 1 (CS-001) & Customer 2 (CS-002) join queue');

    // Test 20: CALL NEXT allowed while AVAILABLE
    const { req: rCall1, res: sCall1 } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { queueId: queue._id.toString() }
    );
    await callNext(rCall1, sCall1);
    assert(
      sCall1.statusCode === 200 && sCall1.responseData.data.ticketNumber === 'CS-001',
      'Test 20: Call next customer CS-001 succeeds when counter is AVAILABLE'
    );

    const entry1Id = sCall1.responseData.data._id.toString();

    // ----------------------------------------------------
    // TEST 17 & 18: Conflict on status change while customer active
    // ----------------------------------------------------
    // Test 17: Cannot go OFFLINE while customer active (CALLED/SERVING)
    const { req: rOffConflict, res: sOffConflict } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      { status: 'OFFLINE' }
    );
    await updateCounterStatus(rOffConflict, sOffConflict);
    assert(
      sOffConflict.statusCode === 409,
      'Test 17: Setting counter OFFLINE while customer is CALLED is rejected with HTTP 409 Conflict'
    );

    // Start service for entry 1
    const { req: rStart1, res: sStart1 } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { entryId: entry1Id }
    );
    await startService(rStart1, sStart1);
    assert(sStart1.statusCode === 200, 'Staff A starts service for CS-001 (CALLED -> SERVING)');

    // Test 18: Cannot become AVAILABLE while active customer being served
    const { req: rAvailConflict, res: sAvailConflict } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      { status: 'AVAILABLE' }
    );
    await updateCounterStatus(rAvailConflict, sAvailConflict);
    assert(
      sAvailConflict.statusCode === 409,
      'Test 18: Setting counter AVAILABLE while customer is SERVING is rejected with HTTP 409 Conflict'
    );

    // Complete service for entry 1
    const { req: rComp1, res: sComp1 } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      { entryId: entry1Id }
    );
    await completeService(rComp1, sComp1);
    assert(sComp1.statusCode === 200, 'Staff A completes service for CS-001 (SERVING -> COMPLETED)');

    // Staff B processes entry 2 (NO_SHOW)
    const { req: rCall2, res: sCall2 } = makeReqRes(
      { id: staffB._id.toString(), role: 'STAFF' },
      {},
      { queueId: queue._id.toString() }
    );
    await callNext(rCall2, sCall2);
    const entry2Id = sCall2.responseData.data._id.toString();

    const { req: rNoShow2, res: sNoShow2 } = makeReqRes(
      { id: staffB._id.toString(), role: 'STAFF' },
      {},
      { entryId: entry2Id }
    );
    await noShow(rNoShow2, sNoShow2);
    assert(sNoShow2.statusCode === 200, 'Staff B marks customer CS-002 as NO_SHOW');

    // ----------------------------------------------------
    // TEST 1, 4, 5: Staff History Access & Authorization
    // ----------------------------------------------------
    // Test 1: STAFF can access own history
    const { req: rHistA, res: sHistA } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, {}, { date: 'all' });
    await getStaffHistory(rHistA, sHistA);
    assert(
      sHistA.statusCode === 200 && sHistA.responseData.data.length === 1 && sHistA.responseData.data[0].ticketNumber === 'CS-001',
      'Test 1: Staff A accesses own operational history (contains completed ticket CS-001)'
    );

    // Test 5: Staff cannot access another staff member's history
    assert(
      sHistA.responseData.data.every((item) => item.ticketNumber !== 'CS-002'),
      "Test 5: Staff A's history does NOT contain Staff B's ticket CS-002"
    );

    // Test 4: Unassigned STAFF receives empty history
    const { req: rHistUnassigned, res: sHistUnassigned } = makeReqRes(
      { id: unassignedStaff._id.toString(), role: 'STAFF' },
      {},
      {},
      { date: 'all' }
    );
    await getStaffHistory(rHistUnassigned, sHistUnassigned);
    assert(
      sHistUnassigned.statusCode === 200 && sHistUnassigned.responseData.count === 0,
      'Test 4: Unassigned staff receives empty history list (HTTP 200, count: 0)'
    );

    // ----------------------------------------------------
    // TEST 6, 7, 8, 9, 10, 11: History Pagination, Filtering, Sorting & Durations
    // ----------------------------------------------------
    // Test 6: History pagination
    const { req: rHistB, res: sHistB } = makeReqRes({ id: staffB._id.toString(), role: 'STAFF' }, {}, {}, { date: 'all', page: 1, limit: 10 });
    await getStaffHistory(rHistB, sHistB);
    assert(
      sHistB.statusCode === 200 && sHistB.responseData.pagination.page === 1 && sHistB.responseData.data[0].ticketNumber === 'CS-002',
      'Test 6: Staff B history supports pagination parameter'
    );

    // Test 7: Status filter
    const { req: rFiltCompleted, res: sFiltCompleted } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      {},
      { date: 'all', status: 'COMPLETED' }
    );
    await getStaffHistory(rFiltCompleted, sFiltCompleted);
    assert(
      sFiltCompleted.statusCode === 200 && sFiltCompleted.responseData.data.length === 1,
      'Test 7: Filtering history by status COMPLETED returns matching records'
    );

    const { req: rFiltNoShow, res: sFiltNoShow } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      {},
      { date: 'all', status: 'NO_SHOW' }
    );
    await getStaffHistory(rFiltNoShow, sFiltNoShow);
    assert(
      sFiltNoShow.statusCode === 200 && sFiltNoShow.responseData.data.length === 0,
      'Test 7: Filtering Staff A history by status NO_SHOW returns 0 records'
    );

    // Test 8: Date filter
    const todayStr = new Date().toISOString().split('T')[0];
    const { req: rFiltDate, res: sFiltDate } = makeReqRes(
      { id: staffA._id.toString(), role: 'STAFF' },
      {},
      {},
      { date: todayStr }
    );
    await getStaffHistory(rFiltDate, sFiltDate);
    assert(
      sFiltDate.statusCode === 200 && sFiltDate.responseData.data.length === 1,
      'Test 8: Date filtering with current YYYY-MM-DD returns today records'
    );

    // Test 10 & 11: Service duration & wait duration calculations
    const historyItemA = sHistA.responseData.data[0];
    assert(
      typeof historyItemA.serviceDurationSeconds === 'number' && historyItemA.serviceDurationSeconds >= 0,
      'Test 10: Completed service duration calculated correctly in seconds'
    );
    assert(
      typeof historyItemA.waitDurationSeconds === 'number' && historyItemA.waitDurationSeconds >= 0,
      'Test 11: Customer wait duration calculated correctly in seconds'
    );

    // ----------------------------------------------------
    // TEST 12 & 13: Daily Operational Summary Metrics
    // ----------------------------------------------------
    // Test 12: Daily summary returns correct totals for Staff A
    const { req: rSumA, res: sSumA } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, {}, { date: todayStr });
    await getStaffHistorySummary(rSumA, sSumA);
    assert(
      sSumA.statusCode === 200 && sSumA.responseData.data.completed === 1 && sSumA.responseData.data.totalHandled === 1,
      'Test 12: Daily summary returns accurate completed count = 1, totalHandled = 1'
    );

    // Test 13: Summary is scoped to authenticated staff (Staff B has 1 NO_SHOW)
    const { req: rSumB, res: sSumB } = makeReqRes({ id: staffB._id.toString(), role: 'STAFF' }, {}, {}, { date: todayStr });
    await getStaffHistorySummary(rSumB, sSumB);
    assert(
      sSumB.statusCode === 200 && sSumB.responseData.data.noShow === 1 && sSumB.responseData.data.completed === 0,
      'Test 13: Daily summary is scoped strictly to Staff B (noShow = 1, completed = 0)'
    );

    // ----------------------------------------------------
    // CONCURRENCY & RACES TESTS
    // ----------------------------------------------------
    // Concurrency 1: Simultaneous counter status change attempts
    const reqRace1 = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'OFFLINE' });
    const reqRace2 = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'AVAILABLE' });
    await Promise.all([
      updateCounterStatus(reqRace1.req, reqRace1.res),
      updateCounterStatus(reqRace2.req, reqRace2.res),
    ]);
    const finalCounter1 = await Counter.findById(counter1._id);
    assert(
      finalCounter1.status === 'OFFLINE' || finalCounter1.status === 'AVAILABLE',
      'Concurrency 1: Simultaneous status changes leave counter in a valid state (OFFLINE or AVAILABLE)'
    );

    // Concurrency 2: Staff A cannot change Staff B's counter status
    // (Staff A attempts to alter Counter 02 by ID -- endpoint derives counter from req.user staffId so Staff A can only affect Counter 01)
    const { req: rCrossStaff, res: sCrossStaff } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, { status: 'OFFLINE' });
    await updateCounterStatus(rCrossStaff, sCrossStaff);
    const counter2Refreshed = await Counter.findById(counter2._id);
    assert(
      counter2Refreshed.status === 'AVAILABLE',
      "Concurrency 2: Staff A updating counter status does NOT alter Staff B's Counter 02"
    );

    // Clean up
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, unassignedStaff._id, customer1._id, customer2._id, admin._id] } });

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
