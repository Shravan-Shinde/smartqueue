const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
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

const qrTokenService = require('../services/qrTokenService');
const queueRoutes = require('../routes/queueRoutes');
const staffRoutes = require('../routes/staffRoutes');
const cookieParser = require('cookie-parser');

const makeRequest = (port, path, method = 'GET', body = null, cookieToken = null) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookieToken) {
      headers['Cookie'] = `smartqueue_token=${cookieToken}`;
    }

    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
};

const createAuthToken = (user) => {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '1h',
  });
};

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 13 — QR CHECK-IN & STAFF VALIDATION SUITE');
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
    console.log('[DB] Connected to MongoDB for Sprint 13 verification.');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());

    // Register routes
    app.use('/api/v1/staff', staffRoutes);
    app.use('/api/v1', queueRoutes);

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
    await Organization.deleteMany({ slug: { $regex: /sprint13/ } });
    await User.deleteMany({ email: { $regex: /sprint13.*@test\.com/ } });
    await QueueEntry.deleteMany({});

    // Setup Organization 1, Location 1, Department 1, Counter 1
    const org1 = await Organization.create({
      name: 'Sprint13 Org 1',
      description: 'Sprint 13 Test Organization 1',
      slug: 'sprint13-org-1',
    });
    const loc1 = await Location.create({
      organizationId: org1._id,
      name: 'Sprint13 Location 1',
      address: '123 Main St',
      city: 'Metro',
    });
    const dept1 = await Department.create({
      organizationId: org1._id,
      locationId: loc1._id,
      name: 'Sprint13 Dept 1',
      prefix: 'S13',
    });

    // Setup Organization 2 (Unrelated hierarchy for cross-org testing)
    const org2 = await Organization.create({
      name: 'Sprint13 Org 2',
      description: 'Sprint 13 Test Organization 2',
      slug: 'sprint13-org-2',
    });
    const loc2 = await Location.create({
      organizationId: org2._id,
      name: 'Sprint13 Location 2',
      address: '456 Other St',
      city: 'Metro',
    });
    const dept2 = await Department.create({
      organizationId: org2._id,
      locationId: loc2._id,
      name: 'Sprint13 Dept 2',
      prefix: 'OTH',
    });

    const queue1 = await Queue.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      name: 'General Queue 1',
      prefix: 'S13',
    });

    const queue2 = await Queue.create({
      organizationId: org2._id,
      locationId: loc2._id,
      departmentId: dept2._id,
      name: 'General Queue 2',
      prefix: 'OTH',
    });

    // Setup Users
    const staffUser1 = await User.create({
      name: 'Sprint13 Staff 1',
      email: 'sprint13staff1@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffUser2Unassigned = await User.create({
      name: 'Sprint13 Staff 2 Unassigned',
      email: 'sprint13staff2@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const staffUserCrossOrg = await User.create({
      name: 'Sprint13 Staff Cross Org',
      email: 'sprint13staffcross@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerUser1 = await User.create({
      name: 'Sprint13 Customer 1',
      email: 'sprint13customer1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerUser2 = await User.create({
      name: 'Sprint13 Customer 2',
      email: 'sprint13customer2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerUser3 = await User.create({
      name: 'Sprint13 Customer 3',
      email: 'sprint13customer3@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerUser4 = await User.create({
      name: 'Sprint13 Customer 4',
      email: 'sprint13customer4@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const adminUser = await User.create({
      name: 'Sprint13 Admin',
      email: 'sprint13admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    const counter1 = await Counter.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      name: 'Counter 1',
      number: 'C1',
      assignedStaffId: staffUser1._id,
      status: 'AVAILABLE',
    });

    const counter2CrossOrg = await Counter.create({
      organizationId: org2._id,
      locationId: loc2._id,
      departmentId: dept2._id,
      name: 'Counter 2',
      number: 'C2',
      assignedStaffId: staffUserCrossOrg._id,
      status: 'AVAILABLE',
    });

    const staff1Token = createAuthToken(staffUser1);
    const staffUnassignedToken = createAuthToken(staffUser2Unassigned);
    const staffCrossOrgToken = createAuthToken(staffUserCrossOrg);
    const customerToken = createAuthToken(customerUser1);
    const adminToken = createAuthToken(adminUser);

    // ----------------------------------------------------
    // TEST 25: Sprint 12 QR Generation Verification
    // ----------------------------------------------------
    const entryWaiting = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'S13-001',
      sequenceNumber: 1,
      sequenceDate: '2026-09-07',
      status: 'WAITING',
    });

    const qrResult = await qrTokenService.getOrCreateQrToken(entryWaiting);
    assert(
      qrResult.eligible && qrResult.qrToken.startsWith('SMARTQUEUE:'),
      'Test 25: Existing Sprint 12 QR generation still works as expected'
    );
    const validQrToken = qrResult.qrToken;

    // ----------------------------------------------------
    // TEST 2: Unauthenticated request rejected
    // ----------------------------------------------------
    const resUnauth = await makeRequest(port, '/api/v1/queues/check-in', 'POST', {
      qrToken: validQrToken,
    });
    assert(resUnauth.status === 401, 'Test 2: Unauthenticated request is rejected with HTTP 401');

    // ----------------------------------------------------
    // TEST 3 & 4: Role-Based Authorization Restrictions
    // ----------------------------------------------------
    const resCustomerRole = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken },
      customerToken
    );
    assert(
      resCustomerRole.status === 403,
      'Test 3: CUSTOMER role cannot call check-in endpoint (HTTP 403 Forbidden)'
    );

    const resAdminRole = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken },
      adminToken
    );
    assert(
      resAdminRole.status === 403,
      'Test 4: ADMIN role cannot call STAFF check-in endpoint (HTTP 403 Forbidden)'
    );

    // ----------------------------------------------------
    // TEST 6: Malformed QR token rejected
    // ----------------------------------------------------
    const resMalformed = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: 'INVALID-PREFIX:12345' },
      staff1Token
    );
    assert(
      resMalformed.status === 400,
      'Test 6: Malformed QR token format is safely rejected with HTTP 400 Bad Request'
    );

    // ----------------------------------------------------
    // TEST 5: Non-existent QR token
    // ----------------------------------------------------
    const fakeToken = qrTokenService.generateSecureToken();
    const resNonExistent = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: fakeToken },
      staff1Token
    );
    assert(
      resNonExistent.status === 404,
      'Test 5: Non-existent QR token returns HTTP 404 Not Found'
    );

    // ----------------------------------------------------
    // TEST 17: Staff without valid assigned counter rejected
    // ----------------------------------------------------
    const resUnassignedStaff = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken },
      staffUnassignedToken
    );
    assert(
      resUnassignedStaff.status === 403 || resUnassignedStaff.status === 404,
      'Test 17: Staff without valid assigned counter cannot check in (HTTP 403/404)'
    );

    // ----------------------------------------------------
    // TEST 15 & 16: Cross-organization/department staff authorization check
    // ----------------------------------------------------
    const resCrossOrg = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken },
      staffCrossOrgToken
    );
    assert(
      resCrossOrg.status === 403,
      'Test 15 & 16: Cross-organization / unrelated department staff check-in rejected with HTTP 403 Forbidden'
    );

    // ----------------------------------------------------
    // TEST 1, 10, 13, 14, 21, 22, 23, 24: Valid Staff Check-in
    // ----------------------------------------------------
    const resValidCheckIn = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken, checkedInAt: '2020-01-01T00:00:00.000Z' }, // Attempt client timestamp override
      staff1Token
    );

    assert(
      resValidCheckIn.status === 200 && resValidCheckIn.body.success === true,
      'Test 1 & 10: Valid staff QR check-in succeeds for WAITING entry with HTTP 200 OK'
    );

    const checkedInEntryDb = await QueueEntry.findById(entryWaiting._id);
    assert(
      checkedInEntryDb.checkedInAt != null &&
        new Date(checkedInEntryDb.checkedInAt).getFullYear() >= 2026,
      'Test 13 & 14: checkedInAt timestamp is generated server-side; client override is ignored'
    );

    assert(
      !JSON.stringify(resValidCheckIn.body).includes(validQrToken),
      'Test 21: Raw QR token is not returned unnecessarily in check-in HTTP response payload'
    );

    // ----------------------------------------------------
    // TEST 18 & 19: Duplicate Check-In Protection
    // ----------------------------------------------------
    const firstCheckInTime = checkedInEntryDb.checkedInAt.toISOString();

    const resDuplicate = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: validQrToken },
      staff1Token
    );

    assert(
      resDuplicate.status === 409,
      'Test 18: Duplicate check-in for already checked-in QR token is rejected with HTTP 409 Conflict'
    );

    const recheckedDb = await QueueEntry.findById(entryWaiting._id);
    assert(
      recheckedDb.checkedInAt.toISOString() === firstCheckInTime,
      'Test 19: Original checkedInAt timestamp is preserved without overwrite'
    );

    // ----------------------------------------------------
    // TEST 7, 8, 9: Terminal Entry States (CANCELLED, COMPLETED, NO_SHOW)
    // ----------------------------------------------------
    const entryCancelled = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'S13-002',
      sequenceNumber: 2,
      sequenceDate: '2026-09-07',
      status: 'CANCELLED',
      isActive: false,
    });
    entryCancelled.qrToken = qrTokenService.generateSecureToken();
    await entryCancelled.save();

    const resCancelled = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: entryCancelled.qrToken },
      staff1Token
    );
    assert(
      resCancelled.status === 400,
      'Test 7: Terminal CANCELLED entry cannot check in (HTTP 400 Bad Request)'
    );

    const entryCompleted = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'S13-003',
      sequenceNumber: 3,
      sequenceDate: '2026-09-07',
      status: 'COMPLETED',
      isActive: false,
    });
    entryCompleted.qrToken = qrTokenService.generateSecureToken();
    await entryCompleted.save();

    const resCompleted = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: entryCompleted.qrToken },
      staff1Token
    );
    assert(
      resCompleted.status === 400,
      'Test 8: Terminal COMPLETED entry cannot check in (HTTP 400 Bad Request)'
    );

    const entryNoShow = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'S13-004',
      sequenceNumber: 4,
      sequenceDate: '2026-09-07',
      status: 'NO_SHOW',
      isActive: false,
    });
    entryNoShow.qrToken = qrTokenService.generateSecureToken();
    await entryNoShow.save();

    const resNoShow = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: entryNoShow.qrToken },
      staff1Token
    );
    assert(
      resNoShow.status === 400,
      'Test 9: Terminal NO_SHOW entry cannot check in (HTTP 400 Bad Request)'
    );

    // ----------------------------------------------------
    // TEST 11 & 12: CALLED and SERVING Status Check-Ins
    // ----------------------------------------------------
    const entryCalled = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser2._id,
      ticketNumber: 'S13-005',
      sequenceNumber: 5,
      sequenceDate: '2026-09-07',
      status: 'CALLED',
    });
    const calledQr = (await qrTokenService.getOrCreateQrToken(entryCalled)).qrToken;

    const resCalled = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: calledQr },
      staff1Token
    );
    assert(
      resCalled.status === 200 && resCalled.body.success === true,
      'Test 11: CALLED status queue entry permits successful QR check-in'
    );

    const entryServing = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser3._id,
      ticketNumber: 'S13-006',
      sequenceNumber: 6,
      sequenceDate: '2026-09-07',
      status: 'SERVING',
    });
    const servingQr = (await qrTokenService.getOrCreateQrToken(entryServing)).qrToken;

    const resServing = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: servingQr },
      staff1Token
    );
    assert(
      resServing.status === 200 && resServing.body.success === true,
      'Test 12: SERVING status queue entry permits successful QR check-in'
    );

    // ----------------------------------------------------
    // TEST 20: Concurrency / Race Condition Handling
    // ----------------------------------------------------
    const entryConcurrent = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser4._id,
      ticketNumber: 'S13-007',
      sequenceNumber: 7,
      sequenceDate: '2026-09-07',
      status: 'WAITING',
    });
    const concurrentQr = (await qrTokenService.getOrCreateQrToken(entryConcurrent)).qrToken;

    // Simulate 2 parallel check-in requests
    const [resConc1, resConc2] = await Promise.all([
      makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: concurrentQr }, staff1Token),
      makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: concurrentQr }, staff1Token),
    ]);

    const statuses = [resConc1.status, resConc2.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 409,
      'Test 20: Concurrent check-in requests atomically grant exactly 1 success (200) and 1 conflict (409)'
    );

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal Error during verification suite:', err);
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
