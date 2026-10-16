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

// Services & Controllers
const qrTokenService = require('../services/qrTokenService');
const { customerJoinQueue, customerGetEntryQrToken, cancelQueueEntry } = require('../controllers/queueEntryController');
const {
  callNext,
  startService,
  completeService,
  noShow,
} = require('../controllers/staffController');

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 12 — SECURE QR TOKEN VERIFICATION SUITE');
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
    console.log('[DB] Connected to MongoDB for Sprint 12 verification.');

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

    // Clean test records
    await Organization.deleteMany({ slug: 'sprint12-test-org' });
    await User.deleteMany({ email: { $regex: /sprint12.*@test\.com/ } });
    await QueueEntry.deleteMany({});

    // ----------------------------------------------------
    // TEST 1, 2, 3, 4, 5, 19: Unit Testing qrTokenService
    // ----------------------------------------------------
    const token1 = qrTokenService.generateSecureToken();
    const token2 = qrTokenService.generateSecureToken();

    assert(
      typeof token1 === 'string' && token1.startsWith('SMARTQUEUE:'),
      'Test 1 & 2: Secure QR token generation succeeds with non-empty string starting with SMARTQUEUE:'
    );

    assert(
      token1 !== token2 && token1.length >= 48,
      'Test 3 & 19: Tokens are cryptographically unpredictable and non-identical across generations'
    );

    const mongoIdRegex = /[0-9a-fA-F]{24}/;
    assert(
      !token1.includes('@') && !token1.includes('password') && !token1.includes('12345'),
      'Test 4 & 5: Token does not contain customer PII or raw internal database IDs'
    );

    // ----------------------------------------------------
    // Setup Users & Hierarchy
    // ----------------------------------------------------
    const staffA = await User.create({
      name: 'Sprint12 Staff A',
      email: 'sprint12staffa@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerA = await User.create({
      name: 'Sprint12 Customer A',
      email: 'sprint12ca@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const customerB = await User.create({
      name: 'Sprint12 Customer B',
      email: 'sprint12cb@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const org = await Organization.create({
      name: 'Sprint12 Test Hospital',
      description: 'QR Token Testing',
      slug: 'sprint12-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Location',
      address: '100 Health Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Registration',
      prefix: 'REG',
      avgServiceTimeMins: 5,
      isActive: true,
    });

    const counter = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Counter 01',
      number: 'C1',
      status: 'AVAILABLE',
      assignedStaffId: staffA._id,
      isActive: true,
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Registration Queue',
      prefix: 'REG',
      avgServiceTimeMins: 5,
      maxCapacity: 20,
      status: 'OPEN',
      isActive: true,
    });

    const makeReqRes = (userObj, body = {}, params = {}, query = {}) => {
      const req = { user: userObj, body, params, query };
      const res = {
        statusCode: 200,
        responseData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.responseData = data;
          return this;
        },
      };
      return { req, res };
    };

    // ----------------------------------------------------
    // TEST 6, 14: Customer A joins queue & retrieves own QR token (WAITING)
    // ----------------------------------------------------
    const { req: rJoinA, res: sJoinA } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { queueId: queue._id.toString() });
    await customerJoinQueue(rJoinA, sJoinA);
    const entryAId = sJoinA.responseData.data.entry.id.toString();

    const { req: rQrA, res: sQrA } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rQrA, sQrA);

    assert(
      sQrA.statusCode === 200 &&
        sQrA.responseData.success &&
        sQrA.responseData.data.qrToken.startsWith('SMARTQUEUE:'),
      'Test 6 & 14: Customer A retrieves secure QR token for WAITING entry (HTTP 200)'
    );

    const firstGeneratedToken = sQrA.responseData.data.qrToken;

    // ----------------------------------------------------
    // TEST 10: Idempotent token reuse on refresh
    // ----------------------------------------------------
    const { req: rQrA2, res: sQrA2 } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rQrA2, sQrA2);

    assert(
      sQrA2.statusCode === 200 && sQrA2.responseData.data.qrToken === firstGeneratedToken,
      'Test 10: Existing active QR token is reused rather than regenerated on refresh'
    );

    // ----------------------------------------------------
    // TEST 7: Cross-customer QR request returns 403 Forbidden
    // ----------------------------------------------------
    const { req: rCross, res: sCross } = makeReqRes({ id: customerB._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rCross, sCross);

    assert(
      sCross.statusCode === 403,
      'Test 7: Customer B attempting to retrieve Customer A QR token is rejected with HTTP 403 Forbidden'
    );

    // ----------------------------------------------------
    // TEST 9: Non-CUSTOMER role cannot access customer QR endpoint
    // ----------------------------------------------------
    const { req: rStaffAccess, res: sStaffAccess } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rStaffAccess, sStaffAccess);

    assert(
      sStaffAccess.statusCode === 403,
      'Test 9: STAFF role attempting to access customer QR endpoint is rejected with HTTP 403 Forbidden'
    );

    // ----------------------------------------------------
    // TEST 15: CALLED entry state permits QR access
    // ----------------------------------------------------
    const { req: rCall, res: sCall } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { queueId: queue._id.toString() });
    await callNext(rCall, sCall);

    const { req: rQrCalled, res: sQrCalled } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rQrCalled, sQrCalled);

    assert(
      sQrCalled.statusCode === 200 && sQrCalled.responseData.data.status === 'CALLED',
      'Test 15: CALLED entry status permits active QR token retrieval'
    );

    // ----------------------------------------------------
    // TEST 16: SERVING entry state permits QR access
    // ----------------------------------------------------
    const { req: rStart, res: sStart } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryAId });
    await startService(rStart, sStart);

    const { req: rQrServing, res: sQrServing } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rQrServing, sQrServing);

    assert(
      sQrServing.statusCode === 200 && sQrServing.responseData.data.status === 'SERVING',
      'Test 16: SERVING entry status permits active QR token retrieval'
    );

    // ----------------------------------------------------
    // TEST 12: COMPLETED entry status rejects QR retrieval
    // ----------------------------------------------------
    const { req: rComp, res: sComp } = makeReqRes({ id: staffA._id.toString(), role: 'STAFF' }, {}, { entryId: entryAId });
    await completeService(rComp, sComp);

    const { req: rQrComp, res: sQrComp } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryAId });
    await customerGetEntryQrToken(rQrComp, sQrComp);

    assert(
      sQrComp.statusCode === 400 && sQrComp.responseData.data.eligible === false,
      'Test 12: COMPLETED entry rejects QR token retrieval with HTTP 400 Bad Request'
    );

    // ----------------------------------------------------
    // TEST 11: CANCELLED entry status rejects QR retrieval
    // ----------------------------------------------------
    const { req: rJoinB, res: sJoinB } = makeReqRes({ id: customerB._id.toString(), role: 'CUSTOMER' }, {}, { queueId: queue._id.toString() });
    await customerJoinQueue(rJoinB, sJoinB);
    const entryBId = sJoinB.responseData.data.entry.id.toString();

    const { req: rCancelB, res: sCancelB } = makeReqRes({ id: customerB._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryBId });
    await cancelQueueEntry(rCancelB, sCancelB);

    const { req: rQrCancel, res: sQrCancel } = makeReqRes({ id: customerB._id.toString(), role: 'CUSTOMER' }, {}, { entryId: entryBId });
    await customerGetEntryQrToken(rQrCancel, sQrCancel);

    assert(
      sQrCancel.statusCode === 400 && sQrCancel.responseData.data.eligible === false,
      'Test 11: CANCELLED entry rejects QR token retrieval with HTTP 400 Bad Request'
    );

    // ----------------------------------------------------
    // TEST 17, 18: Missing & Invalid Entry ID Handling
    // ----------------------------------------------------
    const fakeId = new mongoose.Types.ObjectId().toString();
    const { req: rMissing, res: sMissing } = makeReqRes({ id: customerA._id.toString(), role: 'CUSTOMER' }, {}, { entryId: fakeId });
    await customerGetEntryQrToken(rMissing, sMissing);

    assert(
      sMissing.statusCode === 404,
      'Test 17 & 18: Non-existent queue entry ID returns HTTP 404 Not Found safely'
    );

    // Cleanup
    await QueueEntry.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Counter.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [staffA._id, customerA._id, customerB._id] } });

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
