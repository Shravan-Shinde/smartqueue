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

// Controllers & APIs
const { customerJoinQueue, customerGetActiveEntry, customerCancelEntry } = require('../controllers/queueEntryController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 6 — REAL-TIME QUEUE VERIFICATION SUITE');
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
    // 1. Connect to DB
    await connectDB();
    console.log('[DB] Connected to MongoDB for Sprint 6 verification.');

    // 2. Setup HTTP + Socket.IO Server for live testing
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

    assert(ioServer !== undefined, 'Socket.IO Server initialized successfully');

    // 3. Clean test records
    await Organization.deleteMany({ slug: 'sprint6-test-org' });
    await User.deleteMany({ email: { $regex: /sprint6.*@test\.com/ } });

    // 4. Create Test Users
    const customer1 = await User.create({
      name: 'Sprint6 Customer 1',
      email: 'sprint6c1@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customer2 = await User.create({
      name: 'Sprint6 Customer 2',
      email: 'sprint6c2@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    // Generate JWT tokens using userId matching authController schema
    const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
    process.env.JWT_SECRET = JWT_SECRET;

    const tokenC1 = jwt.sign({ userId: customer1._id.toString(), role: customer1.role, name: customer1.name }, JWT_SECRET, {
      expiresIn: '1d',
    });
    const tokenC2 = jwt.sign({ userId: customer2._id.toString(), role: customer2.role, name: customer2.name }, JWT_SECRET, {
      expiresIn: '1d',
    });

    // 5. Create Test Org, Location, Dept, Queue
    const org = await Organization.create({
      name: 'Sprint6 Test Hospital',
      description: 'Real-time testing organization',
      slug: 'sprint6-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Realtime Pavilion',
      address: '500 Live St',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Urgent Care',
      prefix: 'URG',
      avgServiceTimeMins: 10,
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Urgent Live Queue',
      prefix: 'URG',
      avgServiceTimeMins: 10,
      maxCapacity: 10,
      status: 'OPEN',
      isActive: true,
    });

    // Helper for connecting socket clients safely
    const connectSocketClient = (token) => {
      return new Promise((resolve, reject) => {
        const client = Client(`http://localhost:${port}`, {
          auth: { token },
          extraHeaders: {
            cookie: `smartqueue_token=${token}`,
          },
          reconnection: false,
        });

        client.on('connect', () => resolve(client));
        client.on('connect_error', (err) => reject(err));
      });
    };

    // 6. Test Socket Handshake JWT Authentication
    let client1, client2;
    try {
      client1 = await connectSocketClient(tokenC1);
      assert(client1.connected, 'Authenticated client 1 connects to Socket.IO successfully');
    } catch (err) {
      assert(false, `Authenticated client 1 connection failed: ${err.message}`);
    }

    try {
      client2 = await connectSocketClient(tokenC2);
      assert(client2.connected, 'Authenticated client 2 connects to Socket.IO successfully');
    } catch (err) {
      assert(false, `Authenticated client 2 connection failed: ${err.message}`);
    }

    // 7. Test Unauthenticated Socket Connection Rejection
    const unauthClient = Client(`http://localhost:${port}`, {
      reconnection: false,
    });

    let unauthFailed = false;
    await new Promise((resolve) => {
      unauthClient.on('connect_error', (err) => {
        unauthFailed = true;
        resolve();
      });
      unauthClient.on('connect', () => resolve());
    });
    assert(unauthFailed, 'Unauthenticated socket client connection is rejected during handshake');

    // 8. Test Queue Room Subscription & Real-Time Event Emission on Join
    client1.emit('subscribeQueue', queue._id.toString());
    client2.emit('subscribeQueue', queue._id.toString());

    // Setup listener promises
    const c1YourQueuePromise = new Promise((resolve) => client1.once('yourQueueUpdated', resolve));
    const c2PublicQueuePromise = new Promise((resolve) => client2.once('queueUpdated', resolve));

    // Execute Join Queue for Customer 1 via controller mock request/res
    const reqC1 = {
      user: { id: customer1._id.toString(), role: customer1.role, name: customer1.name },
      params: { queueId: queue._id.toString() },
    };
    const resC1 = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      },
    };

    await customerJoinQueue(reqC1, resC1);
    assert(resC1.statusCode === 201, 'Customer 1 joins queue via API successfully (HTTP 201)');

    const c1PrivateData = await c1YourQueuePromise;
    assert(
      c1PrivateData && c1PrivateData.ticketNumber === 'URG-001' && c1PrivateData.position === 1,
      'Customer 1 receives private `yourQueueUpdated` socket event with position #1 and ticket URG-001'
    );

    const c2PublicData = await c2PublicQueuePromise;
    assert(
      c2PublicData && c2PublicData.queueId === queue._id.toString() && c2PublicData.waitingCount === 1,
      'Customer 2 receives public aggregate `queueUpdated` event with waitingCount 1'
    );

    // 9. Test PII Protection in Public Queue Event
    assert(
      c2PublicData.customerId === undefined &&
        c2PublicData.name === undefined &&
        c2PublicData.email === undefined &&
        c2PublicData.ticketNumber === undefined,
      'Public `queueUpdated` event contains NO customer PII or individual ticket info'
    );

    // 10. Test Customer 2 Joining Queue
    const c2YourQueuePromise = new Promise((resolve) => client2.once('yourQueueUpdated', resolve));
    const reqC2 = {
      user: { id: customer2._id.toString(), role: customer2.role, name: customer2.name },
      params: { queueId: queue._id.toString() },
    };
    const resC2 = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      },
    };

    await customerJoinQueue(reqC2, resC2);
    assert(resC2.statusCode === 201, 'Customer 2 joins queue via API successfully (HTTP 201)');

    const c2PrivateData = await c2YourQueuePromise;
    assert(
      c2PrivateData && c2PrivateData.ticketNumber === 'URG-002' && c2PrivateData.position === 2,
      'Customer 2 receives private `yourQueueUpdated` socket event with position #2'
    );

    // 11. Test Real-Time Position Advance on Customer 1 Cancellation
    const c2PositionAdvancePromise = new Promise((resolve) => client2.once('yourQueueUpdated', resolve));

    const reqCancelC1 = {
      user: { id: customer1._id.toString(), role: customer1.role },
      params: { entryId: (resC1.responseData.data.entry.id || resC1.responseData.data.entry._id).toString() },
    };
    const resCancelC1 = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.responseData = data;
        return this;
      },
    };

    await customerCancelEntry(reqCancelC1, resCancelC1);
    assert(resCancelC1.statusCode === 200, 'Customer 1 cancels queue entry successfully (HTTP 200)');

    const c2AdvancedData = await c2PositionAdvancePromise;
    assert(
      c2AdvancedData && c2AdvancedData.position === 1 && c2AdvancedData.peopleAhead === 0,
      'Customer 2 automatically receives real-time position advancement to #1 (0 people ahead) when Customer 1 cancels'
    );

    // 12. Cleanup Client Connections and DB
    client1.disconnect();
    client2.disconnect();
    unauthClient.disconnect();

    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [customer1._id, customer2._id] } });

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
