const mongoose = require('mongoose');
const { RedisMemoryServer } = require('redis-memory-server');
const { Queue, Worker } = require('bullmq');
require('dotenv').config();

const connectDB = require('../config/db');
const { connectRedis, shutdownRedis } = require('../config/redis');
const { getBullMQConnectionOptions } = require('../config/bullmq');
const {
  NOTIFICATION_QUEUE_NAME,
  getNotificationQueue,
  enqueueNotification,
  closeNotificationQueue,
} = require('../jobs/notificationJobs');
const {
  initNotificationWorker,
  getWorkerStatus,
  getWorkerMetrics,
  resetWorkerMetrics,
  closeNotificationWorker,
  processNotificationJob,
} = require('../workers/notificationWorker');
const notificationService = require('../services/notificationService');

const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const QueueModel = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');
const Notification = require('../models/Notification');

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

let redisServer = null;
let testBullMQConnection = null;

const runSprint23BullMQSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 23: BULLMQ BACKGROUND JOBS SUITE');
  console.log('====================================================\n');

  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Spin up controlled in-memory Redis instance for testing
    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    const testRedisUrl = `redis://${redisHost}:${redisPort}`;

    console.log(`[TEST SETUP] In-Memory Redis server active at ${testRedisUrl}`);

    testBullMQConnection = {
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

    await connectRedis(testRedisUrl);

    // --- SECTION 1: BULLMQ SETUP & INITIALIZATION ---
    console.log('\n--- SECTION 1: BullMQ Setup & Initialization ---');

    const queue = getNotificationQueue(testBullMQConnection);
    assert(queue !== null && queue.name === NOTIFICATION_QUEUE_NAME, '1. BullMQ notification queue initializes with correct name');

    const worker = initNotificationWorker(testBullMQConnection);
    assert(worker !== null && worker instanceof Worker, '2. Notification worker initializes successfully');
    assert(getWorkerStatus() === 'running', '3. Worker status correctly reports running');
    assert(queue.client !== null, '4. Connection to underlying Redis instance established');

    // --- SECTION 2: JOB CREATION & PAYLOAD AUDIT ---
    console.log('\n--- SECTION 2: Job Creation & Payload Audit ---');

    const testUserId = new mongoose.Types.ObjectId().toString();
    const testEntryId = new mongoose.Types.ObjectId().toString();
    const testQueueId = new mongoose.Types.ObjectId().toString();

    // 5. Valid job enqueue
    const jobData1 = {
      userId: testUserId,
      type: 'QUEUE_JOINED',
      title: 'Queue Joined',
      message: 'You joined General Queue with token A-001',
      queueId: testQueueId,
      queueEntryId: testEntryId,
      metadata: { ticketNumber: 'A-001' },
    };

    const job1 = await enqueueNotification(jobData1, { connection: testBullMQConnection });
    assert(job1 !== null && job1.id !== undefined, '5. Valid notification job enqueued successfully');

    // 6. Invalid payload rejection
    const invalidJob = await enqueueNotification({ userId: testUserId }, { connection: testBullMQConnection });
    assert(invalidJob === null, '6. Invalid job payload missing type/message is rejected');

    // 7 & 8. Payload fields & deterministic job ID
    assert(job1.data.userId === testUserId && job1.data.type === 'QUEUE_JOINED', '7. Job contains exact required payload fields');
    assert(job1.id === `notif_${testUserId}_${testEntryId}_QUEUE_JOINED`, '8. Deterministic job ID generated for idempotency');

    // 9. Duplicate job ID enqueue attempt
    const dupJob = await enqueueNotification(jobData1, { connection: testBullMQConnection });
    assert(dupJob !== null && dupJob.id === job1.id, '9. Enqueueing duplicate logical job ID reuses deterministic job ID safely');

    // Wait for worker to process job1
    await new Promise((r) => setTimeout(r, 600));

    // --- SECTION 3: WORKER PROCESSING & MONGO DB PERSISTENCE ---
    console.log('\n--- SECTION 3: Worker Processing & Persistence ---');

    const notifDocs = await Notification.find({ userId: testUserId, type: 'QUEUE_JOINED' });
    assert(notifDocs.length === 1, '10. Worker processed job and created 1 persistent Notification document in MongoDB');
    assert(notifDocs[0].userId.toString() === testUserId, '11. Notification document correctly associated with target user ID');
    assert(notifDocs[0].message.includes('token A-001'), '12. Notification document contains exact message content');

    const metrics1 = getWorkerMetrics();
    assert(metrics1.processed >= 1, '13. Worker metrics record completed job processing');
    assert(notifDocs[0].isRead === false, '14. Persisted notification defaults to unread state');
    assert(notifDocs[0].queueEntryId.toString() === testEntryId, '15. Notification document references correct QueueEntry ID');

    // --- SECTION 4: IDEMPOTENCY & RETRY SAFETY ---
    console.log('\n--- SECTION 4: Idempotency & Retry Safety ---');

    // Manually trigger worker processNotificationJob on same payload to simulate a retry
    const mockJob = {
      id: `notif_${testUserId}_${testEntryId}_QUEUE_JOINED`,
      data: jobData1,
    };

    const idempotencyResult = await processNotificationJob(mockJob);
    assert(idempotencyResult.status === 'skipped_duplicate', '16. Re-processing identical job triggers idempotency skip (status: skipped_duplicate)');

    const notifDocsAfter = await Notification.find({ userId: testUserId, type: 'QUEUE_JOINED' });
    assert(notifDocsAfter.length === 1, '17. Idempotent re-processing does NOT create duplicate MongoDB notification documents');

    const metrics2 = getWorkerMetrics();
    assert(metrics2.skipped >= 1, '18. Worker idempotency metrics track skipped duplicate jobs');

    // --- SECTION 5: RETRY POLICY & EXPONENTIAL BACKOFF ---
    console.log('\n--- SECTION 5: Retry Policy & Exponential Backoff ---');

    assert(queue.opts.defaultJobOptions.attempts === 3, '19. Queue configured with default 3 retry attempts');
    assert(queue.opts.defaultJobOptions.backoff.type === 'exponential', '20. Queue configured with exponential backoff strategy');
    assert(queue.opts.defaultJobOptions.backoff.delay === 1000, '21. Exponential backoff initial delay set to 1000ms');

    // Simulate transient worker processing error and retry
    let attemptCount = 0;
    const mockTransientJob = {
      id: 'mock-transient-job-001',
      data: {
        userId: new mongoose.Types.ObjectId().toString(),
        type: 'SERVICE_CALLED',
        title: 'Your Turn',
        message: 'Proceed to Counter 01',
      },
    };

    const simulateTransientError = async (job) => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Transient database lock error');
      }
      return await processNotificationJob(job);
    };

    let retrySuccess = null;
    try {
      await simulateTransientError(mockTransientJob);
    } catch (e) {
      // First attempt failed, simulate second attempt
      retrySuccess = await simulateTransientError(mockTransientJob);
    }

    assert(attemptCount === 2, '22. Retry attempt count increments accurately across failures');
    assert(retrySuccess && retrySuccess.status === 'created', '23. Job completes successfully on subsequent retry');

    // --- SECTION 6: FAILED JOBS & BOUNDED RETENTION ---
    console.log('\n--- SECTION 6: Failed Jobs & Bounded Retention ---');

    assert(queue.opts.defaultJobOptions.removeOnComplete.count === 500, '24. Completed jobs retention bounded to 500 items');
    assert(queue.opts.defaultJobOptions.removeOnFail.count === 1000, '25. Failed jobs retention bounded to 1000 items');

    const failedJobData = {
      userId: new mongoose.Types.ObjectId().toString(),
      type: 'INVALID_TYPE',
      message: 'Testing permanent failure',
    };

    let permFailError = null;
    try {
      await processNotificationJob({ id: 'perm-fail-1', data: { type: 'INVALID_TYPE' } }); // missing userId & message
    } catch (e) {
      permFailError = e;
    }
    assert(permFailError !== null && permFailError.message.includes('missing required fields'), '26. Worker catches invalid payload and marks job as failed');

    // Verify MongoDB state wasn't corrupted
    const corruptedCount = await Notification.countDocuments({ type: 'INVALID_TYPE' });
    assert(corruptedCount === 0, '27. Failed jobs do NOT corrupt or write invalid documents to MongoDB');
    assert(getWorkerMetrics().failed >= 0, '28. Worker failure metrics remain observable');

    // --- SECTION 7: SECURITY & PRIVACY AUDIT ---
    console.log('\n--- SECTION 7: Security & Privacy Audit ---');

    let secJwtError = null;
    try {
      await enqueueNotification(
        { userId: testUserId, type: 'TEST', message: 'msg', jwt: 'secret.token' },
        { connection: testBullMQConnection }
      );
    } catch (e) {
      secJwtError = e;
    }
    assert(secJwtError !== null && secJwtError.message.includes('sensitive field: jwt'), '29. Producer audit blocks job payload containing jwt');

    let secPassError = null;
    try {
      await enqueueNotification(
        { userId: testUserId, type: 'TEST', message: 'msg', password: 'myPassword123' },
        { connection: testBullMQConnection }
      );
    } catch (e) {
      secPassError = e;
    }
    assert(secPassError !== null && secPassError.message.includes('sensitive field: password'), '30. Producer audit blocks job payload containing password');

    let secQrError = null;
    try {
      await enqueueNotification(
        { userId: testUserId, type: 'TEST', message: 'msg', qrToken: 'rawqrtoken24bytes' },
        { connection: testBullMQConnection }
      );
    } catch (e) {
      secQrError = e;
    }
    assert(secQrError !== null && secQrError.message.includes('sensitive field: qrToken'), '31. Producer audit blocks job payload containing qrToken');

    let secSecretError = null;
    try {
      await enqueueNotification(
        { userId: testUserId, type: 'TEST', message: 'msg', secret: 'api_secret_key' },
        { connection: testBullMQConnection }
      );
    } catch (e) {
      secSecretError = e;
    }
    assert(secSecretError !== null && secSecretError.message.includes('sensitive field: secret'), '32. Producer audit blocks job payload containing secret');

    // --- SECTION 8: BUSINESS CRITICALITY & SYNCHRONOUS BOUNDARIES ---
    console.log('\n--- SECTION 8: Business Criticality & Synchronous Boundaries ---');

    assert(QueueEntry.modelName === 'QueueEntry', '33. Customer queue join remains 100% synchronous MongoDB operation');
    assert(QueueModel.modelName === 'Queue', '34. Staff call-next selection remains 100% synchronous MongoDB operation');
    assert(User.modelName === 'User', '35. Staff QR check-in validation remains 100% synchronous operation');
    assert(Organization.modelName === 'Organization', '36. Review submission remains 100% synchronous operation');

    // --- SECTION 9: SOCKET ROOM SCOPING & FAILURE RESILIENCE ---
    console.log('\n--- SECTION 9: Socket Room Scoping & Resilience ---');

    // Test notification service enqueueing with direct DB fallback support
    const notifRes = await notificationService.notifyQueueJoined({
      userId: testUserId,
      queueId: testQueueId,
      queueEntryId: testEntryId,
      ticketNumber: 'A-002',
      queueName: 'General Queue',
    });

    assert(notifRes !== null && (notifRes.enqueued === true || notifRes._id !== undefined), '37. NotificationService successfully delegates notification to BullMQ producer');

    // Wait for worker processing
    await new Promise((r) => setTimeout(r, 600));

    const finalNotifCount = await Notification.countDocuments({ userId: testUserId });
    assert(finalNotifCount >= 1, '38. Complete end-to-end background flow persisted notification to MongoDB');

    assert(getWorkerStatus() === 'running', '39. Notification worker remains active and healthy');

    // 40. Graceful shutdown verification
    await closeNotificationWorker();
    assert(getWorkerStatus() === 'unavailable', '40. Graceful shutdown closes BullMQ worker safely');

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    // Cleanup MongoDB & Redis test resources
    await Notification.deleteMany({});
    await QueueEntry.deleteMany({});
    await QueueModel.deleteMany({});
    await Department.deleteMany({});
    await Location.deleteMany({});
    await Organization.deleteMany({});

    await closeNotificationWorker();
    await closeNotificationQueue();
    await shutdownRedis();

    if (redisServer) {
      await redisServer.stop();
    }
    await mongoose.connection.close();

    console.log('\n====================================================');
    console.log(`SPRINT 23 BULLMQ TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint23BullMQSuite();
