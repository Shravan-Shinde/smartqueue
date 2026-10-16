const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const connectDB = require('./config/db');
const { connectRedis, shutdownRedis } = require('./config/redis');
const { initNotificationWorker, closeNotificationWorker } = require('./workers/notificationWorker');
const { closeNotificationQueue } = require('./jobs/notificationJobs');
const { API_PREFIX, DEFAULT_PORT } = require('./config/constants');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const adminOrgRoutes = require('./routes/adminOrgRoutes');
const adminCounterQueueRoutes = require('./routes/adminCounterQueueRoutes');
const adminStaffRoutes = require('./routes/adminStaffRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const adminLiveCrowdRoutes = require('./routes/adminLiveCrowdRoutes');
const adminReviewRoutes = require('./routes/adminReviewRoutes');
const customerHistoryRoutes = require('./routes/customerHistoryRoutes');
const queueRoutes = require('./routes/queueRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const staffRoutes = require('./routes/staffRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notFoundHandler = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const securityHeaders = require('./middleware/securityHeaders');
const { initSocketServer } = require('./socket/socketServer');

const app = express();
const server = http.createServer(app);

// HTTP Security Headers Middleware
app.use(securityHeaders);

// CORS configuration using environment variable
const clientURL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientURL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);

// Cookie parser & Body parsing middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API Routes
app.use(API_PREFIX, healthRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/organizations`, orgRoutes);
app.use(`${API_PREFIX}/admin/organizations`, adminOrgRoutes);
app.use(`${API_PREFIX}/admin`, adminCounterQueueRoutes);
app.use(`${API_PREFIX}/admin/staff`, adminStaffRoutes);
app.use(`${API_PREFIX}/admin/analytics`, adminAnalyticsRoutes);
app.use(`${API_PREFIX}/admin/live-crowd`, adminLiveCrowdRoutes);
app.use(`${API_PREFIX}/admin/reviews`, adminReviewRoutes);
app.use(`${API_PREFIX}/customers/me/history`, customerHistoryRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/staff`, staffRoutes);
app.use(`${API_PREFIX}/search`, searchRoutes);
app.use(API_PREFIX, queueRoutes);

// 404 API Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

// Initialize Socket.IO server foundation
initSocketServer(server);

// Start Database, Redis, BullMQ Worker & HTTP Server
const PORT = process.env.PORT || DEFAULT_PORT;

const startServer = async () => {
  await connectDB();
  const redisClient = await connectRedis();
  if (redisClient) {
    initNotificationWorker();
  } else {
    console.warn('[REDIS/BULLMQ INIT WARN] Operating in fallback mode: Redis is offline');
  }

  server.listen(PORT, () => {
    console.log(`[SERVER RUNNING] SmartQueue Backend active on port ${PORT}`);
    console.log(`[HEALTH CHECK] http://localhost:${PORT}${API_PREFIX}/health`);
    console.log(`[AUTH API] http://localhost:${PORT}${API_PREFIX}/auth`);
    console.log(`[PUBLIC DISCOVERY API] http://localhost:${PORT}${API_PREFIX}/organizations`);
    console.log(`[ADMIN ORG API] http://localhost:${PORT}${API_PREFIX}/admin/organizations`);
  });
};

// Graceful Shutdown Hooks
process.on('SIGINT', async () => {
  console.log('[SERVER SHUTDOWN] Signal received. Shutting down worker, queue, and Redis...');
  await closeNotificationWorker();
  await closeNotificationQueue();
  await shutdownRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[SERVER SHUTDOWN] Signal received. Shutting down worker, queue, and Redis...');
  await closeNotificationWorker();
  await closeNotificationQueue();
  await shutdownRedis();
  process.exit(0);
});

startServer();

module.exports = { app, server };
