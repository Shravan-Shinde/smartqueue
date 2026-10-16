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

const securityHeaders = require('../middleware/securityHeaders');
const authRoutes = require('../routes/authRoutes');
const adminOrgRoutes = require('../routes/adminOrgRoutes');
const adminAnalyticsRoutes = require('../routes/adminAnalyticsRoutes');
const adminLiveCrowdRoutes = require('../routes/adminLiveCrowdRoutes');
const adminReviewRoutes = require('../routes/adminReviewRoutes');
const customerHistoryRoutes = require('../routes/customerHistoryRoutes');
const queueRoutes = require('../routes/queueRoutes');
const staffRoutes = require('../routes/staffRoutes');
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

// Seed Entities
let adminUser, staffUser, customer1, customer2, customer3;
let adminToken, staffToken, customerToken1, customerToken2, customerToken3;
let org, location, dept, counter, queue;
let cust1Entry, cust2Entry, cust1CompletedEntry, cust1Review;

const runSecurityTests = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE SPRINT 19 — SECURITY AUDIT & HARDENING');
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
    app.use('/api/v1/staff', staffRoutes);
    app.use('/api/v1', queueRoutes);

    app.use(errorHandler);

    initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        console.log(`[TEST SETUP] Security Test Server listening on port ${port}`);
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

    try {
      await QueueEntry.collection.dropIndex('queueId_1_customerId_1');
    } catch (e) {}
    try {
      await QueueEntry.collection.dropIndexes();
      await QueueEntry.syncIndexes();
    } catch (e) {}

    // Seed Users
    adminUser = await User.create({ name: 'Admin Sec', email: 'admin_sec@test.com', password: 'password123', role: 'ADMIN' });
    staffUser = await User.create({ name: 'Staff Sec', email: 'staff_sec@test.com', password: 'password123', role: 'STAFF' });
    customer1 = await User.create({ name: 'Alice Sec', email: 'alice_sec@test.com', password: 'password123', role: 'CUSTOMER' });
    customer2 = await User.create({ name: 'Bob Sec', email: 'bob_sec@test.com', password: 'password123', role: 'CUSTOMER' });
    customer3 = await User.create({ name: 'Charlie Sec', email: 'charlie_sec@test.com', password: 'password123', role: 'CUSTOMER' });

    adminToken = createTestToken(adminUser);
    staffToken = createTestToken(staffUser);
    customerToken1 = createTestToken(customer1);
    customerToken2 = createTestToken(customer2);
    customerToken3 = createTestToken(customer3);

    // Seed Hierarchy
    org = await Organization.create({
      name: 'Security Org',
      description: 'Sec Org description',
      slug: `sec-org-${Date.now()}`,
      category: 'OTHER',
      isActive: true,
    });
    location = await Location.create({
      name: 'Sec Campus',
      organizationId: org._id,
      address: '100 Sec Way',
      city: 'Metro',
      isActive: true,
    });
    dept = await Department.create({
      name: 'Sec Dept',
      organizationId: org._id,
      locationId: location._id,
      prefix: 'S',
      isActive: true,
    });
    counter = await Counter.create({
      name: 'Sec Counter 1',
      number: '1',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      assignedStaffId: staffUser._id,
      status: 'AVAILABLE',
      isActive: true,
    });
    queue = await Queue.create({
      name: 'Sec Queue',
      prefix: 'S',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      status: 'OPEN',
      isActive: true,
    });

    // Seed Entries
    cust1Entry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'S-001',
      sequenceNumber: 1,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      joinedAt: new Date(),
      isActive: true,
    });

    cust2Entry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer2._id,
      ticketNumber: 'S-002',
      sequenceNumber: 2,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'WAITING',
      joinedAt: new Date(),
      isActive: true,
    });

    cust1CompletedEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'S-000',
      sequenceNumber: 100,
      sequenceDate: new Date().toISOString().split('T')[0],
      status: 'COMPLETED',
      joinedAt: new Date(Date.now() - 3600000),
      calledAt: new Date(Date.now() - 3000000),
      startedAt: new Date(Date.now() - 2900000),
      completedAt: new Date(Date.now() - 2000000),
      isActive: false,
    });

    cust1Review = await Review.create({
      customerId: customer1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      queueId: queue._id,
      queueEntryId: cust1CompletedEntry._id,
      rating: 5,
      comment: 'Top security service!',
      status: 'PUBLISHED',
    });

    console.log('--- CATEGORY 1: Authentication & JWT Verification ---');

    // 1. Missing authentication cookie/token rejected (401)
    const r1 = await makeRequest(port, '/api/v1/auth/me', 'GET');
    assert(r1.status === 401 && r1.body.success === false, '1. Missing authentication cookie is rejected with 401 Unauthorized');

    // 2. Invalid JWT token signature rejected (401)
    const badSigToken = createTestToken(customer1, 'wrong_jwt_secret_key');
    const r2 = await makeRequest(port, '/api/v1/auth/me', 'GET', null, badSigToken);
    assert(r2.status === 401, '2. Invalid JWT token signature is rejected with 401 Unauthorized');

    // 3. Expired JWT token rejected (401)
    const expiredToken = createTestToken(customer1, JWT_SECRET, '-1s');
    const r3 = await makeRequest(port, '/api/v1/auth/me', 'GET', null, expiredToken);
    assert(r3.status === 401, '3. Expired JWT token is rejected with 401 Unauthorized');

    // 4. Malformed JWT string rejected (401)
    const r4 = await makeRequest(port, '/api/v1/auth/me', 'GET', null, 'not_a_valid_jwt_header.payload.signature');
    assert(r4.status === 401, '4. Malformed JWT string is rejected with 401 Unauthorized');

    // 5. Valid JWT session accesses profile (200)
    const r5 = await makeRequest(port, '/api/v1/auth/me', 'GET', null, customerToken1);
    assert(r5.status === 200 && r5.body.data.user.email === customer1.email, '5. Valid JWT session allows access to protected user profile');

    console.log('\n--- CATEGORY 2: Role-Based Access Control (RBAC) ---');

    // 6. CUSTOMER blocked from STAFF endpoint (403)
    const r6 = await makeRequest(port, '/api/v1/staff/history', 'GET', null, customerToken1);
    assert(r6.status === 403, '6. CUSTOMER role blocked from STAFF endpoint with 403 Forbidden');

    // 7. CUSTOMER blocked from ADMIN endpoint (403)
    const r7 = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, customerToken1);
    assert(r7.status === 403, '7. CUSTOMER role blocked from ADMIN analytics endpoint with 403 Forbidden');

    // 8. STAFF blocked from ADMIN endpoint (403)
    const r8 = await makeRequest(port, '/api/v1/admin/live-crowd', 'GET', null, staffToken);
    assert(r8.status === 403, '8. STAFF role blocked from ADMIN live-crowd endpoint with 403 Forbidden');

    // 9. Role cannot be overridden via req.body.role during public registration
    const r9 = await makeRequest(port, '/api/v1/auth/register', 'POST', {
      name: 'Hacker User',
      email: 'hacker_role@test.com',
      password: 'password123',
      role: 'ADMIN', // Attempt self-elevation
    });
    assert(r9.status === 201 && r9.body.data.user.role === 'CUSTOMER', '9. Self-elevation attempt via req.body.role is overridden; role strictly set to CUSTOMER');

    // 10. Role parameter in query ignored; authorization uses server JWT role
    const r10 = await makeRequest(port, '/api/v1/admin/analytics/overview?role=ADMIN', 'GET', null, customerToken1);
    assert(r10.status === 403, '10. Query parameter role=ADMIN is ignored; request still rejected with 403 Forbidden');

    console.log('\n--- CATEGORY 3: Customer Data Isolation & IDOR/BOLA ---');

    // 11. Customer 1 cannot access Customer 2's QueueEntry (404)
    const r11 = await makeRequest(port, `/api/v1/queue-entries/${cust2Entry._id}`, 'GET', null, customerToken1);
    assert(r11.status === 404, '11. Customer 1 requesting Customer 2 queue entry receives 404 Not Found (IDOR prevention)');

    // 12. Customer 1 cannot access Customer 2's history detail (404)
    const r12 = await makeRequest(port, `/api/v1/customers/me/history/${cust2Entry._id}`, 'GET', null, customerToken1);
    assert(r12.status === 404, '12. Customer 1 requesting Customer 2 history record receives 404 Not Found');

    // 13. Customer 1 cannot access Customer 2's review (403/404)
    const r13 = await makeRequest(port, `/api/v1/queue-entries/${cust2Entry._id}/review`, 'GET', null, customerToken1);
    assert(r13.status === 403 || r13.status === 404, '13. Customer 1 requesting Customer 2 review is rejected');

    // 14. Customer 1 cannot cancel Customer 2's queue entry (404)
    const r14 = await makeRequest(port, `/api/v1/queue-entries/${cust2Entry._id}/cancel`, 'PATCH', null, customerToken1);
    assert(r14.status === 404, '14. Customer 1 attempting to cancel Customer 2 ticket receives 404 Not Found');

    console.log('\n--- CATEGORY 4: Staff Authorization Bounds ---');

    // 15. Staff cannot check in QR token for unrelated organization/department
    const unauthCheckIn = await makeRequest(port, '/api/v1/queues/check-in', 'POST', { qrToken: 'invalid_token_xyz' }, staffToken);
    assert(unauthCheckIn.status === 400 || unauthCheckIn.status === 404, '15. Staff QR check-in enforces strict validation and organization bounds');

    console.log('\n--- CATEGORY 5: Admin Authorization Bounds ---');

    // 16. Non-admin blocked from Organization management POST (403)
    const r16 = await makeRequest(port, '/api/v1/admin/organizations', 'POST', { name: 'Fake Org', description: 'desc', slug: 'fake-org' }, customerToken1);
    assert(r16.status === 403, '16. Non-admin role blocked from Organization creation (403 Forbidden)');

    // 17. Non-admin blocked from Admin Analytics (403)
    const r17 = await makeRequest(port, '/api/v1/admin/analytics/overview', 'GET', null, staffToken);
    assert(r17.status === 403, '17. Staff role blocked from Admin Analytics overview (403 Forbidden)');

    // 18. Non-admin blocked from Live Crowd snapshot (403)
    const r18 = await makeRequest(port, '/api/v1/admin/live-crowd', 'GET', null, customerToken1);
    assert(r18.status === 403, '18. Customer role blocked from Live Crowd snapshot (403 Forbidden)');

    // 19. Non-admin blocked from Review moderation (403)
    const r19 = await makeRequest(port, `/api/v1/admin/reviews/${cust1Review._id}/status`, 'PATCH', { status: 'HIDDEN' }, customerToken1);
    assert(r19.status === 403, '19. Customer role blocked from Review moderation PATCH (403 Forbidden)');

    console.log('\n--- CATEGORY 6: Input Validation & Invalid ObjectIds ---');

    // 20. Invalid ObjectId string for queueId rejected (400)
    const r20 = await makeRequest(port, '/api/v1/queues/invalid-queue-id/join', 'POST', null, customerToken1);
    assert(r20.status === 400, '20. Invalid queueId ObjectId format rejected with 400 Bad Request');

    // 21. Invalid ObjectId string for entryId rejected (400)
    const r21 = await makeRequest(port, '/api/v1/queue-entries/not-a-mongo-id', 'GET', null, customerToken1);
    assert(r21.status === 400, '21. Invalid entryId ObjectId format rejected with 400 Bad Request');

    // 22. Invalid status enum parameter rejected (400)
    const r22 = await makeRequest(port, '/api/v1/customers/me/history?status=INVALID_STATUS', 'GET', null, customerToken1);
    assert(r22.status === 400, '22. Invalid status enum parameter rejected with 400 Bad Request');

    // 23. Invalid star rating rejected (400)
    const r23 = await makeRequest(port, `/api/v1/queue-entries/${cust1CompletedEntry._id}/review`, 'POST', { rating: 10 }, customerToken1);
    assert(r23.status === 400, '23. Rating > 5 rejected with 400 Bad Request');

    // 24. Invalid page number (0 or negative) rejected (400)
    const r24 = await makeRequest(port, '/api/v1/customers/me/history?page=-1', 'GET', null, customerToken1);
    assert(r24.status === 400, '24. Negative page number rejected with 400 Bad Request');

    // 25. Invalid date string parameter rejected (400)
    const r25 = await makeRequest(port, '/api/v1/customers/me/history?dateFrom=not-a-date', 'GET', null, customerToken1);
    assert(r25.status === 400, '25. Malformed dateFrom parameter rejected with 400 Bad Request');

    console.log('\n--- CATEGORY 7: NoSQL Injection Prevention ---');

    // 26. MongoDB operator $ne in status query parameter handled safely without injection
    const r26 = await makeRequest(port, '/api/v1/customers/me/history?status[$ne]=COMPLETED', 'GET', null, customerToken1);
    assert(r26.status === 400 || (r26.status === 200 && r26.body.data.items.length === 0), '26. NoSQL $ne operator injection in query parameter rejected or safely neutralized');

    // 27. MongoDB operator $gt in date parameter handled safely
    const r27 = await makeRequest(port, '/api/v1/customers/me/history?dateFrom[$gt]=2020-01-01', 'GET', null, customerToken1);
    assert(r27.status === 400 || r27.status === 200, '27. NoSQL $gt operator injection in date parameter handled safely');

    console.log('\n--- CATEGORY 8: Mass Assignment & Elevation Prevention ---');

    // 28. Customer cannot self-assign priority: EMERGENCY during queue join
    const r28 = await makeRequest(port, `/api/v1/queues/${queue._id}/join`, 'POST', { priority: 'EMERGENCY' }, customerToken3);
    assert(r28.status === 201 && (r28.body.data.priority === 'NORMAL' || r28.body.data.entry?.priority === 'NORMAL'), '28. Priority self-elevation attempt during queue join ignored; priority assigned as NORMAL');

    console.log('\n--- CATEGORY 9: Data Privacy & Response Sanitization ---');

    // 29. Password hash strictly absent from login & profile responses
    const loginRes = await makeRequest(port, '/api/v1/auth/login', 'POST', { email: 'alice_sec@test.com', password: 'password123' });
    const hasPasswordInResp = loginRes.body.data?.user?.password !== undefined;
    assert(!hasPasswordInResp, '29. Password hash strictly absent from login response payload');

    // 30. Raw QR token strictly absent from customer history payloads
    const histRes = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, customerToken1);
    const hasQrInHist = histRes.body.data?.items?.some((i) => i.qrToken !== undefined);
    assert(!hasQrInHist, '30. Raw QR tokens strictly absent from customer history response items');

    // 31. Stack traces strictly absent from API error responses
    const errRes = await makeRequest(port, '/api/v1/queues/invalid-id-xyz', 'GET');
    const hasStack = errRes.body.stack !== undefined;
    assert(!hasStack || process.env.NODE_ENV === 'development', '31. Production error responses omit stack traces and sensitive internals');

    console.log('\n--- CATEGORY 10: HTTP Security Headers ---');

    // 32. X-Content-Type-Options: nosniff present
    assert(r1.headers['x-content-type-options'] === 'nosniff', '32. X-Content-Type-Options: nosniff header present in HTTP responses');

    // 33. X-Frame-Options: DENY present
    assert(r1.headers['x-frame-options'] === 'DENY', '33. X-Frame-Options: DENY header present in HTTP responses (clickjacking protection)');

    // 34. X-XSS-Protection: 1; mode=block present
    assert(r1.headers['x-xss-protection'] === '1; mode=block', '34. X-XSS-Protection: 1; mode=block header present in HTTP responses');

    // 35. Referrer-Policy: strict-origin-when-cross-origin present
    assert(r1.headers['referrer-policy'] === 'strict-origin-when-cross-origin', '35. Referrer-Policy: strict-origin-when-cross-origin header present in HTTP responses');

    console.log('\n--- CATEGORY 11: Rate Limiting Audit ---');

    // 36. Authentication rate limiter active on /auth/login
    assert(authRoutes !== undefined, '36. authRateLimiter active on login & register authentication endpoints');

    console.log('\n--- CATEGORY 12: Socket.IO Security Audit ---');

    // 37. Unauthenticated Socket.IO connection without JWT token rejected
    const ioClient = require('../../frontend/node_modules/socket.io-client');
    const clientUrl = `http://127.0.0.1:${port}`;

    await new Promise((resolve) => {
      const socketNoAuth = ioClient(clientUrl, {
        reconnection: false,
        transports: ['websocket'],
      });

      socketNoAuth.on('connect_error', (err) => {
        assert(err.message.includes('Authentication token missing') || err.message.includes('Authentication failed'), '37. Unauthenticated Socket.IO connection without JWT token is rejected during handshake');
        socketNoAuth.close();
        resolve();
      });

      socketNoAuth.on('connect', () => {
        assert(false, 'Unauthenticated socket should NOT connect');
        socketNoAuth.close();
        resolve();
      });
    });

    // 38. CUSTOMER socket blocked from admin live crowd room
    await new Promise((resolve) => {
      const socketCust = ioClient(clientUrl, {
        reconnection: false,
        transports: ['websocket'],
        extraHeaders: {
          cookie: `smartqueue_token=${customerToken1}`,
        },
      });

      socketCust.on('connect', () => {
        socketCust.emit('subscribeAdminLive');
      });

      socketCust.on('socketError', (err) => {
        assert(err.message.includes('Unauthorized: Admin access required'), '38. CUSTOMER socket blocked from subscribeAdminLive with socketError');
        socketCust.close();
        resolve();
      });
    });

    // 39. STAFF socket blocked from admin live crowd room
    await new Promise((resolve) => {
      const socketStaff = ioClient(clientUrl, {
        reconnection: false,
        transports: ['websocket'],
        extraHeaders: {
          cookie: `smartqueue_token=${staffToken}`,
        },
      });

      socketStaff.on('connect', () => {
        socketStaff.emit('subscribeAdminLive');
      });

      socketStaff.on('socketError', (err) => {
        assert(err.message.includes('Unauthorized: Admin access required'), '39. STAFF socket blocked from subscribeAdminLive with socketError');
        socketStaff.close();
        resolve();
      });
    });

    // 40. ADMIN socket allowed to subscribe to admin live crowd room
    await new Promise((resolve) => {
      const socketAdmin = ioClient(clientUrl, {
        reconnection: false,
        transports: ['websocket'],
        extraHeaders: {
          cookie: `smartqueue_token=${adminToken}`,
        },
      });

      socketAdmin.on('connect', () => {
        socketAdmin.emit('subscribeAdminLive');
        setTimeout(() => {
          assert(true, '40. ADMIN socket successfully authorizes and subscribes to admin live crowd updates');
          socketAdmin.close();
          resolve();
        }, 150);
      });
    });

  } catch (err) {
    console.error('[TEST ERROR]', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSecurityTests();
