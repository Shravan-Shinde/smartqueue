const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Queue = require('../models/Queue');

let ioInstance = null;

/**
 * Helper to parse cookies from raw Cookie header string
 */
const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
};

/**
 * SmartQueue Real-Time Socket.IO Server Setup
 */
const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT Socket Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      // Extract token from HTTP-only cookie or handshake auth object
      const cookies = parseCookies(socket.request.headers.cookie);
      const token = cookies.smartqueue_token || socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server configuration error'));
      }

      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.userId).select('-password');

      if (!user || !user.isActive) {
        return next(new Error('User unauthorized or account inactive'));
      }

      // Attach verified server-side user info to socket
      socket.user = {
        userId: user._id.toString(),
        role: user.role,
        name: user.name,
      };

      next();
    } catch (error) {
      return next(new Error('Authentication failed: Invalid or expired token'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const { userId, role } = socket.user;
    console.log(`[SOCKET CONNECTED] User ${userId} (${role}) on socket ${socket.id}`);

    // Join private user room strictly derived from authenticated socket
    socket.join(`user:${userId}`);

    // Subscribe to Queue Room (Validated)
    socket.on('subscribeQueue', async (queueId) => {
      try {
        if (!queueId || !mongoose.Types.ObjectId.isValid(queueId)) {
          return socket.emit('socketError', { message: 'Invalid queue ID' });
        }

        const queue = await Queue.findById(queueId);
        if (!queue || !queue.isActive) {
          return socket.emit('socketError', { message: 'Queue not found or inactive' });
        }

        socket.join(`queue:${queueId}`);
        console.log(`[SOCKET ROOM] User ${userId} subscribed to queue:${queueId}`);
      } catch (err) {
        socket.emit('socketError', { message: 'Failed to subscribe to queue room' });
      }
    });

    // Unsubscribe from Queue Room
    socket.on('unsubscribeQueue', (queueId) => {
      if (queueId) {
        socket.leave(`queue:${queueId}`);
        console.log(`[SOCKET ROOM] User ${userId} unsubscribed from queue:${queueId}`);
      }
    });

    // Subscribe to Admin Live Crowd Room (Server-Side Authorized)
    socket.on('subscribeAdminLive', async (payload = {}) => {
      try {
        if (socket.user.role !== 'ADMIN') {
          return socket.emit('socketError', { message: 'Unauthorized: Admin access required' });
        }

        const orgId = payload.organizationId;
        socket.join('admin:live_crowd');
        if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
          socket.join(`org:${orgId}:live`);
        }
        console.log(`[SOCKET ROOM] Admin ${userId} subscribed to live crowd updates`);
      } catch (err) {
        socket.emit('socketError', { message: 'Failed to subscribe to admin live room' });
      }
    });

    // Unsubscribe from Admin Live Crowd Room
    socket.on('unsubscribeAdminLive', (payload = {}) => {
      const orgId = payload?.organizationId;
      socket.leave('admin:live_crowd');
      if (orgId) {
        socket.leave(`org:${orgId}:live`);
      }
      console.log(`[SOCKET ROOM] Admin ${userId} unsubscribed from live crowd updates`);
    });

    // Disconnect Handler
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET DISCONNECTED] User ${userId} (Reason: ${reason})`);
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Get Socket.IO Singleton Instance
 */
const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO server has not been initialized');
  }
  return ioInstance;
};

/**
 * Emit private user event (e.g. yourQueueUpdated) to user:{userId} room
 */
const emitUserQueueUpdate = (userId, payload) => {
  if (ioInstance && userId) {
    ioInstance.to(`user:${userId}`).emit('yourQueueUpdated', payload);
  }
};

/**
 * Emit public aggregate queue event (e.g. queueUpdated) to queue:{queueId} room
 */
const emitQueueUpdate = (queueId, payload) => {
  if (ioInstance && queueId) {
    ioInstance.to(`queue:${queueId}`).emit('queueUpdated', payload);
  }
};

/**
 * Emit public queue status change event (e.g. queueStatusChanged) to queue:{queueId} room
 */
const emitQueueStatusChange = (queueId, status) => {
  if (ioInstance && queueId) {
    ioInstance.to(`queue:${queueId}`).emit('queueStatusChanged', { queueId, status });
  }
};

/**
 * Emit counter status change event (counterStatusChanged)
 */
const emitCounterStatusChange = (counterId, status) => {
  if (ioInstance && counterId) {
    ioInstance.emit('counterStatusChanged', { counterId: counterId.toString(), status });
  }
};

/**
 * Emit queue entry priority changed event (queue:entry_priority_changed)
 */
const emitEntryPriorityChanged = (queueId, payload) => {
  if (ioInstance && queueId) {
    ioInstance.to(`queue:${queueId}`).emit('queue:entry_priority_changed', payload);
  }
};

/**
 * Emit real-time live crowd update to admin live rooms (liveCrowdUpdated)
 */
const emitLiveCrowdUpdate = async (queueId) => {
  if (!ioInstance || !queueId) return;

  try {
    const liveCrowdService = require('../services/liveCrowdService');
    const [queueMetrics] = await liveCrowdService.getLiveQueueMetrics({ queueId });

    if (queueMetrics) {
      ioInstance.to('admin:live_crowd').emit('liveCrowdUpdated', queueMetrics);
      if (queueMetrics.organizationId) {
        ioInstance.to(`org:${queueMetrics.organizationId}:live`).emit('liveCrowdUpdated', queueMetrics);
      }
    }
  } catch (err) {
    console.error('Failed to emit live crowd update:', err);
  }
};

module.exports = {
  initSocketServer,
  getIO,
  emitUserQueueUpdate,
  emitQueueUpdate,
  emitQueueStatusChange,
  emitCounterStatusChange,
  emitEntryPriorityChanged,
  emitLiveCrowdUpdate,
};


