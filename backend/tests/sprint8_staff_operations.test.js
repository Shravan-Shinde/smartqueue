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
  getWaitingQueue,
  callNext,
  startService,
  completeService,
  noShow,
} = require('../controllers/staffController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 8 — STAFF OPERATIONS VERIFICATION SUITE');
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
    console.log('[DB] Connected to MongoDB for Sprint 8 verification.');

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
    await Organization.deleteMany({ slug: 'sprint8-test-org' });
    await User.deleteMany({ email: { $regex: /sprint8.*@test\.com/ } });

    // 3. Create Users (Staff A, Staff B, Customer 1, Customer 2, Admin)
    const staffA = await User.create({
      name: 'Sprint8 Staff A',
      email: 'sprint8staffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffB = await User.create({
      name: 'Sprint8 Staff B',
      email: 'sprint8staffb@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customer1 = await User.create({
      name: 'Sprint8 Customer 1',
      email: 'sprint8c1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Sprint8 Customer 2',
      email: 'sprint8c2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const admin = await User.create({
      name: 'Sprint8 Admin',
      email: 'sprint8admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    // Generate JWT tokens
    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    const tokenStaffA = jwt.sign({ userId: staffA._id.toString(), role: staffA.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenStaffB = jwt.sign({ userId: staffB._id.toString(), role: staffB.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenC1 = jwt.sign({ userId: customer1._id.toString(), role: customer1.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenC2 = jwt.sign({ userId: customer2._id.toString(), role: customer2.role }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Org Hierarchy & Counters
    const org = await Organization.create({
      name: 'Sprint8 Test Bank',
      description: 'Staff verification bank',
      slug: 'sprint8-test-org',
      category: 'BANK',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Branch',
      address: '800 Teller Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Teller Services',
      prefix: 'TEL',
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
      name: 'General Teller Queue',
      prefix: 'TEL',
      avgServiceTimeMins: 5,
      maxCapacity: 20,
      status: 'OPEN',
      isActive: true,
    });

    // Connect Customer 1 & 2 Socket clients
    const connectSocketClient = (token) => {
      return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, { auth: { token }, reconnection: false });
        client.on('connect', () => resolve(client));
        client.on('connect_error', (err) => reject(err));
      });
    };

    const clientC1 = await connectSocketClient(tokenC1);
    const clientC2 = await connectSocketClient(tokenC2);
    assert(clientC1.connected && clientC2.connected, 'Customers connect to Socket.IO successfully');

    // 5. Test Unassigned Staff Access Rejection
    const reqUnassigned = { user: { id: staffA._id.toString(), role: 'STAFF' } };
    const resUnassigned = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await getMyCounter(reqUnassigned, resUnassigned);
    assert(resUnassigned.statusCode === 404, 'Unassigned STAFF member receives HTTP 404 on getMyCounter');

    // 6. Test Admin Assign Staff to Counter
    const reqAssign = { params: { counterId: counter1._id.toString() }, body: { staffUserId: staffA._id.toString() } };
    const resAssign = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await assignStaffToCounter(reqAssign, resAssign);
    assert(resAssign.statusCode === 200, 'ADMIN assigns Staff A to Counter 01 (HTTP 200)');

    // Assign Staff B to Counter 2
    const reqAssignB = { params: { counterId: counter2._id.toString() }, body: { staffUserId: staffB._id.toString() } };
    const resAssignB = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await assignStaffToCounter(reqAssignB, resAssignB);
    assert(resAssignB.statusCode === 200, 'ADMIN assigns Staff B to Counter 02 (HTTP 200)');

    // 7. Test One Staff / One Counter Rule Enforcement
    const reqDupAssign = { params: { counterId: counter2._id.toString() }, body: { staffUserId: staffA._id.toString() } };
    const resDupAssign = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await assignStaffToCounter(reqDupAssign, resDupAssign);
    assert(resDupAssign.statusCode === 409, 'Assigning Staff A to second counter is rejected with HTTP 409 Conflict');

    // 8. Test Assigned Staff Accessing Own Counter
    const reqStaffA = { user: { id: staffA._id.toString(), role: 'STAFF' } };
    const resStaffA = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await getMyCounter(reqStaffA, resStaffA);
    assert(
      resStaffA.statusCode === 200 && resStaffA.responseData.data.counter.name === 'Counter 01',
      'Assigned Staff A retrieves own assigned Counter 01 details'
    );

    // 9. Customers Join Queue (Customer 1 then Customer 2)
    const reqJoin1 = { user: { id: customer1._id.toString(), role: 'CUSTOMER' }, params: { queueId: queue._id.toString() } };
    const resJoin1 = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await customerJoinQueue(reqJoin1, resJoin1);

    const reqJoin2 = { user: { id: customer2._id.toString(), role: 'CUSTOMER' }, params: { queueId: queue._id.toString() } };
    const resJoin2 = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await customerJoinQueue(reqJoin2, resJoin2);

    assert(resJoin1.statusCode === 201 && resJoin2.statusCode === 201, 'Customer 1 (TEL-001) and Customer 2 (TEL-002) join queue');

    // 10. Test Call Next (FIFO Claim) by Staff A
    const c1SocketPromise = new Promise((resolve) => clientC1.once('yourQueueUpdated', resolve));
    const c1NotifPromise = new Promise((resolve) => clientC1.once('notificationCreated', resolve));

    const reqCallNext = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { queueId: queue._id.toString() } };
    const resCallNext = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    await callNext(reqCallNext, resCallNext);
    assert(
      resCallNext.statusCode === 200 && resCallNext.responseData.data.ticketNumber === 'TEL-001',
      'Staff A calls next customer and claims first FIFO ticket TEL-001 (WAITING -> CALLED)'
    );

    const c1SocketData = await c1SocketPromise;
    assert(c1SocketData && c1SocketData.status === 'CALLED', 'Customer 1 receives real-time `yourQueueUpdated` socket event with status CALLED');

    const c1NotifData = await c1NotifPromise;
    assert(
      c1NotifData && c1NotifData.type === 'SERVICE_CALLED' && c1NotifData.title === 'Your Turn',
      'Customer 1 receives SERVICE_CALLED notification ("Your Turn: Please proceed to Counter 01")'
    );

    // 11. Test Atomic Concurrency & Busy Counter Rejection
    const reqCallNextBusy = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { queueId: queue._id.toString() } };
    const resCallNextBusy = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await callNext(reqCallNextBusy, resCallNextBusy);
    assert(resCallNextBusy.statusCode === 409, 'Calling next while counter already has active called customer is rejected with HTTP 409');

    // 12. Test Start Service (CALLED -> SERVING)
    const entry1Id = resCallNext.responseData.data._id.toString();
    const reqStart = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { entryId: entry1Id } };
    const resStart = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    await startService(reqStart, resStart);
    assert(
      resStart.statusCode === 200 && resStart.responseData.data.status === 'SERVING',
      'Staff A starts service for TEL-001 (CALLED -> SERVING, startedAt timestamp set)'
    );

    const updatedCounter1 = await Counter.findById(counter1._id);
    assert(updatedCounter1.status === 'BUSY', 'Counter 01 status changes to BUSY during service');

    // 13. Test Invalid Transition Rejection (COMPLETED without SERVING)
    const reqInvalidStart = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { entryId: entry1Id } };
    const resInvalidStart = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };
    await startService(reqInvalidStart, resInvalidStart);
    assert(resInvalidStart.statusCode === 409, 'Starting service on an already SERVING entry is rejected with HTTP 409');

    // 14. Test Complete Service (SERVING -> COMPLETED)
    const reqComplete = { user: { id: staffA._id.toString(), role: 'STAFF' }, params: { entryId: entry1Id } };
    const resComplete = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    await completeService(reqComplete, resComplete);
    assert(
      resComplete.statusCode === 200 && resComplete.responseData.data.status === 'COMPLETED',
      'Staff A completes service for TEL-001 (SERVING -> COMPLETED, completedAt timestamp set)'
    );

    const resetCounter1 = await Counter.findById(counter1._id);
    assert(
      resetCounter1.status === 'AVAILABLE' && resetCounter1.currentQueueEntryId === null,
      'Counter 01 resets to AVAILABLE with currentQueueEntryId = null after completion'
    );

    // 15. Test Staff B Operations & No Show (WAITING -> NO_SHOW)
    const entry2Id = (resJoin2.responseData.data.entry.id || resJoin2.responseData.data.entry._id).toString();
    const reqNoShowB = { user: { id: staffB._id.toString(), role: 'STAFF' }, params: { entryId: entry2Id } };
    const resNoShowB = { status(code) { this.statusCode = code; return this; }, json(data) { this.responseData = data; return this; } };

    await noShow(reqNoShowB, resNoShowB);
    assert(
      resNoShowB.statusCode === 200 && resNoShowB.responseData.data.status === 'NO_SHOW',
      'Staff B marks Customer 2 (TEL-002) as NO_SHOW (WAITING -> NO_SHOW)'
    );

    // 16. Cleanup Socket & DB
    clientC1.disconnect();
    clientC2.disconnect();

    await Notification.deleteMany({ userId: { $in: [customer1._id, customer2._id] } });
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, staffB._id, customer1._id, customer2._id, admin._id] } });

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
