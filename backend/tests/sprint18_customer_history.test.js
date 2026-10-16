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
const Review = require('../models/Review');

const customerHistoryRoutes = require('../routes/customerHistoryRoutes');
const queueRoutes = require('../routes/queueRoutes');
const authRoutes = require('../routes/authRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_key_2026';

let server;
let app;
let port;

const makeRequest = (portNum, path, method = 'GET', body = null, cookieToken = null) => {
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
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
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

const createTestToken = (user) => {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Seed Entities
let adminUser, staffUser, customer1, customer2;
let adminToken, staffToken, customerToken1, customerToken2;
let org, location, dept, counter, queue;

// Seed Queue Entries
let entryCompleted1, entryCompleted2, entryNoShow, entryCancelled, entryWaiting, entryServing, entryCust2Completed;
let reviewCompleted1;

const runTests = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE SPRINT 18 — CUSTOMER HISTORY TEST SUITE');
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

    app.use(cookieParser());
    app.use(express.json());

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/customers/me/history', customerHistoryRoutes);
    app.use('/api/v1', queueRoutes);

    initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        console.log(`[TEST SETUP] Server listening on port ${port}`);
        resolve();
      });
    });

    // Clean Collections & Sync Indexes
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
    } catch (e) {
      // ignore if index didn't exist
    }
    try {
      await QueueEntry.collection.dropIndexes();
      await QueueEntry.syncIndexes();
    } catch (e) {
      // ignore
    }

    // Seed Users
    adminUser = await User.create({ name: 'Admin User', email: 'admin_h@test.com', password: 'password123', role: 'ADMIN' });
    staffUser = await User.create({ name: 'Staff User', email: 'staff_h@test.com', password: 'password123', role: 'STAFF' });
    customer1 = await User.create({ name: 'Alice Customer', email: 'alice_h@test.com', password: 'password123', role: 'CUSTOMER' });
    customer2 = await User.create({ name: 'Bob Customer', email: 'bob_h@test.com', password: 'password123', role: 'CUSTOMER' });

    adminToken = createTestToken(adminUser);
    staffToken = createTestToken(staffUser);
    customerToken1 = createTestToken(customer1);
    customerToken2 = createTestToken(customer2);

    // Seed Hierarchy
    org = await Organization.create({
      name: 'History Hospital',
      description: 'Test hospital description',
      slug: `hist-hosp-${Date.now()}`,
      category: 'HOSPITAL',
      isActive: true,
    });
    location = await Location.create({
      name: 'Main Campus',
      organizationId: org._id,
      address: '100 History Way',
      city: 'Metro',
      isActive: true,
    });
    dept = await Department.create({
      name: 'Cardiology',
      organizationId: org._id,
      locationId: location._id,
      prefix: 'C',
      isActive: true,
    });
    counter = await Counter.create({
      name: 'Counter 1',
      number: '1',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      status: 'AVAILABLE',
      isActive: true,
    });
    const queue1 = await Queue.create({
      name: 'Cardiology Queue 1',
      prefix: 'C',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      isActive: true,
    });
    const queue2 = await Queue.create({
      name: 'Cardiology Queue 2',
      prefix: 'C2',
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      isActive: true,
    });

    const now = Date.now();
    const dateTodayStr = new Date().toISOString().split('T')[0];
    const dateOldStr = new Date(now - 10 * 86400000).toISOString().split('T')[0];

    // 1. Customer 1 - Completed Entry #1 (Old, 10 days ago) with Review
    const joinedAt1 = new Date(now - 10 * 86400000);
    const calledAt1 = new Date(joinedAt1.getTime() + 600000); // 10 min wait (600s)
    const startedAt1 = new Date(calledAt1.getTime() + 60000); // 1 min buffer
    const completedAt1 = new Date(startedAt1.getTime() + 300000); // 5 min service (300s)

    entryCompleted1 = await QueueEntry.create({
      queueId: queue1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-001',
      sequenceNumber: 1,
      sequenceDate: dateOldStr,
      status: 'COMPLETED',
      joinedAt: joinedAt1,
      calledAt: calledAt1,
      startedAt: startedAt1,
      completedAt: completedAt1,
      calledByCounterId: counter._id,
      calledByUserId: staffUser._id,
      isActive: false,
    });

    reviewCompleted1 = await Review.create({
      customerId: customer1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      queueId: queue1._id,
      queueEntryId: entryCompleted1._id,
      rating: 5,
      comment: 'Excellent cardiology consultation!',
      status: 'PUBLISHED',
    });

    // 2. Customer 1 - Completed Entry #2 (Recent, 2 hours ago) without Review
    const joinedAt2 = new Date(now - 7200000);
    const calledAt2 = new Date(joinedAt2.getTime() + 900000); // 15 min wait (900s)
    const startedAt2 = new Date(calledAt2.getTime() + 30000);
    const completedAt2 = new Date(startedAt2.getTime() + 600000); // 10 min service (600s)

    entryCompleted2 = await QueueEntry.create({
      queueId: queue2._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-002',
      sequenceNumber: 2,
      sequenceDate: dateTodayStr,
      status: 'COMPLETED',
      joinedAt: joinedAt2,
      calledAt: calledAt2,
      startedAt: startedAt2,
      completedAt: completedAt2,
      calledByCounterId: counter._id,
      calledByUserId: staffUser._id,
      isActive: false,
    });

    // 3. Customer 1 - No-Show Entry (1 hour ago)
    const joinedAt3 = new Date(now - 3600000);
    entryNoShow = await QueueEntry.create({
      queueId: queue1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-003',
      sequenceNumber: 3,
      sequenceDate: dateTodayStr,
      status: 'NO_SHOW',
      joinedAt: joinedAt3,
      calledAt: new Date(joinedAt3.getTime() + 300000),
      noShowAt: new Date(joinedAt3.getTime() + 600000),
      isActive: false,
    });

    // 4. Customer 1 - Cancelled Entry (30 mins ago)
    const joinedAt4 = new Date(now - 1800000);
    entryCancelled = await QueueEntry.create({
      queueId: queue2._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-004',
      sequenceNumber: 4,
      sequenceDate: dateTodayStr,
      status: 'CANCELLED',
      joinedAt: joinedAt4,
      cancelledAt: new Date(joinedAt4.getTime() + 120000),
      isActive: false,
    });

    // 5. Customer 1 - Active Waiting Entry (Active, should be excluded from history)
    entryWaiting = await QueueEntry.create({
      queueId: queue1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-005',
      sequenceNumber: 5,
      sequenceDate: dateTodayStr,
      status: 'WAITING',
      joinedAt: new Date(),
      isActive: true,
    });

    // 6. Customer 1 - Active Serving Entry (Active, should be excluded from history)
    entryServing = await QueueEntry.create({
      queueId: queue2._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer1._id,
      ticketNumber: 'C-006',
      sequenceNumber: 6,
      sequenceDate: dateTodayStr,
      status: 'SERVING',
      joinedAt: new Date(now - 600000),
      calledAt: new Date(now - 300000),
      startedAt: new Date(now - 200000),
      isActive: true,
    });

    // 7. Customer 2 - Completed Entry (Belongs to Customer 2, should never leak to Customer 1)
    entryCust2Completed = await QueueEntry.create({
      queueId: queue1._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customer2._id,
      ticketNumber: 'C-007',
      sequenceNumber: 7,
      sequenceDate: dateTodayStr,
      status: 'COMPLETED',
      joinedAt: new Date(now - 5000000),
      calledAt: new Date(now - 4000000),
      startedAt: new Date(now - 3900000),
      completedAt: new Date(now - 3000000),
      isActive: false,
    });

    console.log('--- SECTION 1: Authentication & Authorization ---');

    // 1. CUSTOMER can access own history
    const res1 = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, customerToken1);
    assert(res1.status === 200 && res1.body.success === true, '1. CUSTOMER role successfully accesses customer history endpoint (200 OK)');

    // 2. Unauthenticated request rejected (401)
    const res2 = await makeRequest(port, '/api/v1/customers/me/history', 'GET');
    assert(res2.status === 401, '2. Unauthenticated request is rejected with 401 Unauthorized');

    // 3. STAFF role cannot access customer history endpoint (403)
    const res3 = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, staffToken);
    assert(res3.status === 403, '3. STAFF role is rejected from customer history endpoint with 403 Forbidden');

    // 4. ADMIN role cannot access customer history endpoint (403)
    const res4 = await makeRequest(port, '/api/v1/customers/me/history', 'GET', null, adminToken);
    assert(res4.status === 403, '4. ADMIN role is rejected from customer history endpoint with 403 Forbidden');

    console.log('\n--- SECTION 2: Customer Data Isolation & Eligibility ---');

    // 5. Only own QueueEntries returned for Customer 1
    const items1 = res1.body.data.items;
    const allOwnedByCust1 = items1.every((item) => item.customerId.toString() === customer1._id.toString());
    assert(allOwnedByCust1 && items1.length === 4, '5. Only customer 1 entries returned (4 total terminal records)');

    // 6. Other customer's entries never returned for Customer 1
    const containsCust2 = items1.some((item) => item._id.toString() === entryCust2Completed._id.toString());
    assert(!containsCust2, '6. Customer 2 entries are strictly excluded from Customer 1 history');

    // 7. COMPLETED included
    const hasCompleted = items1.some((item) => item.status === 'COMPLETED');
    assert(hasCompleted, '7. Terminal status COMPLETED is included in history');

    // 8. NO_SHOW included
    const hasNoShow = items1.some((item) => item.status === 'NO_SHOW');
    assert(hasNoShow, '8. Terminal status NO_SHOW is included in history');

    // 9. CANCELLED included
    const hasCancelled = items1.some((item) => item.status === 'CANCELLED');
    assert(hasCancelled, '9. Terminal status CANCELLED is included in history');

    // 10. WAITING excluded
    const hasWaiting = items1.some((item) => item.status === 'WAITING');
    assert(!hasWaiting, '10. Active WAITING status is excluded from customer history');

    // 11. CALLED excluded
    const hasCalled = items1.some((item) => item.status === 'CALLED');
    assert(!hasCalled, '11. Active CALLED status is excluded from customer history');

    // 12. SERVING excluded
    const hasServing = items1.some((item) => item.status === 'SERVING');
    assert(!hasServing, '12. Active SERVING status is excluded from customer history');

    console.log('\n--- SECTION 3: Pagination & Limits ---');

    // 13. Server-side pagination works (page=1, limit=2)
    const res13 = await makeRequest(port, '/api/v1/customers/me/history?page=1&limit=2', 'GET', null, customerToken1);
    assert(
      res13.status === 200 &&
      res13.body.data.items.length === 2 &&
      res13.body.data.pagination.page === 1 &&
      res13.body.data.pagination.limit === 2 &&
      res13.body.data.pagination.totalItems === 4,
      '13. Server-side pagination works accurately (page 1, limit 2)'
    );

    // 14. Page boundary metadata accurate
    const pageMeta = res13.body.data.pagination;
    assert(
      pageMeta.totalPages === 2 &&
      pageMeta.hasNextPage === true &&
      pageMeta.hasPreviousPage === false,
      '14. Pagination metadata (totalPages, hasNextPage, hasPreviousPage) accurate for page 1'
    );

    // 15. Limit parameter is enforced (page 2, limit 2)
    const res15 = await makeRequest(port, '/api/v1/customers/me/history?page=2&limit=2', 'GET', null, customerToken1);
    assert(
      res15.status === 200 &&
      res15.body.data.items.length === 2 &&
      res15.body.data.pagination.page === 2 &&
      res15.body.data.pagination.hasPreviousPage === true &&
      res15.body.data.pagination.hasNextPage === false,
      '15. Page 2 returns remaining 2 records with hasPreviousPage = true and hasNextPage = false'
    );

    // 16. Invalid page (0 or negative) rejected (400)
    const res16 = await makeRequest(port, '/api/v1/customers/me/history?page=0', 'GET', null, customerToken1);
    assert(res16.status === 400 && res16.body.success === false, '16. Invalid page = 0 rejected with 400 Bad Request');

    // 17. Invalid limit (0 or negative) rejected (400)
    const res17 = await makeRequest(port, '/api/v1/customers/me/history?limit=-5', 'GET', null, customerToken1);
    assert(res17.status === 400 && res17.body.success === false, '17. Invalid limit = -5 rejected with 400 Bad Request');

    // 18. Excessive limit (>100) clamped to 100
    const res18 = await makeRequest(port, '/api/v1/customers/me/history?limit=500', 'GET', null, customerToken1);
    assert(res18.status === 200 && res18.body.data.pagination.limit === 100, '18. Excessive limit = 500 clamped safely to maximum limit 100');

    console.log('\n--- SECTION 4: Filtering & Sorting ---');

    // 19. Status filter (status=COMPLETED) works
    const res19 = await makeRequest(port, '/api/v1/customers/me/history?status=COMPLETED', 'GET', null, customerToken1);
    assert(
      res19.status === 200 &&
      res19.body.data.items.length === 2 &&
      res19.body.data.items.every((i) => i.status === 'COMPLETED'),
      '19. Filter status = COMPLETED returns strictly 2 completed records'
    );

    // 20. Invalid status filter rejected (400)
    const res20 = await makeRequest(port, '/api/v1/customers/me/history?status=WAITING', 'GET', null, customerToken1);
    assert(res20.status === 400 && res20.body.success === false, '20. Active status WAITING filter rejected with 400 Bad Request');

    // 21. DateFrom filter works
    const yesterdayStr = new Date(now - 86400000).toISOString();
    const res21 = await makeRequest(port, `/api/v1/customers/me/history?dateFrom=${yesterdayStr}`, 'GET', null, customerToken1);
    assert(
      res21.status === 200 &&
      res21.body.data.items.length === 3 &&
      res21.body.data.items.every((i) => new Date(i.joinedAt) >= new Date(yesterdayStr)),
      '21. Filter dateFrom returns 3 recent records joined after dateFrom'
    );

    // 22. DateTo filter works
    const oldFilterStr = new Date(now - 5 * 86400000).toISOString();
    const res22 = await makeRequest(port, `/api/v1/customers/me/history?dateTo=${oldFilterStr}`, 'GET', null, customerToken1);
    assert(
      res22.status === 200 &&
      res22.body.data.items.length === 1 &&
      res22.body.data.items[0]._id.toString() === entryCompleted1._id.toString(),
      '22. Filter dateTo returns 1 historical entry joined before dateTo'
    );

    // 23. Invalid date string rejected (400)
    const res23 = await makeRequest(port, '/api/v1/customers/me/history?dateFrom=invalid-date-xyz', 'GET', null, customerToken1);
    assert(res23.status === 400 && res23.body.success === false, '23. Malformed date string rejected with 400 Bad Request');

    // 24. Default newest-first ordering (joinedAt DESC)
    const datesArr = items1.map((i) => new Date(i.joinedAt).getTime());
    const isSortedDesc = datesArr[0] >= datesArr[1] && datesArr[1] >= datesArr[2] && datesArr[2] >= datesArr[3];
    assert(isSortedDesc, '24. Customer history defaults to deterministic newest-first sort order (joinedAt DESC)');

    console.log('\n--- SECTION 5: History Detail Endpoint ---');

    // 25. Detail endpoint returns own entry details (200 OK)
    const res25 = await makeRequest(port, `/api/v1/customers/me/history/${entryCompleted1._id}`, 'GET', null, customerToken1);
    assert(
      res25.status === 200 &&
      res25.body.success === true &&
      res25.body.data.ticketNumber === 'C-001' &&
      res25.body.data.organizationId.name === 'History Hospital',
      '25. Detail endpoint returns own historical record details (200 OK)'
    );

    // 26. Detail endpoint rejects another customer's entry with 404 Not Found
    const res26 = await makeRequest(port, `/api/v1/customers/me/history/${entryCust2Completed._id}`, 'GET', null, customerToken1);
    assert(res26.status === 404 && res26.body.success === false, '26. Detail endpoint rejects another customer entry with 404 Not Found (no data leakage)');

    // 27. Detail endpoint returns 404 for non-existent entry ID
    const fakeId = new mongoose.Types.ObjectId();
    const res27 = await makeRequest(port, `/api/v1/customers/me/history/${fakeId}`, 'GET', null, customerToken1);
    assert(res27.status === 404, '27. Detail endpoint returns 404 Not Found for non-existent entry ID');

    console.log('\n--- SECTION 6: Duration Calculations & Review Integration ---');

    // 28. Actual wait duration (calledAt - joinedAt) calculated accurately in seconds
    const detailCompleted1 = res25.body.data;
    assert(detailCompleted1.actualWaitDurationSec === 600, '28. Actual wait duration calculated accurately (calledAt - joinedAt = 600s)');

    // 29. Actual service duration (completedAt - startedAt) calculated accurately in seconds
    assert(detailCompleted1.actualServiceDurationSec === 300, '29. Actual service duration calculated accurately (completedAt - startedAt = 300s)');

    // 30. Missing timestamps do not create fake duration (returns null)
    const res30 = await makeRequest(port, `/api/v1/customers/me/history/${entryCancelled._id}`, 'GET', null, customerToken1);
    assert(
      res30.status === 200 &&
      res30.body.data.actualWaitDurationSec === null &&
      res30.body.data.actualServiceDurationSec === null,
      '30. Cancelled entry with missing service timestamps returns null durations without fabricating fake numbers'
    );

    // 31. Review information included when Sprint 17 review exists
    assert(
      detailCompleted1.review.submitted === true &&
      detailCompleted1.review.rating === 5 &&
      detailCompleted1.review.comment === 'Excellent cardiology consultation!',
      '31. Review info included when Sprint 17 review exists (submitted = true, rating = 5)'
    );

    // 32. Review information submitted = false when absent
    const res32 = await makeRequest(port, `/api/v1/customers/me/history/${entryCompleted2._id}`, 'GET', null, customerToken1);
    assert(res32.status === 200 && res32.body.data.review.submitted === false, '32. Review info returns submitted = false when customer review is absent');

    // 33. Other customer's review cannot leak to another customer
    const res33 = await makeRequest(port, `/api/v1/customers/me/history/${entryCust2Completed._id}`, 'GET', null, customerToken2);
    assert(res33.status === 200 && res33.body.data.review.submitted === false, '33. Customer 2 accesses own history record without leaking Customer 1 review');

    // 34. Invalid entryId format rejected (400)
    const res34 = await makeRequest(port, '/api/v1/customers/me/history/invalid-id-xyz', 'GET', null, customerToken1);
    assert(res34.status === 400 && res34.body.success === false, '34. Invalid entryId format rejected with 400 Bad Request');

    // 35. Terminal history remains accessible after completion & Sprint 17 review submission flow intact
    const postRevRes = await makeRequest(
      port,
      `/api/v1/queue-entries/${entryCompleted2._id}/review`,
      'POST',
      { rating: 4, comment: 'Quick service on history test' },
      customerToken1
    );
    assert(postRevRes.status === 201 && postRevRes.body.success === true, '35. Sprint 17 review submission workflow remains 100% operational on completed entry');

    // Re-check history detail to confirm review info updated
    const res35Check = await makeRequest(port, `/api/v1/customers/me/history/${entryCompleted2._id}`, 'GET', null, customerToken1);
    assert(
      res35Check.status === 200 &&
      res35Check.body.data.review.submitted === true &&
      res35Check.body.data.review.rating === 4,
      '36. History detail dynamically integrates newly submitted Sprint 17 review'
    );

    // 37. Privacy Audit: Passwords, JWTs, secrets, and raw QR tokens strictly omitted from history payloads
    const hasPassword = detailCompleted1.password !== undefined;
    const hasQrToken = detailCompleted1.qrToken !== undefined;
    assert(!hasPassword && !hasQrToken, '37. Privacy Audit: Password hashes and raw QR tokens are excluded from history response payloads');

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

runTests();
