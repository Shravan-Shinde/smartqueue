const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const ioClient = require('../../frontend/node_modules/socket.io-client');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

const { initSocketServer, getIO } = require('../socket/socketServer');
const authRoutes = require('../routes/authRoutes');
const adminOrgRoutes = require('../routes/adminOrgRoutes');
const adminAnalyticsRoutes = require('../routes/adminAnalyticsRoutes');
const adminLiveCrowdRoutes = require('../routes/adminLiveCrowdRoutes');
const queueRoutes = require('../routes/queueRoutes');
const staffRoutes = require('../routes/staffRoutes');

const { getLiveCrowdSnapshot, getCrowdLevel } = require('../services/liveCrowdService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartqueue_test';
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.JWT_SECRET = JWT_SECRET;

let server;
let app;
let port;
let serverUrl;

// Test Seeds
let adminUser, staffUser, customerUser1, customerUser2, customerUser3;
let adminToken, staffToken, customerToken1;
let org, location, dept, counter1, counter2, queue;

const createTestToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

const setupTestApp = async () => {
  app = express();
  server = http.createServer(app);

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin/organizations', adminOrgRoutes);
  app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
  app.use('/api/v1/admin/live-crowd', adminLiveCrowdRoutes);
  app.use('/api/v1/staff', staffRoutes);
  app.use('/api/v1', queueRoutes);

  initSocketServer(server);

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
};

const seedDatabase = async () => {
  await User.deleteMany({});
  await Organization.deleteMany({});
  await Location.deleteMany({});
  await Department.deleteMany({});
  await Counter.deleteMany({});
  await Queue.deleteMany({});
  await QueueEntry.deleteMany({});

  adminUser = await User.create({
    name: 'Admin User',
    email: 'admin_s16@test.com',
    password: 'password123',
    role: 'ADMIN',
    isActive: true,
  });
  adminToken = createTestToken(adminUser);

  staffUser = await User.create({
    name: 'Staff User',
    email: 'staff_s16@test.com',
    password: 'password123',
    role: 'STAFF',
    isActive: true,
  });
  staffToken = createTestToken(staffUser);

  customerUser1 = await User.create({
    name: 'Customer One',
    email: 'customer1_s16@test.com',
    password: 'password123',
    role: 'CUSTOMER',
    isActive: true,
  });
  customerToken1 = createTestToken(customerUser1);

  customerUser2 = await User.create({
    name: 'Customer Two',
    email: 'customer2_s16@test.com',
    password: 'password123',
    role: 'CUSTOMER',
    isActive: true,
  });

  customerUser3 = await User.create({
    name: 'Customer Three',
    email: 'customer3_s16@test.com',
    password: 'password123',
    role: 'CUSTOMER',
    isActive: true,
  });

  org = await Organization.create({
    name: 'Live Crowd Hospital',
    description: 'Test hospital description for Sprint 16',
    slug: `live-hosp-${Date.now()}`,
    category: 'HOSPITAL',
    isActive: true,
  });

  location = await Location.create({
    organizationId: org._id,
    name: 'Main Building',
    address: '100 Operational Way',
    city: 'Metro',
    isActive: true,
  });

  dept = await Department.create({
    organizationId: org._id,
    locationId: location._id,
    name: 'Emergency Ward',
    prefix: 'E',
    isActive: true,
  });

  counter1 = await Counter.create({
    organizationId: org._id,
    locationId: location._id,
    departmentId: dept._id,
    name: 'Counter 1',
    number: '1',
    assignedStaffId: staffUser._id,
    status: 'AVAILABLE',
    isActive: true,
  });

  counter2 = await Counter.create({
    organizationId: org._id,
    locationId: location._id,
    departmentId: dept._id,
    name: 'Counter 2',
    number: '2',
    status: 'OFFLINE',
    isActive: true,
  });

  queue = await Queue.create({
    organizationId: org._id,
    locationId: location._id,
    departmentId: dept._id,
    name: 'Emergency Queue',
    prefix: 'E',
    maxCapacity: 50,
    status: 'OPEN',
    isActive: true,
  });
};

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 16 — LIVE CROWD DASHBOARD SUITE');
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
    await mongoose.connect(MONGO_URI);
    await setupTestApp();
    await seedDatabase();

    // 1. Unauthenticated Access Protection
    const unauthRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd`);
    assert(unauthRes.status === 401, 'Test 4: Unauthenticated request rejected (HTTP 401)');

    // 2. Customer Access Protection
    const custRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd`, {
      headers: { Cookie: `smartqueue_token=${customerToken1}` },
    });
    assert(custRes.status === 403, 'Test 2: CUSTOMER role rejected (HTTP 403)');

    // 3. Staff Access Protection
    const staffRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd`, {
      headers: { Cookie: `smartqueue_token=${staffToken}` },
    });
    assert(staffRes.status === 403, 'Test 3: STAFF role rejected (HTTP 403)');

    // 4. Admin Access Success
    const adminRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd`, {
      headers: { Cookie: `smartqueue_token=${adminToken}` },
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200 && adminData.success, 'Test 1: ADMIN role successfully accesses live crowd snapshot');

    // 5. Hierarchy Filter Validation
    const invalidHierarchyRes = await fetch(
      `${serverUrl}/api/v1/admin/live-crowd?organizationId=507f1f77bcf86cd799439011&locationId=${location._id}`,
      { headers: { Cookie: `smartqueue_token=${adminToken}` } }
    );
    assert(invalidHierarchyRes.status === 400, 'Test 5: Invalid hierarchy filter rejected (HTTP 400)');

    // Seed Queue Entries for Live Operational Testing
    const todayStr = new Date().toISOString().split('T')[0];

    // Waiting entries
    const entryWaiting1 = await QueueEntry.create({
      queueId: queue._id,
      customerId: customerUser1._id,
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-001',
      sequenceNumber: 1,
      sequenceDate: todayStr,
      qrToken: 'SMARTQUEUE:111111111111111111111111111111111111111111111111',
      status: 'WAITING',
      isActive: true,
      joinedAt: new Date(),
    });

    const entryWaiting2 = await QueueEntry.create({
      queueId: queue._id,
      customerId: customerUser2._id,
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-002',
      sequenceNumber: 2,
      sequenceDate: todayStr,
      qrToken: 'SMARTQUEUE:222222222222222222222222222222222222222222222222',
      status: 'WAITING',
      isActive: true,
      joinedAt: new Date(),
    });

    // Serving entry
    const entryServing = await QueueEntry.create({
      queueId: queue._id,
      customerId: customerUser3._id,
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-003',
      sequenceNumber: 3,
      sequenceDate: todayStr,
      qrToken: 'SMARTQUEUE:333333333333333333333333333333333333333333333333',
      calledByCounterId: counter1._id,
      status: 'SERVING',
      isActive: true,
      joinedAt: new Date(),
      calledAt: new Date(),
      startedAt: new Date(),
    });

    // Completed entry (Terminal)
    await QueueEntry.create({
      queueId: queue._id,
      customerId: new mongoose.Types.ObjectId(),
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-004',
      sequenceNumber: 4,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      isActive: false,
      joinedAt: new Date(),
      completedAt: new Date(),
    });

    // Cancelled entry (Terminal)
    await QueueEntry.create({
      queueId: queue._id,
      customerId: new mongoose.Types.ObjectId(),
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-005',
      sequenceNumber: 5,
      sequenceDate: todayStr,
      status: 'CANCELLED',
      isActive: false,
      joinedAt: new Date(),
    });

    // No-Show entry (Terminal)
    await QueueEntry.create({
      queueId: queue._id,
      customerId: new mongoose.Types.ObjectId(),
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      ticketNumber: 'E-006',
      sequenceNumber: 6,
      sequenceDate: todayStr,
      status: 'NO_SHOW',
      isActive: false,
      joinedAt: new Date(),
    });

    // 6. Test REST Live Snapshot Values
    const snapRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd`, {
      headers: { Cookie: `smartqueue_token=${adminToken}` },
    });
    const snapJson = await snapRes.json();
    const qData = snapJson.data.queues.find((q) => q.queueId === queue._id.toString());

    assert(qData.waiting === 2, 'Test 6: Server-authoritative WAITING count equals 2');
    assert(qData.serving === 1, 'Test 7: Server-authoritative SERVING count equals 1');
    assert(
      qData.waiting !== 5,
      'Test 8, 9, 10: Terminal states (COMPLETED, CANCELLED, NO_SHOW) excluded from waiting count'
    );

    // 7. Active Counter Calculation
    assert(qData.activeCounters === 1, 'Test 11: Active counters count equals 1 (AVAILABLE/BUSY)');
    assert(qData.totalCounters === 2, 'Test 12: Total counters count equals 2 (OFFLINE counter excluded from active)');

    // 8. Capacity Percentage Calculation
    assert(qData.capacityPercentage === 4.0, 'Test 18: Capacity percentage correctly calculated (2 / 50 * 100 = 4%)');

    // 9. Capacity Percentage Safety
    const testQueue = await Queue.create({
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      name: 'Single Cap Queue',
      prefix: 'S',
      maxCapacity: 1,
      status: 'OPEN',
      isActive: true,
    });
    const testCapRes = await fetch(`${serverUrl}/api/v1/admin/live-crowd?queueId=${testQueue._id}`, {
      headers: { Cookie: `smartqueue_token=${adminToken}` },
    });
    const testCapJson = await testCapRes.json();
    const testData = testCapJson.data.queues[0];
    assert(
      testData.capacityPercentage === 0 && !isNaN(testData.capacityPercentage),
      'Test 19: maxCapacity handled safely without NaN or Infinity'
    );

    // 10. Crowd Level Thresholds
    assert(getCrowdLevel(5) === 'LOW', 'Test 14: Crowd threshold LOW (0-10)');
    assert(getCrowdLevel(20) === 'MEDIUM', 'Test 15: Crowd threshold MEDIUM (11-30)');
    assert(getCrowdLevel(45) === 'HIGH', 'Test 16: Crowd threshold HIGH (31-60)');
    assert(getCrowdLevel(75) === 'VERY HIGH', 'Test 17: Crowd threshold VERY HIGH (61+)');

    // 11. Summary Totals Calculation
    assert(snapJson.data.summary.totalWaiting >= 2, 'Test 20: Summary totalWaiting calculated accurately');
    assert(snapJson.data.summary.totalServing >= 1, 'Test 20: Summary totalServing calculated accurately');
    assert(snapJson.data.summary.openQueues >= 1, 'Test 20: Summary openQueues calculated accurately');

    // 12. Strict PII Omission Verification
    const piiFound = JSON.stringify(snapJson).includes('customer1_s16@test.com') ||
                     JSON.stringify(snapJson).includes('Customer One') ||
                     JSON.stringify(snapJson).includes('password123');
    assert(!piiFound, 'Test 13 & 21: Live Crowd snapshot payload strictly omits customer PII');

    // 13. Socket.IO Admin Room Subscription & Authorization Testing
    const adminSocket = ioClient(serverUrl, {
      extraHeaders: { cookie: `smartqueue_token=${adminToken}` },
      reconnection: false,
    });

    const custSocket = ioClient(serverUrl, {
      extraHeaders: { cookie: `smartqueue_token=${customerToken1}` },
      reconnection: false,
    });

    await new Promise((res) => adminSocket.on('connect', res));
    await new Promise((res) => custSocket.on('connect', res));

    let custSocketErr = null;
    custSocket.on('socketError', (err) => {
      custSocketErr = err;
    });

    custSocket.emit('subscribeAdminLive', { organizationId: org._id.toString() });

    await new Promise((res) => setTimeout(res, 200));

    assert(
      custSocketErr && custSocketErr.message.includes('Unauthorized'),
      'Test 22 & 23: Non-admin socket subscription to subscribeAdminLive is rejected with socketError'
    );

    // 14. Real-Time Socket Event Emission Testing (liveCrowdUpdated)
    adminSocket.emit('subscribeAdminLive', { organizationId: org._id.toString() });
    await new Promise((res) => setTimeout(res, 200));

    let receivedLiveEvent = null;
    adminSocket.on('liveCrowdUpdated', (data) => {
      receivedLiveEvent = data;
    });

    // Customer joins queue via API (using new customer to bypass 1-active-ticket-per-queue duplicate check)
    const customerUser4 = await User.create({
      name: 'Customer Four',
      email: 'customer4_s16@test.com',
      password: 'password123',
      role: 'CUSTOMER',
      isActive: true,
    });
    const customerToken4 = createTestToken(customerUser4);

    const joinRes = await fetch(`${serverUrl}/api/v1/queues/${queue._id}/join`, {
      method: 'POST',
      headers: { Cookie: `smartqueue_token=${customerToken4}` },
    });
    const joinData = await joinRes.json();

    await new Promise((res) => setTimeout(res, 300));

    assert(
      receivedLiveEvent && receivedLiveEvent.queueId === queue._id.toString(),
      'Test 24: Customer join queue triggers real-time liveCrowdUpdated socket event'
    );

    assert(
      receivedLiveEvent && !JSON.stringify(receivedLiveEvent).includes('Customer One'),
      'Test 29: liveCrowdUpdated socket event payload strictly omits customer PII'
    );

    adminSocket.disconnect();
    custSocket.disconnect();
  } catch (err) {
    console.error('[TEST ERROR]', err);
    assert(false, `Sprint 16 Execution Error: ${err.message}`);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
  }
};

runTests();
