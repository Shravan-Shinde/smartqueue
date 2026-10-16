/**
 * SmartQueue Backend Constants & Configuration Defs
 */

module.exports = {
  API_PREFIX: '/api/v1',
  DEFAULT_PORT: 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  ROLES: {
    CUSTOMER: 'CUSTOMER',
    STAFF: 'STAFF',
    ADMIN: 'ADMIN',
  },
  QUEUE_STATES: {
    WAITING: 'WAITING',
    CALLED: 'CALLED',
    SERVING: 'SERVING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    NO_SHOW: 'NO_SHOW',
  },
};
