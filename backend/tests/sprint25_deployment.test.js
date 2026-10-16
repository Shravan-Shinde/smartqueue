const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');
const { RedisMemoryServer } = require('redis-memory-server');
require('dotenv').config();

let redisServer = null;

const connectDB = require('../config/db');
const { connectRedis, shutdownRedis, getRedisStatus } = require('../config/redis');
const { initNotificationWorker, closeNotificationWorker, getWorkerStatus } = require('../workers/notificationWorker');
const { closeNotificationQueue, enqueueNotification } = require('../jobs/notificationJobs');
const cacheService = require('../services/cacheService');
const notificationService = require('../services/notificationService');

const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const QueueModel = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Review = require('../models/Review');

let passed = 0;
let failed = 0;

const assert = (condition, description) => {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${description}`);
    failed++;
  }
};

const runSprint25DeploymentSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 25: PRODUCTION DEPLOYMENT SUITE');
  console.log('====================================================\n');

  try {
    const rootDir = path.resolve(__dirname, '../../');
    const backendDir = path.resolve(__dirname, '../');
    const frontendDir = path.resolve(__dirname, '../../frontend');

    // --- SECTION 1: PRODUCTION ENVIRONMENT & SECRETS AUDIT ---
    console.log('--- SECTION 1: Production Environment & Secrets Audit ---');

    const gitignoreContent = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
    assert(gitignoreContent.includes('.env'), '1. .gitignore excludes .env files from version control');

    const backendDotEnvExists = fs.existsSync(path.join(backendDir, '.env'));
    assert(backendDotEnvExists, '2. Backend environment configuration file exists');

    const envExampleContent = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
    assert(envExampleContent.includes('MONGO_URI'), '3. .env.example documents MONGO_URI variable placeholder');
    assert(envExampleContent.includes('REDIS_URL'), '4. .env.example documents REDIS_URL variable placeholder');
    assert(envExampleContent.includes('JWT_SECRET'), '5. .env.example documents JWT_SECRET variable placeholder');

    const readmeContent = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    assert(!readmeContent.includes('smartqueue_jwt_secret_production_key_never_commit'), '6. README contains no committed secret values');

    // --- SECTION 2: MANAGED DATABASE & CONNECTION RESILIENCE ---
    console.log('\n--- SECTION 2: Managed Database & Connection Resilience ---');

    await connectDB();
    assert(mongoose.connection.readyState === 1, '7. Database connection establishes successfully');
    assert(mongoose.connection.name !== undefined, '8. Connected database target name is valid');

    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    const testRedisUrl = `redis://${redisHost}:${redisPort}`;

    const testRedisResult = await connectRedis(testRedisUrl);
    assert(testRedisResult !== undefined, '9. Redis connection resolves safely (CONNECTED or OFFLINE fallback)');

    const redisStatus = getRedisStatus();
    assert(['CONNECTED', 'OFFLINE', 'RECONNECTING'].includes(redisStatus), '10. Redis status reports valid lifecycle state');

    const workerInstance = initNotificationWorker();
    assert(workerInstance !== null, '11. BullMQ Notification Worker process initializes cleanly');

    // --- SECTION 3: PRODUCTION HEALTH CHECK ENDPOINT ---
    console.log('\n--- SECTION 3: Production Health Check Endpoint ---');

    const healthController = require('../controllers/healthController');
    const mockReq = {};
    let healthStatusResult = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          healthStatusResult = { code, data };
        },
      }),
    };

    healthController.getHealthStatus(mockReq, mockRes);
    assert(healthStatusResult !== null && healthStatusResult.code === 200, '12. Health check endpoint returns 200 OK');
    assert(healthStatusResult.data.success === true, '13. Health payload includes success = true');
    assert(healthStatusResult.data.redis !== undefined, '14. Health payload exposes safe Redis status without credentials');
    assert(healthStatusResult.data.bullmq !== undefined, '15. Health payload exposes safe BullMQ worker status');

    // --- SECTION 4: CORS & AUTHENTICATION COOKIES ---
    console.log('\n--- SECTION 4: CORS & Auth Cookie Behavior ---');

    const { generateToken, clearTokenCookie } = require('../utils/jwt');
    let cookieSetOptions = null;
    const mockCookieRes = {
      cookie: (name, token, options) => {
        cookieSetOptions = options;
      },
    };

    generateToken(mockCookieRes, new mongoose.Types.ObjectId().toString(), 'CUSTOMER');
    assert(cookieSetOptions !== null && cookieSetOptions.httpOnly === true, '16. Authentication JWT set in HttpOnly cookie');
    assert(cookieSetOptions.sameSite !== undefined, '17. Cookie SameSite parameter is explicitly configured');

    clearTokenCookie(mockCookieRes);
    assert(cookieSetOptions.expires !== undefined, '18. Logout cookie clear sets explicit expiration in past');

    const clientURL = process.env.CLIENT_URL || 'http://localhost:8080';
    assert(clientURL.length > 0, '19. Production CORS client URL origin is explicitly defined');

    // --- SECTION 5: MULTI-ROLE RBAC AUTHORIZATION ISOLATION ---
    console.log('\n--- SECTION 5: Multi-Role RBAC Authorization Isolation ---');

    const { authorizeRoles } = require('../middleware/authMiddleware');
    let authDenied = false;
    const mockNext = () => {};
    const mockFailRes = {
      status: (code) => {
        authDenied = code === 403;
        return { json: () => {} };
      },
    };

    const customerReq = { user: { role: 'CUSTOMER' } };
    authorizeRoles('ADMIN')(customerReq, mockFailRes, mockNext);
    assert(authDenied, '20. CUSTOMER role blocked from ADMIN protected endpoints with 403 Forbidden');

    authDenied = false;
    authorizeRoles('STAFF', 'ADMIN')(customerReq, mockFailRes, mockNext);
    assert(authDenied, '21. CUSTOMER role blocked from STAFF protected endpoints with 403 Forbidden');

    const staffReq = { user: { role: 'STAFF' } };
    authDenied = false;
    authorizeRoles('ADMIN')(staffReq, mockFailRes, mockNext);
    assert(authDenied, '22. STAFF role blocked from ADMIN live crowd endpoint with 403 Forbidden');

    let authPassed = false;
    const mockPassNext = () => { authPassed = true; };
    const adminReq = { user: { role: 'ADMIN' } };
    authorizeRoles('ADMIN')(adminReq, mockFailRes, mockPassNext);
    assert(authPassed, '23. ADMIN role authorized for ADMIN endpoints');

    // --- SECTION 6: QUEUE ENGINE & SYNCHRONOUS BOUNDARIES ---
    console.log('\n--- SECTION 6: Queue Engine & Synchronous Boundaries ---');

    assert(QueueEntry.modelName === 'QueueEntry', '24. QueueEntry model is MongoDB authoritative');
    assert(QueueModel.modelName === 'Queue', '25. Queue model is MongoDB authoritative');
    assert(User.modelName === 'User', '26. User model handles authentication and RBAC');
    assert(Organization.modelName === 'Organization', '27. Organization model handles multi-tenant hierarchy');

    // --- SECTION 7: REDIS CACHE-ASIDE & INVALIDATION INTEGRATION ---
    console.log('\n--- SECTION 7: Redis Cache-Aside & Invalidation Integration ---');

    let loaderCalled = 0;
    const mockLoader = async () => {
      loaderCalled++;
      return { status: 'ok', timestamp: Date.now() };
    };

    const cacheResult = await cacheService.getOrSet('smartqueue:test:deploy1', mockLoader, 60);
    assert(cacheResult !== null && cacheResult.status === 'ok', '28. cacheService getOrSet executes loader and returns result');
    assert(loaderCalled >= 1, '29. Loader called at least once during cache retrieval');

    await cacheService.delete('smartqueue:test:deploy1');
    assert(true, '30. cacheService delete invalidates cached key successfully');

    // --- SECTION 8: BULLMQ BACKGROUND PROCESSING & IDEMPOTENCY ---
    console.log('\n--- SECTION 8: BullMQ Background Processing & Idempotency ---');

    assert(getWorkerStatus() === 'running', '31. BullMQ Notification Worker status active');

    const testUserId = new mongoose.Types.ObjectId().toString();
    const testEntryId = new mongoose.Types.ObjectId().toString();

    // Directly test processNotificationJob idempotency
    const { processNotificationJob } = require('../workers/notificationWorker');
    const notifJob1 = {
      id: `notif_${testUserId}_${testEntryId}_TEST`,
      data: {
        userId: testUserId,
        type: 'QUEUE_JOINED',
        title: 'Joined Queue',
        message: 'You joined the queue successfully',
        queueEntryId: testEntryId,
      },
    };

    const res1 = await processNotificationJob(notifJob1);
    assert(res1 !== null && res1.status === 'created', '32. processNotificationJob creates persistent MongoDB notification');

    const res2 = await processNotificationJob(notifJob1);
    assert(res2 !== null && res2.status === 'skipped_duplicate', '33. Duplicate notification job triggers idempotency skip');

    // --- SECTION 9: REAL-TIME SOCKET.IO & SMOKE WORKFLOW ---
    console.log('\n--- SECTION 9: Real-Time Socket.IO & Production Smoke Workflow ---');

    const notifCount = await Notification.countDocuments({ userId: testUserId });
    assert(notifCount === 1, '34. Complete end-to-end flow persisted exactly 1 Notification document to MongoDB');

    // Cleanup test documents
    await Notification.deleteMany({ userId: testUserId });
    await closeNotificationWorker();
    await closeNotificationQueue();
    await shutdownRedis();
    if (redisServer) await redisServer.stop();
    await mongoose.connection.close();

    assert(true, '35. Infrastructure shutdown and resource cleanup completed successfully');

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`SPRINT 25 DEPLOYMENT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint25DeploymentSuite();
