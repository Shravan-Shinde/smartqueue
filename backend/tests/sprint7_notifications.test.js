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
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const Notification = require('../models/Notification');

// Controllers & Routes
const { customerJoinQueue, customerCancelEntry } = require('../controllers/queueEntryController');
const {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 7 — NOTIFICATION SYSTEM VERIFICATION SUITE');
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
    // 1. Verify Notification model loads
    assert(Notification !== undefined, 'Notification model loaded successfully');

    // 2. Connect to DB
    await connectDB();
    console.log('[DB] Connected to MongoDB for Sprint 7 verification.');

    // 3. Setup HTTP + Socket.IO Server for live testing
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

    // 4. Clean test records
    await Organization.deleteMany({ slug: 'sprint7-test-org' });
    await User.deleteMany({ email: { $regex: /sprint7.*@test\.com/ } });
    await Notification.deleteMany({});

    // 5. Create Test Users
    const customer1 = await User.create({
      name: 'Sprint7 Customer 1',
      email: 'sprint7c1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Sprint7 Customer 2',
      email: 'sprint7c2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const staffUser = await User.create({
      name: 'Sprint7 Staff',
      email: 'sprint7staff@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const adminUser = await User.create({
      name: 'Sprint7 Admin',
      email: 'sprint7admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    // Generate JWT tokens
    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    const tokenC1 = jwt.sign({ userId: customer1._id.toString(), role: customer1.role }, JWT_SECRET, { expiresIn: '1d' });
    const tokenC2 = jwt.sign({ userId: customer2._id.toString(), role: customer2.role }, JWT_SECRET, { expiresIn: '1d' });

    // 6. Create Test Org, Location, Dept, Queue
    const org = await Organization.create({
      name: 'Sprint7 Test Clinic',
      description: 'Notification verification clinic',
      slug: 'sprint7-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Notification Wing',
      address: '700 Alert Rd',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'General OPD',
      prefix: 'GEN',
      avgServiceTimeMins: 15,
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'General Consultation',
      prefix: 'GEN',
      avgServiceTimeMins: 15,
      maxCapacity: 10,
      status: 'OPEN',
      isActive: true,
    });

    // Helper for connecting socket clients safely
    const connectSocketClient = (token) => {
      return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, {
          auth: { token },
          reconnection: false,
        });
        client.on('connect', () => resolve(client));
        client.on('connect_error', (err) => reject(err));
      });
    };

    const client1 = await connectSocketClient(tokenC1);
    const client2 = await connectSocketClient(tokenC2);

    assert(client1.connected && client2.connected, 'Customer 1 and Customer 2 connected to Socket.IO successfully');

    // 7. Test Customer 1 Joins Queue -> Persistent Notification & Socket Event Delivery
    const c1NotifPromise = new Promise((resolve) => client1.once('notificationCreated', resolve));

    const reqJoinC1 = {
      user: { id: customer1._id.toString(), role: customer1.role },
      params: { queueId: queue._id.toString() },
    };
    const resJoinC1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await customerJoinQueue(reqJoinC1, resJoinC1);
    assert(resJoinC1.statusCode === 201, 'Customer 1 joins queue via API (HTTP 201)');

    const socketNotifC1 = await c1NotifPromise;
    assert(
      socketNotifC1 &&
        socketNotifC1.type === 'QUEUE_JOINED' &&
        socketNotifC1.title === 'Queue Joined',
      'Customer 1 receives real-time `notificationCreated` socket event for QUEUE_JOINED'
    );

    // 8. Test PII Security in Socket Payload
    assert(
      socketNotifC1.password === undefined &&
        socketNotifC1.jwt === undefined &&
        socketNotifC1.email === undefined,
      'Notification socket payload contains NO password, JWT, or customer email'
    );

    // Verify persistence in MongoDB
    const dbNotifC1 = await Notification.findOne({ userId: customer1._id, type: 'QUEUE_JOINED' });
    assert(dbNotifC1 !== null && dbNotifC1.isRead === false, 'Notification is persisted in MongoDB with isRead = false');

    // 9. Test Customer 2 Joins Queue -> Private Room Isolation
    const c2NotifPromise = new Promise((resolve) => client2.once('notificationCreated', resolve));

    const reqJoinC2 = {
      user: { id: customer2._id.toString(), role: customer2.role },
      params: { queueId: queue._id.toString() },
    };
    const resJoinC2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await customerJoinQueue(reqJoinC2, resJoinC2);
    const socketNotifC2 = await c2NotifPromise;
    assert(socketNotifC2 && socketNotifC2.type === 'QUEUE_JOINED', 'Customer 2 receives own `notificationCreated` event in private room');

    // 10. Test Position Update & Cancellation Notifications
    const c2PosNotifPromise = new Promise((resolve) => client2.once('notificationCreated', resolve));

    const reqCancelC1 = {
      user: { id: customer1._id.toString(), role: customer1.role },
      params: { entryId: (resJoinC1.responseData.data.entry.id || resJoinC1.responseData.data.entry._id).toString() },
    };
    const resCancelC1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await customerCancelEntry(reqCancelC1, resCancelC1);
    assert(resCancelC1.statusCode === 200, 'Customer 1 cancels queue entry (HTTP 200)');

    const socketPosNotifC2 = await c2PosNotifPromise;
    assert(
      socketPosNotifC2 && socketPosNotifC2.type === 'QUEUE_POSITION_UPDATED',
      'Customer 2 receives real-time QUEUE_POSITION_UPDATED notification upon Customer 1 cancellation'
    );

    // 11. Test GET /api/v1/notifications Endpoint & Pagination
    const reqListC2 = {
      user: { id: customer2._id.toString(), role: customer2.role },
      query: { page: '1', limit: '1' },
    };
    const resListC2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await getNotifications(reqListC2, resListC2);
    assert(
      resListC2.statusCode === 200 &&
        resListC2.responseData.data.notifications.length === 1 &&
        resListC2.responseData.data.pagination.total === 2,
      'Customer 2 lists notifications with pagination (page 1, limit 1, total 2)'
    );

    // 12. Test GET /api/v1/notifications/unread-count Endpoint
    const reqCountC2 = {
      user: { id: customer2._id.toString(), role: customer2.role },
      query: {},
    };
    const resCountC2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await getUnreadCount(reqCountC2, resCountC2);
    assert(
      resCountC2.statusCode === 200 && resCountC2.responseData.data.unreadCount === 2,
      'Customer 2 unread-count returns 2 unread notifications'
    );

    // 13. Test PATCH /api/v1/notifications/:id/read Endpoint
    const notifToRead = await Notification.findOne({ userId: customer2._id });
    const reqReadC2 = {
      user: { id: customer2._id.toString(), role: customer2.role },
      params: { notificationId: notifToRead._id.toString() },
    };
    const resReadC2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await markNotificationAsRead(reqReadC2, resReadC2);
    assert(
      resReadC2.statusCode === 200 && resReadC2.responseData.data.isRead === true,
      'Customer 2 marks single notification as read'
    );

    // 14. Test Cross-Customer Modification Rejection
    const reqCrossRead = {
      user: { id: customer1._id.toString(), role: customer1.role },
      params: { notificationId: notifToRead._id.toString() },
    };
    const resCrossRead = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await markNotificationAsRead(reqCrossRead, resCrossRead);
    assert(
      resCrossRead.statusCode === 403,
      'Customer 1 modification of Customer 2 notification is rejected with HTTP 403 Forbidden'
    );

    // 15. Test PATCH /api/v1/notifications/read-all Endpoint
    const reqReadAllC2 = {
      user: { id: customer2._id.toString(), role: customer2.role },
    };
    const resReadAllC2 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; },
    };

    await markAllAsRead(reqReadAllC2, resReadAllC2);
    assert(
      resReadAllC2.statusCode === 200 && resReadAllC2.responseData.data.unreadCount === 0,
      'Customer 2 marks all notifications as read'
    );

    const remainingUnreadC2 = await Notification.countDocuments({ userId: customer2._id, isRead: false });
    assert(remainingUnreadC2 === 0, 'Database confirms zero remaining unread notifications for Customer 2');

    // 16. Cleanup Socket & DB
    client1.disconnect();
    client2.disconnect();

    await Notification.deleteMany({ userId: { $in: [customer1._id, customer2._id] } });
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [customer1._id, customer2._id, staffUser._id, adminUser._id] } });

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
