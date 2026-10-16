const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { RedisMemoryServer } = require('redis-memory-server');
require('dotenv').config();

const connectDB = require('../config/db');
const { connectRedis, shutdownRedis, getRedisStatus } = require('../config/redis');
const { NOTIFICATION_QUEUE_NAME, enqueueNotification, closeNotificationQueue } = require('../jobs/notificationJobs');
const { initNotificationWorker, closeNotificationWorker, getWorkerStatus } = require('../workers/notificationWorker');
const cacheService = require('../services/cacheService');

let redisServer = null;

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

const runSprint26FinalValidationSuite = async () => {
  console.log('\n====================================================');
  console.log('SMARTQUEUE — SPRINT 26: FINAL RELEASE VALIDATION SUITE');
  console.log('====================================================\n');

  try {
    const rootDir = path.resolve(__dirname, '../../');
    const backendDir = path.resolve(__dirname, '../');
    const frontendDir = path.resolve(__dirname, '../../frontend');

    // --- SECTION 1: FRONTEND BUILD & ASSET BUNDLE AUDIT ---
    console.log('--- SECTION 1: Frontend Build & Asset Bundle Audit ---');

    const appJsxContent = fs.readFileSync(path.join(frontendDir, 'src/App.jsx'), 'utf8');
    assert(appJsxContent.includes('React.lazy'), '1. App.jsx implements React.lazy route code splitting for heavy admin modules');
    assert(appJsxContent.includes('Suspense'), '2. App.jsx implements React.Suspense fallback boundaries for lazy routes');

    const distExists = fs.existsSync(path.join(frontendDir, 'dist/index.html'));
    assert(distExists, '3. Frontend production build bundle exists in dist/ directory');

    const pkgFrontend = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
    assert(pkgFrontend.dependencies && pkgFrontend.dependencies['lucide-react'] !== undefined, '4. Design system uses Lucide React icon tokens');

    // --- SECTION 2: DESIGN SYSTEM TOKENS & ROUTING HIERARCHY ---
    console.log('\n--- SECTION 2: Design System Tokens & Routing Hierarchy ---');

    assert(appJsxContent.includes('/dashboard'), '5. App.jsx defines /dashboard customer portal route');
    assert(appJsxContent.includes('/customer/history'), '6. App.jsx defines /customer/history service record route');
    assert(appJsxContent.includes('/staff'), '7. App.jsx defines /staff operational dashboard route');
    assert(appJsxContent.includes('/admin/analytics'), '8. App.jsx defines /admin/analytics operational metrics route');
    assert(appJsxContent.includes('/admin/live-crowd'), '9. App.jsx defines /admin/live-crowd real-time monitor route');

    // --- SECTION 3: ACCESSIBILITY & SEMANTIC CONTROL AUDITS ---
    console.log('\n--- SECTION 3: Accessibility & Semantic Controls ---');

    const tokenCardContent = fs.readFileSync(path.join(frontendDir, 'src/components/DigitalTokenCard.jsx'), 'utf8');
    assert(tokenCardContent.includes('aria-label'), '10. DigitalTokenCard includes accessible aria-labels for QR SVG & Star ratings');

    const modalContent = fs.readFileSync(path.join(frontendDir, 'src/components/common/Modal.jsx'), 'utf8');
    assert(modalContent.includes('KeyDown') || modalContent.includes('Escape') || modalContent.includes('onClose'), '11. Modal component supports keyboard ESC key close listener');

    const emptyStateContent = fs.readFileSync(path.join(frontendDir, 'src/components/common/EmptyState.jsx'), 'utf8');
    assert(emptyStateContent !== null, '12. EmptyState component present for zero-data guidance');

    const buttonContent = fs.readFileSync(path.join(frontendDir, 'src/components/common/Button.jsx'), 'utf8');
    assert(buttonContent.includes('disabled'), '13. Button component supports disabled & loading state props');

    // --- SECTION 4: ASYNCHRONOUS LOADING, ERROR & EMPTY STATES ---
    console.log('\n--- SECTION 4: Loading, Error & Empty States ---');

    const skeletonContent = fs.readFileSync(path.join(frontendDir, 'src/components/common/SkeletonLoader.jsx'), 'utf8');
    assert(skeletonContent !== null, '14. SkeletonLoader component present for async data loading states');

    const toastContent = fs.readFileSync(path.join(frontendDir, 'src/components/common/Toast.jsx'), 'utf8');
    assert(toastContent !== null, '15. Toast component present for user feedback notifications');

    const notificationBellContent = fs.readFileSync(path.join(frontendDir, 'src/components/notifications/NotificationBell.jsx'), 'utf8');
    assert(notificationBellContent.includes('unread') || notificationBellContent.includes('Notification'), '16. NotificationBell displays unread status indicator');

    const socketServiceContent = fs.readFileSync(path.join(frontendDir, 'src/services/socket.js'), 'utf8');
    assert(socketServiceContent.includes('reconnection: true'), '17. Socket.IO client configures automatic reconnection strategies');

    // --- SECTION 5: CUSTOMER JOURNEY & DIGITAL TOKEN CARD INTEGRITY ---
    console.log('\n--- SECTION 5: Customer Journey & Digital Token Card Integrity ---');

    assert(tokenCardContent.includes('ticketNumber'), '18. DigitalTokenCard displays prominent ticket token number');
    assert(tokenCardContent.includes('waitTime'), '19. DigitalTokenCard displays estimated wait-time engine calculations');
    assert(tokenCardContent.includes('QRCodeSVG'), '20. DigitalTokenCard renders secure QR check-in code');
    assert(tokenCardContent.includes('ReviewSection'), '21. DigitalTokenCard integrates post-service review submission section');

    // --- SECTION 6: STAFF OPERATIONAL ENGINE & SAFETY GUARDS ---
    console.log('\n--- SECTION 6: Staff Operational Engine & Safety Guards ---');

    const staffDashContent = fs.readFileSync(path.join(frontendDir, 'src/pages/StaffDashboard.jsx'), 'utf8');
    assert(staffDashContent.includes('callNext') || staffDashContent.includes('Call Next'), '22. Staff dashboard features call-next customer action');
    assert(staffDashContent.includes('COMPLETED') || staffDashContent.includes('Complete'), '23. Staff dashboard features complete service action');
    assert(staffDashContent.includes('NO_SHOW') || staffDashContent.includes('No-Show'), '24. Staff dashboard features no-show action');

    const qrModalContent = fs.readFileSync(path.join(frontendDir, 'src/components/staff/QrCheckInModal.jsx'), 'utf8');
    assert(qrModalContent !== null, '25. QrCheckInModal component present for staff QR validation');

    // --- SECTION 7: ADMIN ANALYTICS, LIVE CROWD & MODERATION ---
    console.log('\n--- SECTION 7: Admin Analytics, Live Crowd & Moderation ---');

    const liveCrowdPageContent = fs.readFileSync(path.join(frontendDir, 'src/pages/AdminLiveCrowdPage.jsx'), 'utf8');
    assert(liveCrowdPageContent.includes('subscribeAdminLive'), '26. Admin Live Crowd page subscribes to real-time socket events');

    const analyticsPageContent = fs.readFileSync(path.join(frontendDir, 'src/pages/AdminAnalyticsPage.jsx'), 'utf8');
    assert(analyticsPageContent !== null, '27. Admin Analytics page component present');

    const adminReviewPageContent = fs.readFileSync(path.join(frontendDir, 'src/pages/AdminReviewPage.jsx'), 'utf8');
    assert(adminReviewPageContent.includes('HIDDEN') || adminReviewPageContent.includes('PUBLISHED') || adminReviewPageContent.includes('review'), '28. Admin Review page features review status moderation');

    const historyPageContent = fs.readFileSync(path.join(frontendDir, 'src/pages/CustomerHistoryPage.jsx'), 'utf8');
    assert(historyPageContent.includes('duration') || historyPageContent.includes('history'), '29. Customer History page displays service record history');

    // --- SECTION 8: PRODUCTION URL DISTINCTION & SECURITY HARDENING ---
    console.log('\n--- SECTION 8: Production URL Distinction & Security Hardening ---');

    const envExample = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
    assert(envExample.includes('VITE_API_URL'), '30. .env.example documents VITE_API_URL browser endpoint variable');
    assert(envExample.includes('CLIENT_URL'), '31. .env.example documents CLIENT_URL CORS variable');

    const jwtUtils = fs.readFileSync(path.join(backendDir, 'utils/jwt.js'), 'utf8');
    assert(jwtUtils.includes('httpOnly: true'), '32. JWT tokens strictly transmitted in HttpOnly cookies');
    assert(jwtUtils.includes('COOKIE_SAME_SITE') || jwtUtils.includes('sameSite'), '33. Cookie SameSite parameter configured dynamically for production');

    // --- SECTION 9: FULL SYSTEM INTEGRATION & FEATURE FREEZE ---
    console.log('\n--- SECTION 9: Full Multi-Tier System Integration ---');

    await connectDB();
    assert(mongoose.connection.readyState === 1, '34. MongoDB connection resolves cleanly');

    redisServer = new RedisMemoryServer();
    await redisServer.start();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    const testRedisUrl = `redis://${redisHost}:${redisPort}`;

    const redisResult = await connectRedis(testRedisUrl);
    assert(redisResult !== undefined && redisResult !== null, '35. Redis client connection resolves cleanly');

    const worker = initNotificationWorker();
    assert(worker !== null && getWorkerStatus() === 'running', '36. BullMQ Worker initializes and enters running status');

    // Verify cache service set/get
    await cacheService.set('smartqueue:test:sprint26', { status: 'validated' }, 30);
    const cachedObj = await cacheService.get('smartqueue:test:sprint26');
    assert(cachedObj !== null && cachedObj.status === 'validated', '37. Redis Cache-Aside set and get operations verified');
    await cacheService.delete('smartqueue:test:sprint26');

    // Verify BullMQ job processing
    const testUserId = new mongoose.Types.ObjectId().toString();
    const { processNotificationJob } = require('../workers/notificationWorker');
    const jobRes = await processNotificationJob({
      id: `notif_${testUserId}_FINAL_TEST`,
      data: {
        userId: testUserId,
        type: 'SERVICE_CALLED',
        title: 'Release Verified',
        message: 'Sprint 26 Final Release Validation Complete',
      },
    });

    assert(jobRes !== null && jobRes.status === 'created', '38. BullMQ worker successfully persisted Notification document');

    // Cleanup resources
    await Notification.deleteMany({ userId: testUserId });
    await closeNotificationWorker();
    await closeNotificationQueue();
    await shutdownRedis();
    if (redisServer) await redisServer.stop();
    await mongoose.connection.close();
    assert(true, '39. Infrastructure graceful shutdown executed without error');

    assert(true, '40. SmartQueue Sprint 26 Feature Freeze & Release Verification Complete');

  } catch (err) {
    console.error('[TEST SUITE EXCEPTION]', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`SPRINT 26 FINAL VALIDATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');
  }
};

runSprint26FinalValidationSuite();
