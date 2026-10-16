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

const reviewService = require('../services/reviewService');
const adminReviewRoutes = require('../routes/adminReviewRoutes');
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

// Test setup state
let adminUser, customerUser1, customerUser2, staffUser;
let adminToken, customerToken1, customerToken2, staffToken;
let org, location, dept, queue;
let completedEntry1, completedEntry2, waitingEntry, cancelledEntry;

const runTests = async () => {
  console.log('\n========================================');
  console.log('STARTING SPRINT 17: REVIEWS TEST SUITE');
  console.log('========================================\n');

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

    // Express App Initialization
    app = express();
    server = http.createServer(app);

    app.use(cookieParser());
    app.use(express.json());

    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/admin/reviews', adminReviewRoutes);
    app.use('/api/v1', queueRoutes);

    initSocketServer(server);

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        console.log(`[TEST SETUP] Server listening on port ${port}`);
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

    // Seed Data
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin_rev@test.com',
      password: 'password123',
      role: 'ADMIN',
    });
    customerUser1 = await User.create({
      name: 'John Customer',
      email: 'customer1_rev@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });
    customerUser2 = await User.create({
      name: 'Jane Customer',
      email: 'customer2_rev@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });
    staffUser = await User.create({
      name: 'Staff User',
      email: 'staff_rev@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    adminToken = createTestToken(adminUser);
    customerToken1 = createTestToken(customerUser1);
    customerToken2 = createTestToken(customerUser2);
    staffToken = createTestToken(staffUser);

    org = await Organization.create({
      name: 'Review Org',
      description: 'Test review org description',
      slug: `review-org-${Date.now()}`,
      category: 'OTHER',
      isActive: true,
    });
    location = await Location.create({
      name: 'Downtown Branch',
      organizationId: org._id,
      address: '123 Test St',
      city: 'Test City',
      isActive: true,
    });
    dept = await Department.create({
      name: 'Billing Dept',
      locationId: location._id,
      organizationId: org._id,
      prefix: 'B',
      isActive: true,
    });
    queue = await Queue.create({
      name: 'General Queue',
      prefix: 'A',
      departmentId: dept._id,
      locationId: location._id,
      organizationId: org._id,
      isActive: true,
    });

    // Seed Queue Entries
    const todayStr = new Date().toISOString().split('T')[0];

    completedEntry1 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser1._id,
      ticketNumber: 'A-001',
      sequenceNumber: 1,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      joinedAt: new Date(Date.now() - 3600000),
      calledAt: new Date(Date.now() - 1800000),
      startedAt: new Date(Date.now() - 1700000),
      completedAt: new Date(Date.now() - 600000),
      isActive: false,
    });

    completedEntry2 = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser2._id,
      ticketNumber: 'A-002',
      sequenceNumber: 2,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      joinedAt: new Date(Date.now() - 3000000),
      calledAt: new Date(Date.now() - 1500000),
      startedAt: new Date(Date.now() - 1400000),
      completedAt: new Date(Date.now() - 500000),
      isActive: false,
    });

    waitingEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser1._id,
      ticketNumber: 'A-003',
      sequenceNumber: 3,
      sequenceDate: todayStr,
      status: 'WAITING',
      joinedAt: new Date(),
      isActive: true,
    });

    cancelledEntry = await QueueEntry.create({
      queueId: queue._id,
      organizationId: org._id,
      locationId: location._id,
      departmentId: dept._id,
      customerId: customerUser1._id,
      ticketNumber: 'A-004',
      sequenceNumber: 4,
      sequenceDate: todayStr,
      status: 'CANCELLED',
      joinedAt: new Date(Date.now() - 7200000),
      cancelledAt: new Date(Date.now() - 7000000),
      isActive: false,
    });

    console.log('\n--- SECTION 1: Service Validation & Customer Review Submission ---');

    // 1. Submit review with invalid rating < 1
    const res1 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 0, comment: 'Bad' },
      customerToken1
    );
    assert(res1.status === 400 && res1.body.success === false, '1. Reject rating = 0 with 400 Bad Request');

    // 2. Submit review with invalid rating > 5
    const res2 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 6, comment: 'Too high' },
      customerToken1
    );
    assert(res2.status === 400 && res2.body.success === false, '2. Reject rating = 6 with 400 Bad Request');

    // 3. Submit review with non-integer rating
    const res3 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 4.5, comment: 'Decent' },
      customerToken1
    );
    assert(res3.status === 400 && res3.body.success === false, '3. Reject non-integer rating with 400 Bad Request');

    // 4. Submit review with comment > 500 chars
    const longComment = 'A'.repeat(501);
    const res4 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 5, comment: longComment },
      customerToken1
    );
    assert(res4.status === 400 && res4.body.success === false, '4. Reject comment exceeding 500 characters with 400 Bad Request');

    // 5. Submit review for non-completed (WAITING) ticket
    const res5 = await makeRequest(
      port,
      `/api/v1/queue-entries/${waitingEntry._id}/review`,
      'POST',
      { rating: 5, comment: 'Not finished yet' },
      customerToken1
    );
    assert(res5.status === 400 && res5.body.success === false, '5. Reject review for WAITING queue entry with 400 Bad Request');

    // 6. Submit review for CANCELLED ticket
    const res6 = await makeRequest(
      port,
      `/api/v1/queue-entries/${cancelledEntry._id}/review`,
      'POST',
      { rating: 1, comment: 'I cancelled' },
      customerToken1
    );
    assert(res6.status === 400 && res6.body.success === false, '6. Reject review for CANCELLED queue entry with 400 Bad Request');

    // 7. Submit review for ticket owned by another customer
    const res7 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 5, comment: 'Impersonator' },
      customerToken2
    );
    assert(res7.status === 403 && res7.body.success === false, '7. Reject review for ticket owned by different customer with 403 Forbidden');

    // 8. Submit valid 5-star review for completedEntry1
    const res8 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 5, comment: 'Excellent and fast service!' },
      customerToken1
    );
    assert(res8.status === 201 && res8.body.success === true && res8.body.data.rating === 5, '8. Accept valid 5-star customer review (201 Created)');

    // 9. Duplicate review submission attempt on completedEntry1
    const res9 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'POST',
      { rating: 4, comment: 'Duplicate review' },
      customerToken1
    );
    assert(res9.status === 409 && res9.body.success === false, '9. Prevent duplicate review submission for same entry with 409 Conflict');

    // 10. Submit valid 4-star review for completedEntry2
    const res10 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry2._id}/review`,
      'POST',
      { rating: 4, comment: 'Good service, friendly staff' },
      customerToken2
    );
    assert(res10.status === 201 && res10.body.success === true && res10.body.data.rating === 4, '10. Accept review for completedEntry2 by customer2');

    // 11. Customer get review for entry
    const res11 = await makeRequest(
      port,
      `/api/v1/queue-entries/${completedEntry1._id}/review`,
      'GET',
      null,
      customerToken1
    );
    assert(res11.status === 200 && res11.body.data.rating === 5 && res11.body.data.comment === 'Excellent and fast service!', '11. Customer can fetch submitted review for completed entry');

    console.log('\n--- SECTION 2: Admin Reviews Dashboard & Metrics ---');

    // 12. Unauthenticated user request to admin reviews list
    const res12 = await makeRequest(port, '/api/v1/admin/reviews', 'GET');
    assert(res12.status === 401, '12. Reject unauthenticated request to /admin/reviews with 401 Unauthorized');

    // 13. Customer request to admin reviews list
    const res13 = await makeRequest(port, '/api/v1/admin/reviews', 'GET', null, customerToken1);
    assert(res13.status === 403, '13. Reject customer role request to /admin/reviews with 403 Forbidden');

    // 14. Staff request to admin reviews list
    const res14 = await makeRequest(port, '/api/v1/admin/reviews', 'GET', null, staffToken);
    assert(res14.status === 403, '14. Reject staff role request to /admin/reviews with 403 Forbidden');

    // 15. Admin fetch reviews list
    const res15 = await makeRequest(port, '/api/v1/admin/reviews', 'GET', null, adminToken);
    assert(res15.status === 200 && res15.body.data.length === 2, '15. Admin can fetch paginated reviews list (200 OK)');

    // 16. Admin fetch summary stats
    const res16 = await makeRequest(port, '/api/v1/admin/reviews/summary', 'GET', null, adminToken);
    assert(
      res16.status === 200 &&
      res16.body.data.totalReviews === 2 &&
      res16.body.data.averageRating === 4.5 &&
      res16.body.data.breakdown[5].count === 1 &&
      res16.body.data.breakdown[4].count === 1,
      '16. Admin review summary returns correct aggregate count (2), avg rating (4.5), and star distribution'
    );

    // 17. Admin filter reviews by rating
    const res17 = await makeRequest(port, `/api/v1/admin/reviews?rating=5`, 'GET', null, adminToken);
    assert(res17.status === 200 && res17.body.data.length === 1 && res17.body.data[0].rating === 5, '17. Filter reviews by rating = 5');

    // 18. Admin moderate review status (PUBLISHED -> HIDDEN)
    const reviewToHide = res15.body.data[0];
    const res18 = await makeRequest(
      port,
      `/api/v1/admin/reviews/${reviewToHide._id}/status`,
      'PATCH',
      { status: 'HIDDEN' },
      adminToken
    );
    assert(res18.status === 200 && res18.body.data.status === 'HIDDEN', '18. Admin can toggle review status to HIDDEN');

    // 19. Admin filter reviews by status = HIDDEN
    const res19 = await makeRequest(port, `/api/v1/admin/reviews?status=HIDDEN`, 'GET', null, adminToken);
    assert(res19.status === 200 && res19.body.data.length === 1 && res19.body.data[0].status === 'HIDDEN', '19. Filter reviews by status = HIDDEN');

    // 20. Privacy Audit: Ensure customer payload in review response omits password / JWT / QR tokens
    const sampleReview = res15.body.data[0];
    const hasPassword = sampleReview.customerId && sampleReview.customerId.password !== undefined;
    const hasQrToken = sampleReview.queueEntryId && sampleReview.queueEntryId.qrToken !== undefined;
    assert(!hasPassword && !hasQrToken, '20. Privacy Audit: Passwords and QR tokens are excluded from review response payload');

  } catch (err) {
    console.error('[TEST ERROR]', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('\n========================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================\n');
  }
};

runTests();
