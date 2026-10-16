import { io } from 'socket.io-client';

let socket = null;
let connectionState = 'OFFLINE'; // 'CONNECTED' | 'RECONNECTING' | 'OFFLINE'
const stateListeners = new Set();

const notifyStateListeners = (newState) => {
  connectionState = newState;
  stateListeners.forEach((cb) => cb(newState));
};

export const socketService = {
  /**
   * Connect to Socket.IO Server with credentials
   */
  connectSocket() {
    if (socket && socket.connected) {
      return socket;
    }

    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
      : 'http://localhost:5000';

    if (!socket) {
      socket = io(socketUrl, {
        withCredentials: true,
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        console.log('[SOCKET CLIENT] Connected successfully ID:', socket.id);
        notifyStateListeners('CONNECTED');
      });

      socket.on('disconnect', (reason) => {
        console.log('[SOCKET CLIENT] Disconnected (Reason):', reason);
        if (reason === 'io server disconnect') {
          notifyStateListeners('OFFLINE');
        } else {
          notifyStateListeners('RECONNECTING');
        }
      });

      socket.on('connect_error', (error) => {
        console.warn('[SOCKET CLIENT] Connection error:', error.message);
        notifyStateListeners('RECONNECTING');
      });

      socket.io.on('reconnect_attempt', (attempt) => {
        console.log('[SOCKET CLIENT] Reconnect attempt #', attempt);
        notifyStateListeners('RECONNECTING');
      });

      socket.io.on('reconnect', () => {
        console.log('[SOCKET CLIENT] Reconnected successfully');
        notifyStateListeners('CONNECTED');
      });

      socket.io.on('reconnect_failed', () => {
        console.error('[SOCKET CLIENT] Reconnect failed');
        notifyStateListeners('OFFLINE');
      });
    }

    if (!socket.connected) {
      notifyStateListeners('RECONNECTING');
      socket.connect();
    }

    return socket;
  },

  /**
   * Disconnect Socket Client
   */
  disconnectSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
      notifyStateListeners('OFFLINE');
    }
  },

  /**
   * Subscribe to Queue Room
   */
  subscribeQueue(queueId) {
    if (socket && queueId) {
      socket.emit('subscribeQueue', queueId);
    }
  },

  /**
   * Unsubscribe from Queue Room
   */
  unsubscribeQueue(queueId) {
    if (socket && queueId) {
      socket.emit('unsubscribeQueue', queueId);
    }
  },

  /**
   * Listen for private ticket/position updates (yourQueueUpdated)
   */
  onYourQueueUpdated(callback) {
    if (!socket) this.connectSocket();
    socket.on('yourQueueUpdated', callback);
    return () => socket?.off('yourQueueUpdated', callback);
  },

  /**
   * Listen for public aggregate queue updates (queueUpdated)
   */
  onQueueUpdated(callback) {
    if (!socket) this.connectSocket();
    socket.on('queueUpdated', callback);
    return () => socket?.off('queueUpdated', callback);
  },

  /**
   * Listen for public queue status changes (queueStatusChanged)
   */
  onQueueStatusChanged(callback) {
    if (!socket) this.connectSocket();
    socket.on('queueStatusChanged', callback);
    return () => socket?.off('queueStatusChanged', callback);
  },

  /**
   * Subscribe to Admin Live Crowd Room
   */
  subscribeAdminLive(organizationId) {
    if (!socket) this.connectSocket();
    socket.emit('subscribeAdminLive', { organizationId });
  },

  /**
   * Unsubscribe from Admin Live Crowd Room
   */
  unsubscribeAdminLive(organizationId) {
    if (socket) {
      socket.emit('unsubscribeAdminLive', { organizationId });
    }
  },

  /**
   * Listen for real-time admin live crowd updates (liveCrowdUpdated)
   */
  onLiveCrowdUpdated(callback) {
    if (!socket) this.connectSocket();
    socket.on('liveCrowdUpdated', callback);
    return () => socket?.off('liveCrowdUpdated', callback);
  },

  /**
   * Listen for real-time customer notifications (notificationCreated)
   */
  onNotificationCreated(callback) {
    if (!socket) this.connectSocket();
    socket.on('notificationCreated', callback);
    return () => socket?.off('notificationCreated', callback);
  },

  /**
   * Listen for connection state changes (CONNECTED, RECONNECTING, OFFLINE)
   */
  onConnectionStateChange(callback) {
    stateListeners.add(callback);
    callback(connectionState); // Immediate current state execution
    return () => stateListeners.delete(callback);
  },

  /**
   * Get current connection state string
   */
  getConnectionState() {
    return connectionState;
  },
};

export default socketService;
