const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter for Authentication Endpoints (Login & Register)
 * Limits requests per IP window to prevent brute-force credential stuffing.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 15, // Max 15 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
  },
});

/**
 * Rate Limiter for Sensitive API Mutation Endpoints (Queue Join & Check-In)
 * Prevents automated ticket spamming while allowing high legitimate traffic.
 */
const apiMutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // Max 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many request attempts. Please wait a moment before trying again.',
  },
});

module.exports = {
  authRateLimiter,
  apiMutationRateLimiter,
};
