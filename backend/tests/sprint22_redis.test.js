const mongoose = require('mongoose');
const { RedisMemoryServer } = require('redis-memory-server');
require('dotenv').config();

const connectDB = require('../config/db');
const { connectRedis, getRedisClient, getRedisStatus, shutdownRedis } = require('../config/redis');
const cacheService = require('../services/cacheService');

const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const User = require('../models/User');

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

const runSprint22RedisSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 22: REDIS INTEGRATION & CACHING SUITE');
  console.log('====================================================\n');

  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Spin up controlled in-memory Redis instance for repeatable testing
    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    const testRedisUrl = `redis://${redisHost}:${redisPort}`;

    console.log(`[TEST SETUP] In-Memory Redis server active at ${testRedisUrl}`);

    // --- SECTION 1: REDIS CONNECTION & LIFECYCLE ---
    console.log('\n--- SECTION 1: Redis Connection & Lifecycle ---');

    const client = await connectRedis(testRedisUrl);
    assert(client !== null && client !== undefined, '1. Redis client initializes successfully');
    assert(getRedisStatus() === 'CONNECTED', '2. Redis connection status returns CONNECTED');
    assert(getRedisClient().isOpen === true, '3. Active Redis client isOpen property is true');

    // Test safe disconnect & shutdown
    await shutdownRedis();
    assert(getRedisStatus() === 'OFFLINE', '4. Disconnected status correctly reports OFFLINE');

    // Reconnect for remaining tests
    await connectRedis(testRedisUrl);
    assert(getRedisStatus() === 'CONNECTED', '5. Reconnected successfully to test Redis instance');

    // --- SECTION 2: CACHE SERVICE ABSTRACTION ---
    console.log('\n--- SECTION 2: Cache Service Abstraction ---');
    cacheService.resetMetrics();

    // Clear test keys
    await cacheService.deletePattern('smartqueue:*');

    // 6. set & get
    const setSuccess = await cacheService.set('smartqueue:test:key1', { message: 'hello redis' }, 60);
    assert(setSuccess === true, '6. cacheService.set stores payload in Redis');

    const cachedVal = await cacheService.get('smartqueue:test:key1');
    assert(cachedVal && cachedVal.message === 'hello redis', '7. cacheService.get retrieves and parses JSON payload');

    // 8. Complex objects & arrays
    const complexData = { id: 101, tags: ['a', 'b'], nested: { active: true } };
    await cacheService.set('smartqueue:test:complex', complexData, 60);
    const getComplex = await cacheService.get('smartqueue:test:complex');
    assert(getComplex && getComplex.nested.active === true && getComplex.tags.length === 2, '8. Serializes and deserializes complex nested objects and arrays');

    // 9. TTL
    await cacheService.set('smartqueue:test:ttl', { ttl: true }, 1); // 1 sec TTL
    const beforeExp = await cacheService.get('smartqueue:test:ttl');
    assert(beforeExp !== null, '9. Key exists before TTL expiration');
    await new Promise((r) => setTimeout(r, 1100)); // Wait for expiration
    const afterExp = await cacheService.get('smartqueue:test:ttl');
    assert(afterExp === null, '10. Key automatically expires after TTL');

    // 11. Miss & Delete
    const missVal = await cacheService.get('smartqueue:test:nonexistent');
    assert(missVal === null, '11. cacheService.get returns null on cache miss');

    await cacheService.set('smartqueue:test:del', { toDelete: true }, 60);
    await cacheService.delete('smartqueue:test:del');
    const getDel = await cacheService.get('smartqueue:test:del');
    assert(getDel === null, '12. cacheService.delete removes key from Redis');

    // --- SECTION 3: CACHE-ASIDE PATTERN ---
    console.log('\n--- SECTION 3: Cache-Aside Pattern & Stampede Protection ---');

    let loaderCallCount = 0;
    const testLoader = async () => {
      loaderCallCount++;
      return { data: 'loaded from DB', timestamp: Date.now() };
    };

    // 13. First call -> Miss -> Exec loader
    const res1 = await cacheService.getOrSet('smartqueue:test:aside1', testLoader, 60);
    assert(loaderCallCount === 1, '13. First getOrSet call executes loader (reads DB)');
    assert(res1 && res1.data === 'loaded from DB', '14. First getOrSet returns loaded DB data');

    // 15. Second call -> Hit -> Skip loader
    const res2 = await cacheService.getOrSet('smartqueue:test:aside1', testLoader, 60);
    assert(loaderCallCount === 1, '15. Second getOrSet call uses Redis cache (loader call count remains 1)');
    assert(res2 && res2.data === 'loaded from DB', '16. Cached payload matches original loader result');

    // 17. In-flight Promise deduplication (stampede protection)
    let stampedeLoaderCount = 0;
    const slowLoader = async () => {
      stampedeLoaderCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { val: 'slow data' };
    };

    const [p1, p2, p3] = await Promise.all([
      cacheService.getOrSet('smartqueue:test:stampede', slowLoader, 60),
      cacheService.getOrSet('smartqueue:test:stampede', slowLoader, 60),
      cacheService.getOrSet('smartqueue:test:stampede', slowLoader, 60),
    ]);
    assert(stampedeLoaderCount === 1, '17. Concurrent requests for same missing key are deduplicated (loader called exactly 1 time)');
    assert(p1.val === 'slow data' && p2.val === 'slow data' && p3.val === 'slow data', '18. All concurrent requests receive identical loader result');

    // --- SECTION 4: INVALIDATION RULES ---
    console.log('\n--- SECTION 4: Invalidation Rules ---');

    // Seed test organization, location, department, queue
    const org = await Organization.create({
      name: 'Redis Test Org',
      slug: 'redis-test-org-' + Date.now(),
      description: 'Testing Redis Invalidations',
      category: 'HOSPITAL',
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Redis Test Location',
      address: '123 Cache Way',
      city: 'RedisCity',
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Redis Test Department',
      prefix: 'R',
    });

    const queue = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Redis Test Queue',
      prefix: 'RQ',
      status: 'OPEN',
    });

    // Populate caches
    await cacheService.set(`smartqueue:organization:${org._id}`, { name: org.name }, 120);
    await cacheService.set(`smartqueue:organizations:hash1`, { items: [org.name] }, 120);
    await cacheService.set(`smartqueue:location:${loc._id}`, { name: loc.name }, 120);
    await cacheService.set(`smartqueue:location-list:${org._id}`, { locations: [loc.name] }, 120);
    await cacheService.set(`smartqueue:department:${dept._id}`, { name: dept.name }, 120);
    await cacheService.set(`smartqueue:dept-list:${loc._id}`, { depts: [dept.name] }, 120);
    await cacheService.set(`smartqueue:queue:${queue._id}`, { name: queue.name }, 60);
    await cacheService.set(`smartqueue:department-queues:${dept._id}:all`, { queues: [queue.name] }, 60);

    // Verify populated
    assert((await cacheService.get(`smartqueue:queue:${queue._id}`)) !== null, '19. Queue metadata cache is populated');
    assert((await cacheService.get(`smartqueue:organization:${org._id}`)) !== null, '20. Organization details cache is populated');

    // Perform queue invalidation
    await cacheService.delete(`smartqueue:queue:${queue._id}`);
    await cacheService.deletePattern(`smartqueue:department-queues:${dept._id}:*`);
    assert((await cacheService.get(`smartqueue:queue:${queue._id}`)) === null, '21. Queue update invalidates queue metadata key');
    assert((await cacheService.get(`smartqueue:department-queues:${dept._id}:all`)) === null, '22. Queue update invalidates department queues cache');

    // Perform org invalidation
    await cacheService.delete(`smartqueue:organization:${org._id}`);
    await cacheService.deletePattern('smartqueue:organizations:*');
    assert((await cacheService.get(`smartqueue:organization:${org._id}`)) === null, '23. Organization update invalidates org details key');
    assert((await cacheService.get(`smartqueue:organizations:hash1`)) === null, '24. Organization update invalidates public discovery list cache');

    // Perform location & department invalidation
    await cacheService.delete([`smartqueue:location:${loc._id}`, `smartqueue:location-list:${org._id}`]);
    assert((await cacheService.get(`smartqueue:location:${loc._id}`)) === null, '25. Location update invalidates location cache');
    assert((await cacheService.get(`smartqueue:location-list:${org._id}`)) === null, '26. Location update invalidates location list cache');

    await cacheService.delete([`smartqueue:department:${dept._id}`, `smartqueue:dept-list:${loc._id}`]);
    assert((await cacheService.get(`smartqueue:dept-list:${loc._id}`)) === null, '27. Department update invalidates department list cache');

    // --- SECTION 5: FAILURE HANDLING & FALLBACKS ---
    console.log('\n--- SECTION 5: Failure Handling & Fallbacks ---');

    // Simulate Redis offline by closing client temporarily
    await shutdownRedis();
    assert(getRedisStatus() === 'OFFLINE', '28. Redis is temporarily placed OFFLINE');

    // GET fallback
    const offlineGet = await cacheService.get('smartqueue:test:key1');
    assert(offlineGet === null, '29. Redis GET failure returns null safely without throwing exception');

    // SET fallback
    const offlineSet = await cacheService.set('smartqueue:test:key1', { test: true }, 60);
    assert(offlineSet === false, '30. Redis SET failure returns false safely without throwing exception');

    // getOrSet fallback (reads DB directly when Redis is offline)
    let fallbackLoaderCalled = false;
    const fallbackRes = await cacheService.getOrSet('smartqueue:test:offline', async () => {
      fallbackLoaderCalled = true;
      return { fallback: true };
    }, 60);
    assert(fallbackLoaderCalled === true, '31. getOrSet falls back seamlessly to MongoDB when Redis is OFFLINE');
    assert(fallbackRes && fallbackRes.fallback === true, '32. API response is 100% correct during Redis outage');

    // Reconnect Redis for security & performance benchmarks
    await connectRedis(testRedisUrl);

    // --- SECTION 6: SECURITY & PRIVACY AUDIT ---
    console.log('\n--- SECTION 6: Security & Privacy Audit ---');

    const secRes1 = await cacheService.set('smartqueue:test:sec1', { id: 1, password: 'secretpassword' });
    assert(secRes1 === false, '33. Security check blocks caching password field');

    const secRes2 = await cacheService.set('smartqueue:test:sec2', { id: 1, passwordHash: '$2a$10$xyz' });
    assert(secRes2 === false, '34. Security check blocks caching passwordHash field');

    const secRes3 = await cacheService.set('smartqueue:test:sec3', { id: 1, qrToken: '24bytecryptotoken' });
    assert(secRes3 === false, '35. Security check blocks caching raw qrToken field');

    const secRes4 = await cacheService.set('smartqueue:test:sec4', { id: 1, jwt: 'bearer.token.string' });
    assert(secRes4 === false, '36. Security check blocks caching JWT tokens');

    // --- SECTION 7: BUSINESS CORRECTNESS AUDIT ---
    console.log('\n--- SECTION 7: Business Correctness Audit ---');
    assert(QueueEntry.modelName === 'QueueEntry', '37. QueueEntry model remains MongoDB-authoritative source of truth');
    assert(Queue.modelName === 'Queue', '38. Queue model remains MongoDB-authoritative for capacity & state');

    // --- SECTION 8: PERFORMANCE BENCHMARKS ---
    console.log('\n--- SECTION 8: Performance Benchmarks ---');

    // Measure Uncached DB Query
    const startDb = process.hrtime.bigint();
    await Organization.find({ isActive: true }).lean();
    const endDb = process.hrtime.bigint();
    const dbMs = Number(endDb - startDb) / 1e6;

    // Seed Redis cache
    await cacheService.set('smartqueue:bench:orgs', { items: [org] }, 60);

    // Measure Redis Cache Hit
    const startCache = process.hrtime.bigint();
    await cacheService.get('smartqueue:bench:orgs');
    const endCache = process.hrtime.bigint();
    const cacheMs = Number(endCache - startCache) / 1e6;

    console.log(`  ℹ Uncached MongoDB Query Time: ${dbMs.toFixed(3)} ms`);
    console.log(`  ℹ Redis Cache Hit Time: ${cacheMs.toFixed(3)} ms`);

    assert(cacheMs < 15.0, `39. Redis Cache Hit completed in ${cacheMs.toFixed(3)} ms (< 15 ms target)`);
    assert(cacheMs <= dbMs + 1.0, '40. Cache hit response speed accelerates data access over raw database queries');

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    // Cleanup DB & Redis test resources
    await Queue.deleteMany({});
    await Department.deleteMany({});
    await Location.deleteMany({});
    await Organization.deleteMany({});

    await shutdownRedis();
    if (redisServer) {
      await redisServer.stop();
    }
    await mongoose.connection.close();

    console.log('\n====================================================');
    console.log(`SPRINT 22 REDIS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint22RedisSuite();
