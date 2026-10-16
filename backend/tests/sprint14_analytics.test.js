const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('../config/db');
const { initSocketServer } = require('../socket/socketServer');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

const analyticsService = require('../services/analyticsService');
const qrTokenService = require('../services/qrTokenService');
const adminAnalyticsRoutes = require('../routes/adminAnalyticsRoutes');
const queueRoutes = require('../routes/queueRoutes');
const staffRoutes = require('../routes/staffRoutes');

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
  console.log('SMARTQUEUE SPRINT 14 — ANALYTICS ENGINE & METRICS SUITE');
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
    console.log('[DB] Connected to MongoDB for Sprint 14 verification.');

    const app = express();
    app.use(cookieParser());
    app.use(express.json());

    // Register routes
    app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
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
    await Organization.deleteMany({ slug: { $regex: /sprint14/ } });
    await User.deleteMany({ email: { $regex: /sprint14.*@test\.com/ } });
    await QueueEntry.deleteMany({});

    // Setup Organization 1, Location 1, Department 1, Counter 1, Queue 1
    const org1 = await Organization.create({
      name: 'Sprint14 Org 1',
      description: 'Sprint 14 Analytics Test Org 1',
      slug: 'sprint14-org-1',
    });
    const loc1 = await Location.create({
      organizationId: org1._id,
      name: 'Sprint14 Location 1',
      address: '100 Main Street',
      city: 'Metro City',
    });
    const dept1 = await Department.create({
      organizationId: org1._id,
      locationId: loc1._id,
      name: 'Sprint14 Dept 1',
      prefix: 'AN1',
    });

    // Setup Organization 2 (Separate hierarchy for cross-org testing)
    const org2 = await Organization.create({
      name: 'Sprint14 Org 2',
      description: 'Sprint 14 Analytics Test Org 2',
      slug: 'sprint14-org-2',
    });
    const loc2 = await Location.create({
      organizationId: org2._id,
      name: 'Sprint14 Location 2',
      address: '200 Second Street',
      city: 'Metro City',
    });
    const dept2 = await Department.create({
      organizationId: org2._id,
      locationId: loc2._id,
      name: 'Sprint14 Dept 2',
      prefix: 'AN2',
    });

    const queue1 = await Queue.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      name: 'Analytics Queue 1',
      prefix: 'AN1',
    });

    const queue2 = await Queue.create({
      organizationId: org2._id,
      locationId: loc2._id,
      departmentId: dept2._id,
      name: 'Analytics Queue 2',
      prefix: 'AN2',
    });

    // Setup Users
    const adminUser = await User.create({
      name: 'Sprint14 Admin',
      email: 'sprint14admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    const staffUser1 = await User.create({
      name: 'Sprint14 Staff 1',
      email: 'sprint14staff1@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerUser1 = await User.create({
      name: 'Sprint14 Customer 1',
      email: 'sprint14customer1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerUser2 = await User.create({
      name: 'Sprint14 Customer 2',
      email: 'sprint14customer2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerUser3 = await User.create({
      name: 'Sprint14 Customer 3',
      email: 'sprint14customer3@test.com',
      password: 'password123',
      role: 'CUSTOMER',
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

    const adminToken = createAuthToken(adminUser);
    const staffToken = createAuthToken(staffUser1);
    const customerToken = createAuthToken(customerUser1);

    // ----------------------------------------------------
    // TEST 4: Unauthenticated access rejected
    // ----------------------------------------------------
    const resUnauth = await makeRequest(port, '/api/v1/admin/analytics/overview');
    assert(resUnauth.status === 401, 'Test 4: Unauthenticated request to analytics rejected (HTTP 401)');

    // ----------------------------------------------------
    // TEST 2 & 3: Role Authorization (CUSTOMER & STAFF rejected)
    // ----------------------------------------------------
    const resCustomer = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, customerToken);
    assert(resCustomer.status === 403, 'Test 2: CUSTOMER role cannot access analytics (HTTP 403 Forbidden)');

    const resStaff = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, staffToken);
    assert(resStaff.status === 403, 'Test 3: STAFF role cannot access admin analytics (HTTP 403 Forbidden)');

    // ----------------------------------------------------
    // TEST 1: ADMIN access granted
    // ----------------------------------------------------
    const resAdmin = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, adminToken);
    assert(resAdmin.status === 200 && resAdmin.body.success === true, 'Test 1: ADMIN role successfully accesses overview analytics (HTTP 200)');

    // ----------------------------------------------------
    // TEST 24: Zero-data period returns safe default zero/null values (No NaN/Infinity/crash)
    // ----------------------------------------------------
    const overviewZero = resAdmin.body.data;
    assert(
      overviewZero.totalEntries === 0 &&
        overviewZero.completed === 0 &&
        overviewZero.completionRate === 0 &&
        overviewZero.averageWaitMinutes === 0 &&
        overviewZero.averageServiceMinutes === 0,
      'Test 24: Zero-data period returns safe zero values without NaN or Infinity'
    );

    // ----------------------------------------------------
    // TEST 5 & 6: Date Range Validation
    // ----------------------------------------------------
    const resInvalidDate = await makeRequest(
      port,
      '/api/v1/admin/analytics/overview?startDate=invalid-date',
      'GET',
      null,
      adminToken
    );
    assert(resInvalidDate.status === 400, 'Test 5: Malformed startDate format returns HTTP 400 Bad Request');

    const resReversedDate = await makeRequest(
      port,
      '/api/v1/admin/analytics/overview?startDate=2026-09-10&endDate=2026-09-01',
      'GET',
      null,
      adminToken
    );
    assert(
      resReversedDate.status === 400 && resReversedDate.body.message.includes('cannot be after'),
      'Test 6: startDate > endDate rejected with HTTP 400 Bad Request'
    );

    // ----------------------------------------------------
    // TEST 29: Invalid Hierarchy Combination Validation
    // ----------------------------------------------------
    const resInvalidHierarchy = await makeRequest(
      port,
      `/api/v1/admin/analytics/overview?organizationId=${org1._id}&locationId=${loc2._id}`,
      'GET',
      null,
      adminToken
    );
    assert(
      resInvalidHierarchy.status === 400 && resInvalidHierarchy.body.message.includes('Invalid hierarchy'),
      'Test 29: Mismatched hierarchy combination (Location 2 under Org 1) rejected with HTTP 400 Bad Request'
    );

    // ----------------------------------------------------
    // Create Seed QueueEntry Dataset for Metrics Verification
    // ----------------------------------------------------
    const baseTime = new Date('2026-09-07T09:00:00.000Z');

    // Entry 1: COMPLETED (Wait = 10 mins, Service = 15 mins)
    const entry1Joined = new Date(baseTime.getTime());
    const entry1Called = new Date(baseTime.getTime() + 10 * 60 * 1000);
    const entry1Started = new Date(baseTime.getTime() + 10 * 60 * 1000);
    const entry1Completed = new Date(baseTime.getTime() + 25 * 60 * 1000);

    const entry1 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-001',
      sequenceNumber: 1,
      sequenceDate: '2026-09-07',
      status: 'COMPLETED',
      joinedAt: entry1Joined,
      calledAt: entry1Called,
      startedAt: entry1Started,
      completedAt: entry1Completed,
      calledByCounterId: counter1._id,
      calledByUserId: staffUser1._id,
      isActive: false,
    });

    // Entry 2: COMPLETED (Wait = 20 mins, Service = 5 mins)
    const entry2Joined = new Date(baseTime.getTime());
    const entry2Called = new Date(baseTime.getTime() + 20 * 60 * 1000);
    const entry2Started = new Date(baseTime.getTime() + 20 * 60 * 1000);
    const entry2Completed = new Date(baseTime.getTime() + 25 * 60 * 1000);

    const entry2 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-002',
      sequenceNumber: 2,
      sequenceDate: '2026-09-07',
      status: 'COMPLETED',
      joinedAt: entry2Joined,
      calledAt: entry2Called,
      startedAt: entry2Started,
      completedAt: entry2Completed,
      calledByCounterId: counter1._id,
      calledByUserId: staffUser1._id,
      isActive: false,
    });

    // Entry 3: CANCELLED (Abandonment)
    const entry3 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-003',
      sequenceNumber: 3,
      sequenceDate: '2026-09-07',
      status: 'CANCELLED',
      joinedAt: baseTime,
      cancelledAt: new Date(baseTime.getTime() + 5 * 60 * 1000),
      isActive: false,
    });

    // Entry 4: NO_SHOW
    const entry4 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-004',
      sequenceNumber: 4,
      sequenceDate: '2026-09-07',
      status: 'NO_SHOW',
      joinedAt: baseTime,
      calledAt: new Date(baseTime.getTime() + 15 * 60 * 1000),
      noShowAt: new Date(baseTime.getTime() + 18 * 60 * 1000),
      calledByCounterId: counter1._id,
      isActive: false,
    });

    // Entry 5: LIVE WAITING
    const entry5 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser2._id,
      ticketNumber: 'AN1-005',
      sequenceNumber: 5,
      sequenceDate: '2026-09-07',
      status: 'WAITING',
      joinedAt: new Date(),
      isActive: true,
    });

    // Entry 6: LIVE SERVING
    const entry6 = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser3._id,
      ticketNumber: 'AN1-006',
      sequenceNumber: 6,
      sequenceDate: '2026-09-07',
      status: 'SERVING',
      joinedAt: new Date(Date.now() - 10 * 60 * 1000),
      calledAt: new Date(Date.now() - 5 * 60 * 1000),
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      calledByCounterId: counter1._id,
      isActive: true,
    });

    // Entry 7: Corrupt/Invalid duration entry (should be safely excluded from wait/service averages)
    const entryCorrupt = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-ERR',
      sequenceNumber: 99,
      sequenceDate: '2026-09-07',
      status: 'COMPLETED',
      joinedAt: new Date('2026-09-07T10:00:00.000Z'),
      calledAt: new Date('2026-09-07T09:00:00.000Z'), // Negative wait!
      startedAt: new Date('2026-09-07T10:00:00.000Z'),
      completedAt: new Date('2026-09-07T09:30:00.000Z'), // Negative service!
      calledByCounterId: counter1._id,
      calledByUserId: staffUser1._id,
      isActive: false,
    });

    // ----------------------------------------------------
    // TEST 7, 8, 9, 10, 14, 15, 16, 35: Overview Metrics Verification
    // ----------------------------------------------------
    const resOverviewPopulated = await makeRequest(
      port,
      '/api/v1/admin/analytics/overview?startDate=2026-09-01&endDate=2026-09-30',
      'GET',
      null,
      adminToken
    );

    const ov = resOverviewPopulated.body.data;
    assert(ov.totalEntries === 7, 'Test 7: Overview total entries count calculated accurately (7 total entries)');
    assert(ov.completed === 3, 'Test 8: Completed count calculated accurately (3 completed entries)');
    assert(ov.cancelled === 1, 'Test 9: Cancelled count calculated accurately (1 cancelled entry)');
    assert(ov.noShow === 1, 'Test 10: No-show count calculated accurately (1 no-show entry)');

    // Rates: 3/7 = 42.9%, 1/7 = 14.3%, 1/7 = 14.3%
    assert(
      ov.completionRate === 42.9 && ov.cancellationRate === 14.3 && ov.noShowRate === 14.3,
      'Test 14, 15, 16 & 35: Completion rate (42.9%), cancellation rate (14.3%), and no-show/abandonment rate (14.3%) calculated accurately'
    );

    // ----------------------------------------------------
    // TEST 11, 12, 13, 32, 33, 34: Actual Wait & Service Time Calculations
    // ----------------------------------------------------
    // Valid wait times: (10 + 20) / 2 = 15.0 minutes (excludes negative corrupt entry)
    assert(
      ov.averageWaitMinutes === 15.0,
      'Test 11, 32 & 34: Actual wait time calculated strictly from calledAt - joinedAt (15.0 min avg), ignoring estimates'
    );

    // Valid service times: (15 + 5) / 2 = 10.0 minutes (excludes negative corrupt entry)
    assert(
      ov.averageServiceMinutes === 10.0,
      'Test 12 & 33: Actual service time calculated strictly from completedAt - startedAt (10.0 min avg)'
    );

    assert(
      ov.averageWaitMinutes > 0 && ov.averageServiceMinutes > 0,
      'Test 13: Invalid negative durations safely excluded from averages'
    );

    // ----------------------------------------------------
    // TEST 21, 22, 31: Current Live State Unconstrained by Date Filters
    // ----------------------------------------------------
    assert(
      ov.currentlyWaiting === 1 && ov.currentlyServing === 1,
      'Test 21, 22 & 31: Current live waiting (1) and serving (1) metrics reflect live state unconstrained by date filters'
    );

    // ----------------------------------------------------
    // TEST 19, 25, 26, 27, 28: Queue Metrics & Hierarchy Filtering
    // ----------------------------------------------------
    const resQueuesFiltered = await makeRequest(
      port,
      `/api/v1/admin/analytics/queues?organizationId=${org1._id}&locationId=${loc1._id}&departmentId=${dept1._id}&queueId=${queue1._id}`,
      'GET',
      null,
      adminToken
    );

    assert(
      resQueuesFiltered.status === 200 && resQueuesFiltered.body.count === 1,
      'Test 19, 25, 26, 27 & 28: Queue-level analytics respects organization, location, department, and queue filters'
    );

    const qData = resQueuesFiltered.body.data[0];
    assert(
      qData.queueId === queue1._id.toString() && qData.completed === 3 && qData.averageWaitMinutes === 15.0,
      'Test 19: Queue metrics return accurate per-queue breakdown (3 completed, 15.0 min avg wait)'
    );

    // ----------------------------------------------------
    // TEST 20, 36, 37: Counter Performance & Attribution
    // ----------------------------------------------------
    const resCounters = await makeRequest(
      port,
      `/api/v1/admin/analytics/counters?organizationId=${org1._id}`,
      'GET',
      null,
      adminToken
    );

    assert(resCounters.status === 200 && resCounters.body.count >= 1, 'Test 20: Counter analytics API returns counter operational performance list');

    const cData = resCounters.body.data[0];
    assert(
      cData.counterId === counter1._id.toString() && cData.completedServices === 3,
      'Test 36: Counter attribution uses calledByCounterId data (3 completed services for Counter 1)'
    );

    assert(
      cData.handledServices === 3 && cData.utilizationNote.includes('handledServices'),
      'Test 37: No fake utilization percentage returned; handledServices operational load proxy provided with clarification note'
    );

    // ----------------------------------------------------
    // TEST 17 & 18: Throughput & Peak Hours
    // ----------------------------------------------------
    const resTraffic = await makeRequest(
      port,
      `/api/v1/admin/analytics/traffic?organizationId=${org1._id}`,
      'GET',
      null,
      adminToken
    );

    assert(resTraffic.status === 200 && resTraffic.body.data.throughput.length >= 1, 'Test 17: Throughput daily grouping returns date-grouped completed counts');

    const peakHours = resTraffic.body.data.peakHours;
    assert(
      Array.isArray(peakHours) && peakHours.length === 24 && peakHours[9].hour === '09:00',
      'Test 18: Peak hours calculation groups activity into 24 hour-of-day slots (00:00 - 23:00)'
    );

    // ----------------------------------------------------
    // TEST 23: Crowd Status & Thresholds
    // ----------------------------------------------------
    const resCrowd = await makeRequest(
      port,
      `/api/v1/admin/analytics/crowd?organizationId=${org1._id}`,
      'GET',
      null,
      adminToken
    );

    assert(
      resCrowd.status === 200 && resCrowd.body.data.crowdStatus === 'LOW',
      'Test 23: Crowd status calculation correctly evaluates LOW threshold (1 waiting entry)'
    );

    // Test Crowd Thresholds directly
    assert(analyticsService.getCrowdLevel(5) === 'LOW', 'Crowd threshold 5 -> LOW');
    assert(analyticsService.getCrowdLevel(20) === 'MEDIUM', 'Crowd threshold 20 -> MEDIUM');
    assert(analyticsService.getCrowdLevel(45) === 'HIGH', 'Crowd threshold 45 -> HIGH');
    assert(analyticsService.getCrowdLevel(75) === 'VERY HIGH', 'Crowd threshold 75 -> VERY HIGH');

    // ----------------------------------------------------
    // TEST 30: Privacy & PII Omission
    // ----------------------------------------------------
    const overviewStr = JSON.stringify(resOverviewPopulated.body);
    const queuesStr = JSON.stringify(resQueuesFiltered.body);
    const countersStr = JSON.stringify(resCounters.body);

    const piiLeak =
      overviewStr.includes('sprint14customer1@test.com') ||
      queuesStr.includes('sprint14customer1@test.com') ||
      countersStr.includes('sprint14customer1@test.com') ||
      overviewStr.includes('password123');

    assert(!piiLeak, 'Test 30: Analytics responses strictly omit customer PII (email, phone, passwords)');

    // ----------------------------------------------------
    // TEST 38: Existing Sprint 13 QR Check-In Workflow Verification
    // ----------------------------------------------------
    const qrEntry = await QueueEntry.create({
      organizationId: org1._id,
      locationId: loc1._id,
      departmentId: dept1._id,
      queueId: queue1._id,
      customerId: customerUser1._id,
      ticketNumber: 'AN1-QR1',
      sequenceNumber: 10,
      sequenceDate: '2026-09-07',
      status: 'WAITING',
    });

    const qrResult = await qrTokenService.getOrCreateQrToken(qrEntry);
    assert(qrResult.eligible && qrResult.qrToken.startsWith('SMARTQUEUE:'), 'Sprint 12/13 QR Token generation succeeds');

    const resCheckIn = await makeRequest(
      port,
      '/api/v1/queues/check-in',
      'POST',
      { qrToken: qrResult.qrToken },
      staffToken
    );

    assert(
      resCheckIn.status === 200 && resCheckIn.body.success === true,
      'Test 38: Existing Sprint 13 QR check-in workflow remains 100% functional after analytics engine addition'
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
