const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { RedisMemoryServer } = require('redis-memory-server');
require('dotenv').config();

let redisServer = null;

const connectDB = require('../config/db');
const { connectRedis, shutdownRedis } = require('../config/redis');
const { NOTIFICATION_QUEUE_NAME, enqueueNotification, closeNotificationQueue } = require('../jobs/notificationJobs');
const { initNotificationWorker, closeNotificationWorker, getWorkerStatus } = require('../workers/notificationWorker');
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

const runSprint24DockerSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 24: DOCKER INFRASTRUCTURE SUITE');
  console.log('====================================================\n');

  try {
    const rootDir = path.resolve(__dirname, '../../');
    const backendDir = path.resolve(__dirname, '../');
    const frontendDir = path.resolve(__dirname, '../../frontend');

    // --- SECTION 1: DOCKERFILES & REPOSITORY STRUCTURE ---
    console.log('--- SECTION 1: Dockerfiles & Repository Structure ---');

    const backendDockerfileExists = fs.existsSync(path.join(backendDir, 'Dockerfile'));
    assert(backendDockerfileExists, '1. backend/Dockerfile exists in repository');

    const frontendDockerfileExists = fs.existsSync(path.join(frontendDir, 'Dockerfile'));
    assert(frontendDockerfileExists, '2. frontend/Dockerfile exists in repository');

    const dockerComposeExists = fs.existsSync(path.join(rootDir, 'docker-compose.yml'));
    assert(dockerComposeExists, '3. docker-compose.yml exists in root directory');

    const backendDockerIgnoreExists = fs.existsSync(path.join(backendDir, '.dockerignore'));
    assert(backendDockerIgnoreExists, '4. backend/.dockerignore exists in repository');

    const frontendDockerIgnoreExists = fs.existsSync(path.join(frontendDir, '.dockerignore'));
    assert(frontendDockerIgnoreExists, '5. frontend/.dockerignore exists in repository');

    const nginxConfExists = fs.existsSync(path.join(frontendDir, 'nginx.conf'));
    assert(nginxConfExists, '6. frontend/nginx.conf exists in repository');

    const envExampleExists = fs.existsSync(path.join(rootDir, '.env.example'));
    assert(envExampleExists, '7. .env.example exists in root directory');

    const workerScriptExists = fs.existsSync(path.join(backendDir, 'worker.js'));
    assert(workerScriptExists, '8. backend/worker.js worker runner script exists');

    // --- SECTION 2: DOCKERFILE & CONFIG CONTENT VERIFICATION ---
    console.log('\n--- SECTION 2: Dockerfile & Config Content Audit ---');

    const backendDockerfileContent = fs.readFileSync(path.join(backendDir, 'Dockerfile'), 'utf8');
    assert(backendDockerfileContent.includes('FROM node:20-alpine'), '9. backend/Dockerfile uses Node 20 LTS Alpine base image');
    assert(backendDockerfileContent.includes('USER node'), '10. backend/Dockerfile enforces non-root USER node execution');
    assert(backendDockerfileContent.includes('EXPOSE 5000'), '11. backend/Dockerfile explicitly exposes port 5000');

    const frontendDockerfileContent = fs.readFileSync(path.join(frontendDir, 'Dockerfile'), 'utf8');
    assert(frontendDockerfileContent.includes('FROM node:20-alpine AS builder'), '12. frontend/Dockerfile implements multi-stage builder stage');
    assert(frontendDockerfileContent.includes('FROM nginx:alpine'), '13. frontend/Dockerfile uses lightweight nginx:alpine production server');

    const nginxConfContent = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
    assert(nginxConfContent.includes('try_files $uri $uri/ /index.html;'), '14. frontend/nginx.conf configures SPA routing fallback');
    assert(nginxConfContent.includes('location /api/'), '15. frontend/nginx.conf configures /api/ reverse proxy to backend');
    assert(nginxConfContent.includes('location /socket.io/'), '16. frontend/nginx.conf configures /socket.io/ WebSocket reverse proxy');

    // --- SECTION 3: DOCKER COMPOSE ORCHESTRATION & HEALTHCHECKS ---
    console.log('\n--- SECTION 3: Docker Compose Services & Healthchecks ---');

    const composeContent = fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf8');
    assert(composeContent.includes('smartqueue-mongodb'), '17. docker-compose.yml defines MongoDB service container');
    assert(composeContent.includes('smartqueue-redis'), '18. docker-compose.yml defines Redis service container');
    assert(composeContent.includes('smartqueue-backend'), '19. docker-compose.yml defines Express Backend API container');
    assert(composeContent.includes('smartqueue-worker'), '20. docker-compose.yml defines BullMQ Background Worker container');
    assert(composeContent.includes('smartqueue-frontend'), '21. docker-compose.yml defines Nginx Frontend container');
    assert(composeContent.includes('healthcheck:'), '22. docker-compose.yml configures container health checks');
    assert(composeContent.includes('mongodb_data:'), '23. docker-compose.yml configures named volume for MongoDB persistence');
    assert(composeContent.includes('smartqueue-net:'), '24. docker-compose.yml defines isolated bridge network');

    // --- SECTION 4: PACKAGE MANIFESTS & SCRIPTS ---
    console.log('\n--- SECTION 4: Package Manifests & Worker Script ---');

    const pkgBackend = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
    assert(pkgBackend.scripts && pkgBackend.scripts.start === 'node server.js', '25. backend/package.json contains start script: node server.js');
    assert(pkgBackend.scripts && pkgBackend.scripts.worker === 'node worker.js', '26. backend/package.json contains worker script: node worker.js');

    // --- SECTION 5: SECURITY AUDIT & SECRETS ISOLATION ---
    console.log('\n--- SECTION 5: Security Audit & Secrets Isolation ---');

    assert(!backendDockerfileContent.includes('JWT_SECRET='), '27. backend/Dockerfile contains no hardcoded JWT_SECRET');
    assert(!backendDockerfileContent.includes('MONGO_URI='), '28. backend/Dockerfile contains no hardcoded MONGO_URI');
    assert(!frontendDockerfileContent.includes('JWT_SECRET='), '29. frontend/Dockerfile contains no sensitive backend secrets');
    assert(!frontendDockerfileContent.includes('MONGO_URI='), '30. frontend/Dockerfile contains no backend database credentials');

    // --- SECTION 6: APPLICATION INFRASTRUCTURE RUNTIME INTEGRATION ---
    console.log('\n--- SECTION 6: Infrastructure Runtime Integration ---');

    // Test MongoDB connection with db.js logic
    await connectDB();
    assert(mongoose.connection.readyState === 1, '31. connectDB establishes active MongoDB connection');

    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    const testRedisUrl = `redis://${redisHost}:${redisPort}`;

    // Test Redis & Worker initialization
    const redisResult = await connectRedis(testRedisUrl);
    assert(redisResult !== undefined, '32. connectRedis resolves cleanly without throwing exceptions');

    const worker = initNotificationWorker();
    assert(worker !== null, '33. BullMQ Worker initializes cleanly in application runtime');
    assert(getWorkerStatus() === 'running', '34. BullMQ Worker status reports running');

    // Cleanup worker & database resources
    await closeNotificationWorker();
    await closeNotificationQueue();
    await shutdownRedis();
    if (redisServer) await redisServer.stop();
    await mongoose.connection.close();
    assert(true, '35. Infrastructure graceful shutdown executed without errors');

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`SPRINT 24 DOCKER TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint24DockerSuite();
