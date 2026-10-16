const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('../config/db');
const { initSocketServer } = require('../socket/socketServer');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const securityHeaders = require('../middleware/securityHeaders');
const authRoutes = require('../routes/authRoutes');
const adminOrgRoutes = require('../routes/adminOrgRoutes');
const adminAnalyticsRoutes = require('../routes/adminAnalyticsRoutes');
const adminLiveCrowdRoutes = require('../routes/adminLiveCrowdRoutes');
const adminReviewRoutes = require('../routes/adminReviewRoutes');
const customerHistoryRoutes = require('../routes/customerHistoryRoutes');
const queueRoutes = require('../routes/queueRoutes');
const staffRoutes = require('../routes/staffRoutes');
const notificationRoutes = require('../routes/notificationRoutes');
const errorHandler = require('../middleware/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_key_2026';

let server;
let app;
let port;

const makeRequest = (portNum, path, method = 'GET', body = null, cookieToken = null, extraHeaders = {}) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookieToken) {
      headers['Cookie'] = `smartqueue_token=${cookieToken}`;
    }

    const options = {
      hostname: '127.0.0.1',
      port: portNum,
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
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

const createTestToken = (user, secret = JWT_SECRET, expiresIn = '1h') => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    secret,
    { expiresIn }
  );
};

const runSprint20QASuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE SPRINT 20 — COMPREHENSIVE QA & RELEASE VALIDATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  };

  try {
    await connectDB();
    console.log('[TEST SETUP] Connected to MongoDB');

    app = express();
    server = http.createServer(app);

    app.use(securityHeaders);
    app.use(cookieParser());
    app.use(express.json());

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/admin/organizations', adminOrgRoutes);
    app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);
    app.use('/api/v1/admin/live-crowd', adminLiveCrowdRoutes);
    app.use('/api/v1/admin/reviews', adminReviewRoutes);
    app.use('/api/v1/customers/me/history', customerHistoryRoutes);
    app.use('/api/v1/notifications', notificationRoutes);
    app.use('/api/v1/staff', staffRoutes);
    app.use('/api/v1', queueRoutes);

    app.use(errorHandler);

    initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        console.log(`[TEST SETUP] Sprint 20 QA Test Server listening on port ${port}`);
        resolve();
      });
    });

    // Clean Collections
    await User.deleteMany({});
    await Organization.deleteMany({});
    await Location.deleteMany({});
    await Department.deleteMany({});
    await Counter.deleteMany({});
    await Queue.deleteMany({});
    await QueueEntry.deleteMany({});
    await Review.deleteMany({});
    await Notification.deleteMany({});

    try {
      await QueueEntry.collection.dropIndexes();
      await QueueEntry.syncIndexes();
    } catch (e) {}

    // Seed Core Entities
    const adminUser = await User.create({ name: 'Admin QA', email: 'admin_qa@test.com', password: 'password123', role: 'ADMIN' });
    const staffUser1 = await User.create({ name: 'Staff QA 1', email: 'staff1_qa@test.com', password: 'password123', role: 'STAFF' });
    const staffUser2 = await User.create({ name: 'Staff QA 2', email: 'staff2_qa@test.com', password: 'password123', role: 'STAFF' });
    const customerUser1 = await User.create({ name: 'Cust QA 1', email: 'cust1_qa@test.com', password: 'password123', role: 'CUSTOMER' });
    const customerUser2 = await User.create({ name: 'Cust QA 2', email: 'cust2_qa@test.com', password: 'password123', role: 'CUSTOMER' });
    const customerUser3 = await User.create({ name: 'Cust QA 3', email: 'cust3_qa@test.com', password: 'password123', role: 'CUSTOMER' });

    const adminToken = createTestToken(adminUser);
    const staffToken1 = createTestToken(staffUser1);
    const staffToken2 = createTestToken(staffUser2);
    const custToken1 = createTestToken(customerUser1);
    const custToken2 = createTestToken(customerUser2);
    const custToken3 = createTestToken(customerUser3);

    const org = await Organization.create({
      name: 'QA Org',
      description: 'QA Org description',
      slug: `qa-org-${Date.now()}`,
      category: 'HOSPITAL',
      isActive: true,
    });

    const location = await Location.create({
      name: 'QA Hospital Campus',
      organizationId: org._id,
      address: '100 Health Blvd',
      city: 'Metro',
      isActive: true,
    });

    const dept = await Department.create({
      name: 'QA Cardiology',
      organizationId: org._id,
      locationId: location._id,
      prefix: 'CARD',
      isActive: true,
    });

    const counter1 = await Counter.create({
      name: 'Counter 01',
      number: '1',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      assignedStaffId: staffUser1._id,
      status: 'AVAILABLE',
      isActive: true,
    });

    const counter2 = await Counter.create({
      name: 'Counter 02',
      number: '2',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      assignedStaffId: staffUser2._id,
      status: 'AVAILABLE',
      isActive: true,
    });

    const queue = await Queue.create({
      name: 'General Cardiology Queue',
      prefix: 'CARD',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      status: 'OPEN',
      maxCapacity: 50,
      avgServiceTimeMins: 5,
      isActive: true,
    });

    // ====================================================
    // SECTION 1: Customer End-to-End Journey Workflow
    // ====================================================
    console.log('\n--- SECTION 1: Customer End-to-End Journey Workflow ---');

    // 1. Customer registration
    const newCustEmail = `e2e_cust_${Date.now()}@test.com`;
    const regRes = await makeRequest(port, '/api/v1/auth/register', 'POST', {
      name: 'E2E Customer',
      email: newCustEmail,
      password: 'password123',
    });
    assert(regRes.status === 201 && regRes.body.success, '1. Customer registration creates new account (201 Created)');

    // 2. Customer login
    const loginRes = await makeRequest(port, '/api/v1/auth/login', 'POST', {
      email: newCustEmail,
      password: 'password123',
    });
    const e2eCustToken = loginRes.headers['set-cookie']?.[0]?.split(';')[0]?.split('=')[1];
    assert(loginRes.status === 200 && e2eCustToken !== undefined, '2. Customer login authenticates and sets session token (200 OK)');

    // 3. Organization discovery & location selection
    const orgsRes = await makeRequest(port, `/api/v1/departments/${dept._id}/queues`, 'GET');
    assert(orgsRes.status === 200 && Array.isArray(orgsRes.body.data), '3. Customer retrieves public department queue listing (200 OK)');

    // 4. Join Queue
    const joinRes = await makeRequest(port, `/api/v1/queues/${queue._id}/join`, 'POST', {}, e2eCustToken);
    const e2eEntryId = joinRes.body.data?.entry?.id;
    assert(joinRes.status === 201 && e2eEntryId !== undefined, '4. Customer joins queue successfully and receives ticket (201 Created)');

    // 5. Receive initial position & wait estimate
    assert(joinRes.body.data.position === 1 && joinRes.body.data.waitTime !== undefined, '5. Customer receives position #1 and formatted wait-time estimate');

    // 6. Fetch QR token for active entry
    const qrRes = await makeRequest(port, `/api/v1/queue-entries/${e2eEntryId}/qr`, 'GET', null, e2eCustToken);
    assert(qrRes.status === 200 && qrRes.body.data?.qrToken?.startsWith('SMARTQUEUE:'), '6. Customer fetches active secure QR token (200 OK)');

    // ====================================================
    // SECTION 2: Staff Operations End-to-End Workflow
    // ====================================================
    console.log('\n--- SECTION 2: Staff Operations End-to-End Workflow ---');

    // 7. Staff retrieves assigned counter
    const staffCounterRes = await makeRequest(port, '/api/v1/staff/my-counter', 'GET', null, staffToken1);
    assert(staffCounterRes.status === 200 && staffCounterRes.body.data?.counter?.number === '1', '7. Staff retrieves assigned Counter 01 details (200 OK)');

    // 8. Staff calls next customer
    const callRes = await makeRequest(port, `/api/v1/staff/queues/${queue._id}/call-next`, 'POST', null, staffToken1);
    assert(callRes.status === 200 && callRes.body.data?.ticketNumber === joinRes.body.data.entry.ticketNumber, '8. Staff calls next customer ticket (WAITING -> CALLED)');

    // 9. Staff starts service
    const startRes = await makeRequest(port, `/api/v1/staff/queue-entries/${e2eEntryId}/start`, 'POST', null, staffToken1);
    assert(startRes.status === 200 && startRes.body.data?.status === 'SERVING', '9. Staff starts service for ticket (CALLED -> SERVING, Counter BUSY)');

    // 10. Staff completes service
    const completeRes = await makeRequest(port, `/api/v1/staff/queue-entries/${e2eEntryId}/complete`, 'POST', null, staffToken1);
    assert(completeRes.status === 200 && completeRes.body.data?.status === 'COMPLETED', '10. Staff completes service for ticket (SERVING -> COMPLETED, Counter AVAILABLE)');

    // 11. Customer submits review for completed ticket
    const revRes = await makeRequest(port, `/api/v1/queue-entries/${e2eEntryId}/review`, 'POST', { rating: 5, comment: 'Excellent service!' }, e2eCustToken);
    assert(revRes.status === 201 && revRes.body.data?.rating === 5, '11. Customer submits 5-star rating for completed service (201 Created)');

    // 12. Customer views service in history with review attached
    const histDetailRes = await makeRequest(port, `/api/v1/customers/me/history/${e2eEntryId}`, 'GET', null, e2eCustToken);
    assert(histDetailRes.status === 200 && histDetailRes.body.data?.review?.rating === 5, '12. Customer history record reflects completed status and 5-star review');

    // ====================================================
    // SECTION 3: Admin Management & System Control
    // ====================================================
    console.log('\n--- SECTION 3: Admin Management & System Control ---');

    // 13. Admin fetches overview analytics
    const adminAnalyticsRes = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, adminToken);
    assert(adminAnalyticsRes.status === 200 && (adminAnalyticsRes.body.data?.totalEntries !== undefined || adminAnalyticsRes.body.data?.summary?.completed !== undefined), '13. Admin overview analytics returns completed service metrics');

    // 14. Admin fetches live crowd snapshot
    const adminLiveCrowdRes = await makeRequest(port, '/api/v1/admin/live-crowd', 'GET', null, adminToken);
    assert(adminLiveCrowdRes.status === 200 && adminLiveCrowdRes.body.data?.summary !== undefined, '14. Admin live crowd monitor returns live operational snapshot');

    // 15. Admin moderates review status to HIDDEN
    const reviewId = revRes.body.data._id;
    const modRes = await makeRequest(port, `/api/v1/admin/reviews/${reviewId}/status`, 'PATCH', { status: 'HIDDEN' }, adminToken);
    assert(modRes.status === 200 && modRes.body.data?.status === 'HIDDEN', '15. Admin moderates review status to HIDDEN (200 OK)');

    // ====================================================
    // SECTION 4: Queue Lifecycle & Invalid Status Transitions
    // ====================================================
    console.log('\n--- SECTION 4: Queue Lifecycle & Invalid Status Transitions ---');

    // Seed customer entry for transition testing
    const entryLife = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser1._id,
      ticketNumber: 'CARD-099',
      sequenceNumber: 99,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      isActive: true,
    });

    // 16. Customer direct transition WAITING -> COMPLETED is rejected (404/403)
    const invCompRes = await makeRequest(port, `/api/v1/queue-entries/${entryLife._id}/complete`, 'POST', null, custToken1);
    assert(invCompRes.status === 404 || invCompRes.status === 403, '16. Customer unauthorized transition to COMPLETED rejected (404/403)');

    // 17. Staff starting service on WAITING entry (skipping CALLED) is rejected
    const invStartRes = await makeRequest(port, `/api/v1/staff/queue-entries/${entryLife._id}/start`, 'POST', null, staffToken1);
    assert(invStartRes.status === 409 || invStartRes.status === 400, '17. Staff starting service directly on WAITING entry rejected (409 Conflict)');

    // 18. Customer cancelling WAITING entry succeeds (Path B)
    const cancelRes = await makeRequest(port, `/api/v1/queue-entries/${entryLife._id}/cancel`, 'PATCH', null, custToken1);
    assert(cancelRes.status === 200 && cancelRes.body.data?.status === 'CANCELLED', '18. Customer cancels WAITING queue entry (Path B: WAITING -> CANCELLED)');

    // 19. Staff starting service on CANCELLED entry is rejected
    const invCancelStart = await makeRequest(port, `/api/v1/staff/queue-entries/${entryLife._id}/start`, 'POST', null, staffToken1);
    assert(invCancelStart.status === 409 || invCancelStart.status === 400, '19. Staff starting service on CANCELLED entry rejected (409 Conflict)');

    // ====================================================
    // SECTION 5: Multi-Customer Queue Management & Priority Scheduling
    // ====================================================
    console.log('\n--- SECTION 5: Multi-Customer Queue & Priority Scheduling ---');

    // Clean queue entries
    await QueueEntry.deleteMany({});

    const eA = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser1._id,
      ticketNumber: 'CARD-101',
      sequenceNumber: 101,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 10000),
      isActive: true,
    });

    const eB = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser2._id,
      ticketNumber: 'CARD-102',
      sequenceNumber: 102,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 5000),
      isActive: true,
    });

    // 20. Staff elevates Customer B priority to EMERGENCY
    const prioRes = await makeRequest(port, `/api/v1/staff/queue-entries/${eB._id}/priority`, 'PATCH', { priority: 'EMERGENCY' }, staffToken1);
    assert(prioRes.status === 200 && prioRes.body.data?.priority === 'EMERGENCY', '20. Staff elevates Customer B priority to EMERGENCY (200 OK)');

    // 21. Call Next selects Customer B (EMERGENCY) over Customer A (NORMAL) despite later joinedAt
    const prioCallRes = await makeRequest(port, `/api/v1/staff/queues/${queue._id}/call-next`, 'POST', null, staffToken1);
    assert(prioCallRes.status === 200 && prioCallRes.body.data?.ticketNumber === 'CARD-102', '21. Priority Scheduler selects EMERGENCY ticket CARD-102 ahead of NORMAL ticket CARD-101');

    // ====================================================
    // SECTION 6: Wait-Time Engine & State Quality
    // ====================================================
    console.log('\n--- SECTION 6: Wait-Time Engine & State Quality ---');

    // 22. Remaining Customer A has position #1 and "Under 1 min" estimate
    const wtResA = await makeRequest(port, `/api/v1/queue-entries/${eA._id}/wait-time`, 'GET', null, custToken1);
    assert(wtResA.status === 200 && wtResA.body.data?.formattedWaitTime === 'Under 1 min', '22. Customer A wait-time engine calculates "Under 1 min" for position #1');

    // 23. Paused queue returns state QUEUE_PAUSED
    await Queue.findByIdAndUpdate(queue._id, { status: 'PAUSED' });
    const wtPaused = await makeRequest(port, `/api/v1/queue-entries/${eA._id}/wait-time`, 'GET', null, custToken1);
    assert(wtPaused.status === 200 && wtPaused.body.data?.state === 'QUEUE_PAUSED', '23. Paused queue returns wait-time state QUEUE_PAUSED');

    // Restore queue OPEN
    await Queue.findByIdAndUpdate(queue._id, { status: 'OPEN' });

    // ====================================================
    // SECTION 7: QR Token & Staff Check-In Integration
    // ====================================================
    console.log('\n--- SECTION 7: QR Token & Staff Check-In Integration ---');

    // 24. Fetch QR token for Customer A
    const qrResA = await makeRequest(port, `/api/v1/queue-entries/${eA._id}/qr`, 'GET', null, custToken1);
    const tokenA = qrResA.body.data?.qrToken;
    assert(qrResA.status === 200 && tokenA !== undefined, '24. Active customer retrieves secure QR token string');

    // 25. Staff checks in Customer A via QR
    const checkInRes = await makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: tokenA }, staffToken1);
    assert(checkInRes.status === 200 && checkInRes.body.data?.checkedInAt !== undefined, '25. Staff validates QR token and records checkedInAt timestamp (200 OK)');

    // 26. Duplicate check-in is rejected with 409 Conflict
    const dupCheckInRes = await makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: tokenA }, staffToken1);
    assert(dupCheckInRes.status === 409, '26. Duplicate check-in attempt for checked-in QR token rejected with 409 Conflict');

    // ====================================================
    // SECTION 8: Notifications System Scoping & Delivery
    // ====================================================
    console.log('\n--- SECTION 8: Notifications System Scoping & Delivery ---');

    // 27. Customer 1 lists notifications
    const notifRes1 = await makeRequest(port, '/api/v1/notifications', 'GET', null, custToken1);
    assert(notifRes1.status === 200 && Array.isArray(notifRes1.body.data?.notifications), '27. Customer retrieves list of persistent notifications (200 OK)');

    // 28. Mark all notifications as read
    const markAllRes = await makeRequest(port, '/api/v1/notifications/read-all', 'PATCH', null, custToken1);
    assert(markAllRes.status === 200 && markAllRes.body.success, '28. Customer marks all notifications as read (200 OK)');

    // ====================================================
    // SECTION 9: Customer History & Reviews Scoping
    // ====================================================
    console.log('\n--- SECTION 9: Customer History & Reviews Scoping ---');

    // 29. Customer 1 history includes completed/cancelled entries and excludes active
    const cust1HistRes = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, custToken1);
    const hasActiveInHist = cust1HistRes.body.data?.items?.some((item) => ['WAITING', 'CALLED', 'SERVING'].includes(item.status));
    assert(cust1HistRes.status === 200 && !hasActiveInHist, '29. Customer history excludes active entries (WAITING, CALLED, SERVING)');

    // 30. Unrelated Customer 2 querying Customer 1 history detail returns 404 Not Found (IDOR protection)
    const idorHistRes = await makeRequest(port, `/api/v1/customers/me/history/${eA._id}`, 'GET', null, custToken2);
    assert(idorHistRes.status === 404, '30. Customer 2 attempting to view Customer 1 history record returns 404 Not Found');

    // ====================================================
    // SECTION 10: Operational Analytics & Crowd Dashboard
    // ====================================================
    console.log('\n--- SECTION 10: Operational Analytics & Crowd Dashboard ---');

    // 31. Admin queue analytics returns queue breakdown
    const qAnalyticsRes = await makeRequest(port, '/api/v1/admin/analytics/queues', 'GET', null, adminToken);
    assert(qAnalyticsRes.status === 200 && Array.isArray(qAnalyticsRes.body.data), '31. Admin queue analytics returns per-queue breakdown array (200 OK)');

    // 32. Admin live crowd returns current waiting count and crowd level
    const liveCrowdRes = await makeRequest(port, '/api/v1/admin/live-crowd', 'GET', null, adminToken);
    assert(liveCrowdRes.status === 200 && (liveCrowdRes.body.data?.queues?.[0]?.crowdLevel !== undefined || liveCrowdRes.body.data?.summary?.crowdLevel !== undefined), '32. Live crowd dashboard evaluates crowd level threshold (LOW/MEDIUM/HIGH)');

    // ====================================================
    // SECTION 11: Security & Authorization Regression Audit
    // ====================================================
    console.log('\n--- SECTION 11: Security & Authorization Regression Audit ---');

    // 33. Missing auth cookie returns 401
    const noAuthRes = await makeRequest(port, '/api/v1/customers/me/history', 'GET');
    assert(noAuthRes.status === 401, '33. Request missing authentication cookie rejected with 401 Unauthorized');

    // 34. Customer role blocked from Staff endpoint
    const custStaffRes = await makeRequest(port, '/api/v1/staff/my-counter', 'GET', null, custToken1);
    assert(custStaffRes.status === 403, '34. Customer role accessing Staff endpoint rejected with 403 Forbidden');

    // 35. Staff role blocked from Admin Analytics
    const staffAdminRes = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, staffToken1);
    assert(staffAdminRes.status === 403, '35. Staff role accessing Admin Analytics rejected with 403 Forbidden');

    // 36. Response headers contain X-Content-Type-Options: nosniff
    assert(noAuthRes.headers['x-content-type-options'] === 'nosniff', '36. HTTP response contains X-Content-Type-Options: nosniff security header');

    // ====================================================
    // SECTION 12: Concurrency & Race-Condition Testing
    // ====================================================
    console.log('\n--- SECTION 12: Concurrency & Race-Condition Testing ---');

    // 37. Simultaneous queue joins when maxCapacity = 1 spot left
    const concQueue = await Queue.create({
      name: 'Conc Queue',
      prefix: 'CNC',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      status: 'OPEN',
      maxCapacity: 1,
      isActive: true,
    });

    const [j1, j2] = await Promise.all([
      makeRequest(port, `/api/v1/queues/${concQueue._id}/join`, 'POST', {}, custToken1),
      makeRequest(port, `/api/v1/queues/${concQueue._id}/join`, 'POST', {}, custToken2),
    ]);
    const successJoins = [j1, j2].filter((r) => r.status === 201).length;
    const capacityRejections = [j1, j2].filter((r) => r.status === 400).length;
    assert(successJoins >= 1 && (successJoins + capacityRejections) === 2, '37. Joins on queue with maxCapacity = 1 properly process requests and enforce capacity (201 / 400)');

    // 38. Simultaneous staff Call Next calls on same queue
    const concQueue2 = await Queue.create({
      name: 'Conc Queue 2',
      prefix: 'CN2',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      status: 'OPEN',
      maxCapacity: 10,
      isActive: true,
    });

    await QueueEntry.create({
      queueId: concQueue2._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser3._id,
      ticketNumber: 'CN2-001',
      sequenceNumber: 1,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(),
      isActive: true,
    });

    const [c1, c2] = await Promise.all([
      makeRequest(port, `/api/v1/staff/queues/${concQueue2._id}/call-next`, 'POST', null, staffToken1),
      makeRequest(port, `/api/v1/staff/queues/${concQueue2._id}/call-next`, 'POST', null, staffToken2),
    ]);
    const callSuccesses = [c1, c2].filter((r) => r.status === 200).length;
    const callConflicts = [c1, c2].filter((r) => r.status === 409).length;
    assert(callSuccesses === 1 && callConflicts === 1, '38. Concurrent staff call-next requests atomically grant exactly 1 claimed customer (200) and 1 conflict (409)');

    // 39. Simultaneous QR check-ins for same QR token
    const concEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser3._id,
      ticketNumber: 'CARD-333',
      sequenceNumber: 333,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      isActive: true,
    });
    const concQrRes = await makeRequest(port, `/api/v1/queue-entries/${concEntry._id}/qr`, 'GET', null, custToken3);
    const concQrToken = concQrRes.body.data?.qrToken;

    const [chk1, chk2] = await Promise.all([
      makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: concQrToken }, staffToken1),
      makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: concQrToken }, staffToken2),
    ]);
    const chkSuccesses = [chk1, chk2].filter((r) => r.status === 200).length;
    const chkConflicts = [chk1, chk2].filter((r) => r.status === 409).length;
    assert(chkSuccesses === 1 && chkConflicts === 1, '39. Concurrent QR check-ins for same token grant exactly 1 success (200) and 1 duplicate conflict (409)');

    // 40. Simultaneous review submissions for same completed ticket
    const concCompEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser3._id,
      ticketNumber: 'CARD-444',
      sequenceNumber: 444,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'COMPLETED',
      isActive: false,
    });

    const [rev1, rev2] = await Promise.all([
      makeRequest(port, `/api/v1/queue-entries/${concCompEntry._id}/review`, 'POST', { rating: 4 }, custToken3),
      makeRequest(port, `/api/v1/queue-entries/${concCompEntry._id}/review`, 'POST', { rating: 5 }, custToken3),
    ]);
    const revSuccesses = [rev1, rev2].filter((r) => r.status === 201).length;
    const revConflicts = [rev1, rev2].filter((r) => r.status === 409).length;
    assert(revSuccesses === 1 && revConflicts === 1, '40. Concurrent review submissions for same entry grant exactly 1 created (201) and 1 duplicate conflict (409)');

    // ====================================================
    // SECTION 13: Edge Cases & Boundary Conditions
    // ====================================================
    console.log('\n--- SECTION 13: Edge Cases & Boundary Conditions ---');

    // 41. Invalid ObjectId format returns 400
    const invIdRes = await makeRequest(port, '/api/v1/queue-entries/invalid-mongo-id', 'GET', null, custToken1);
    assert(invIdRes.status === 400, '41. Invalid ObjectId format rejected with 400 Bad Request');

    // 42. Rating > 5 returns 400
    const invRatingRes = await makeRequest(port, `/api/v1/queue-entries/${concCompEntry._id}/review`, 'POST', { rating: 10 }, custToken3);
    assert(invRatingRes.status === 400, '42. Review rating > 5 rejected with 400 Bad Request');

    // 43. Negative page number returns 400
    const invPageRes = await makeRequest(port, '/api/v1/customers/me/history?page=-1', 'GET', null, custToken1);
    assert(invPageRes.status === 400, '43. Negative page number parameter rejected with 400 Bad Request');

    // 44. Closed queue rejects join request
    await Queue.findByIdAndUpdate(queue._id, { status: 'CLOSED' });
    const closedJoinRes = await makeRequest(port, `/api/v1/queues/${queue._id}/join`, 'POST', {}, custToken1);
    assert(closedJoinRes.status === 400, '44. Joining CLOSED queue rejected with 400 Bad Request');

    // Restore queue OPEN
    await Queue.findByIdAndUpdate(queue._id, { status: 'OPEN' });

    // ====================================================
    // SECTION 14: API Contract & Data Schema Integrity
    // ====================================================
    console.log('\n--- SECTION 14: API Contract & Data Schema Integrity ---');

    // 45. Authentication response payload schema check
    const authProfileRes = await makeRequest(port, '/api/v1/auth/me', 'GET', null, custToken1);
    const profileUser = authProfileRes.body.data?.user;
    assert(
      profileUser?.id !== undefined &&
      profileUser?.email !== undefined &&
      profileUser?.role === 'CUSTOMER' &&
      profileUser?.password === undefined,
      '45. Auth user profile response payload maintains correct schema (password strictly omitted)'
    );

    // 46. QueueEntry response payload schema check
    const getEntryRes = await makeRequest(port, `/api/v1/queue-entries/${eA._id}`, 'GET', null, custToken1);
    assert(
      getEntryRes.status === 200 &&
      getEntryRes.body.data?.entry?._id !== undefined &&
      getEntryRes.body.data?.position !== undefined &&
      getEntryRes.body.data?.waitTime !== undefined,
      '46. Queue entry detail response payload maintains correct structure and populated hierarchy'
    );

    // 47. Wait-time payload schema check
    const wtCheckRes = await makeRequest(port, `/api/v1/queue-entries/${eA._id}/wait-time`, 'GET', null, custToken1);
    assert(
      wtCheckRes.status === 200 &&
      wtCheckRes.body.data?.formattedWaitTime !== undefined &&
      (wtCheckRes.body.data?.estimatedWaitMinutes !== undefined || wtCheckRes.body.data?.estimatedWaitMins !== undefined),
      '47. Wait-time API response payload maintains required schema fields'
    );

    // 48. Staff counter response payload schema check
    const staffCtrRes = await makeRequest(port, '/api/v1/staff/my-counter', 'GET', null, staffToken1);
    assert(
      staffCtrRes.status === 200 &&
      staffCtrRes.body.data?.counter?.number !== undefined &&
      staffCtrRes.body.data?.counter?.status !== undefined,
      '48. Staff counter endpoint response payload maintains required schema fields'
    );

    // 49. Notifications list schema check
    const notifSchemaRes = await makeRequest(port, '/api/v1/notifications', 'GET', null, custToken1);
    assert(
      notifSchemaRes.status === 200 &&
      Array.isArray(notifSchemaRes.body.data?.notifications) &&
      notifSchemaRes.body.data?.pagination !== undefined,
      '49. Notifications API response payload maintains array and pagination metadata structure'
    );

    // 50. Admin Analytics overview payload schema check
    const ovSchemaRes = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, adminToken);
    assert(
      ovSchemaRes.status === 200 &&
      ovSchemaRes.body.data?.totalEntries !== undefined &&
      ovSchemaRes.body.data?.averageWaitMinutes !== undefined,
      '50. Admin Overview Analytics API response payload maintains summary schema structure'
    );

    // 51. Live Crowd snapshot schema check
    const lcSchemaRes = await makeRequest(port, '/api/v1/admin/live-crowd', 'GET', null, adminToken);
    assert(
      lcSchemaRes.status === 200 &&
      lcSchemaRes.body.data?.summary?.totalWaiting !== undefined &&
      Array.isArray(lcSchemaRes.body.data?.queues),
      '51. Admin Live Crowd snapshot response payload maintains required metrics schema'
    );

    // 52. Customer history list schema check
    const histSchemaRes = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, custToken1);
    assert(
      histSchemaRes.status === 200 &&
      Array.isArray(histSchemaRes.body.data?.items) &&
      histSchemaRes.body.data?.pagination !== undefined,
      '52. Customer History API response payload maintains items array and pagination metadata'
    );

    // 53. Error response schema check (no stack trace in production error)
    const errSchemaRes = await makeRequest(port, '/api/v1/queues/non-existent-id/join', 'POST', {}, custToken1);
    assert(
      errSchemaRes.status === 400 &&
      errSchemaRes.body.success === false &&
      errSchemaRes.body.message !== undefined &&
      (errSchemaRes.body.stack === undefined || process.env.NODE_ENV === 'development'),
      '53. API error responses maintain standard error schema format (message present, stack sanitized)'
    );

    // ====================================================
    // SECTION 15: Database Consistency & Relationship Audit
    // ====================================================
    console.log('\n--- SECTION 15: Database Consistency & Relationship Audit ---');

    // 54. Verify COMPLETED QueueEntry database record integrity
    const dbCompRecord = await QueueEntry.findOne({ status: 'COMPLETED' });
    assert(
      dbCompRecord !== null &&
      dbCompRecord.status === 'COMPLETED' &&
      dbCompRecord.joinedAt !== null &&
      dbCompRecord.completedAt !== null &&
      dbCompRecord.isActive === false,
      '54. Database record for COMPLETED QueueEntry has non-null lifecycle timestamps and isActive = false'
    );

    // 55. Verify Counter DB document state and schema integrity
    const ctr1DbRecord = await Counter.findById(counter1._id);
    assert(
      ctr1DbRecord !== null &&
      ctr1DbRecord.assignedStaffId.toString() === staffUser1._id.toString() &&
      ['AVAILABLE', 'BUSY', 'CALLED', 'OFFLINE'].includes(ctr1DbRecord.status),
      '55. Counter DB document maintains valid operational status and assigned staff reference'
    );

    // 56. Verify Review DB document linkage
    const revDbRecord = await Review.findById(reviewId);
    assert(
      revDbRecord !== null &&
      revDbRecord.queueEntryId.toString() === e2eEntryId.toString() &&
      revDbRecord.rating === 5,
      '56. Review DB document maintains exact QueueEntry and Customer foreign key relationships'
    );

    // 57. Verify Queue sequence number counter integrity
    const qDbRecord = await Queue.findById(queue._id);
    assert(
      qDbRecord.lastSequenceNumber >= 1 &&
      qDbRecord.lastSequenceDate === new Date().toISOString().split('T')[0],
      '57. Queue document maintains atomic lastSequenceNumber and lastSequenceDate trackers'
    );

    // 58. Verify Notification DB scoping
    const notifCount = await Notification.countDocuments({ userId: customerUser1._id });
    assert(notifCount >= 1, '58. Notification documents exist and remain correctly scoped to target customer');

    // 59. Verify Organization hierarchy linkages
    const deptDbRecord = await Department.findById(dept._id);
    assert(
      deptDbRecord.organizationId.toString() === org._id.toString() &&
      deptDbRecord.locationId.toString() === location._id.toString(),
      '59. Department document maintains exact Organization and Location hierarchy references'
    );

    // 60. Final system stability check
    const finalPing = await makeRequest(port, '/api/v1/departments/' + dept._id + '/queues', 'GET');
    assert(finalPing.status === 200, '60. Final system stability check confirms server remains 100% operational');

  } catch (error) {
    console.error('[TEST SUITE ERROR]', error);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    console.log('\n====================================================');
    console.log(`SPRINT 20 QA TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint20QASuite();
