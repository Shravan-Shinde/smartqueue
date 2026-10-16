const crypto = require('crypto');
const QueueEntry = require('../models/QueueEntry');

const TOKEN_PREFIX = 'SMARTQUEUE';

/**
 * Generate a cryptographically unpredictable secure opaque token
 * Format: SMARTQUEUE:<24-byte-hex-random> (48 hex chars)
 */
const generateSecureToken = () => {
  const randomHex = crypto.randomBytes(24).toString('hex');
  return `${TOKEN_PREFIX}:${randomHex}`;
};

/**
 * Determine whether a QueueEntry document is eligible for an active QR token.
 * Eligible statuses: WAITING, CALLED, SERVING (while isActive = true).
 * Ineligible: COMPLETED, NO_SHOW, CANCELLED or isActive = false.
 */
const isQrEligible = (entry) => {
  if (!entry || !entry.isActive) return false;
  const eligibleStatuses = ['WAITING', 'CALLED', 'SERVING'];
  return eligibleStatuses.includes(entry.status);
};

/**
 * Idempotently get existing or create a new secure QR token for a QueueEntry document
 */
const getOrCreateQrToken = async (entry) => {
  if (!entry) {
    return { eligible: false, error: 'Queue entry not found' };
  }

  if (!isQrEligible(entry)) {
    return {
      eligible: false,
      error: `QR code is not available for ${entry.status} queue entries`,
      status: entry.status,
    };
  }

  // Idempotent reuse: Return existing token if present
  if (entry.qrToken) {
    return {
      eligible: true,
      qrToken: entry.qrToken,
      createdAt: entry.qrTokenCreatedAt || entry.createdAt,
      isNew: false,
    };
  }

  // Generate new secure opaque token
  const newToken = generateSecureToken();
  entry.qrToken = newToken;
  entry.qrTokenCreatedAt = new Date();
  await entry.save();

  return {
    eligible: true,
    qrToken: newToken,
    createdAt: entry.qrTokenCreatedAt,
    isNew: true,
  };
};

/**
 * Helper to find a QueueEntry by raw QR token (Ready for Sprint 13 lookup)
 */
const findEntryByQrToken = async (qrToken) => {
  if (!qrToken || typeof qrToken !== 'string') return null;
  return QueueEntry.findOne({ qrToken });
};

/**
 * Validate that a token string matches the required SMARTQUEUE:<48 hex chars> format
 */
const validateQrTokenFormat = (qrToken) => {
  if (!qrToken || typeof qrToken !== 'string') return false;
  const parts = qrToken.split(':');
  if (parts.length !== 2) return false;
  if (parts[0] !== TOKEN_PREFIX) return false;
  const hexPart = parts[1];
  return /^[0-9a-fA-F]{48}$/.test(hexPart);
};

module.exports = {
  TOKEN_PREFIX,
  generateSecureToken,
  isQrEligible,
  getOrCreateQrToken,
  findEntryByQrToken,
  validateQrTokenFormat,
};
