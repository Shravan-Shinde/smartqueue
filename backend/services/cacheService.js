const crypto = require('crypto');
const { getRedisClient, getRedisStatus } = require('../config/redis');

/**
 * SmartQueue Centralized Cache Service
 * Implements Cache-Aside pattern, bounded TTLs, security audits, and graceful Redis failure fallbacks.
 */

// Safe in-memory observability metrics
const metrics = {
  hits: 0,
  misses: 0,
  errors: 0,
};

// In-flight Promise Map to prevent cache stampedes on simultaneous misses for the same key
const inFlightPromises = new Map();

// Sensitive property check list to prevent caching credentials/PII
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'qrToken', 'secret', 'jwt'];

/**
 * Audit data to ensure sensitive information is never cached
 */
const auditSecurity = (val) => {
  if (!val) return;
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  for (const field of SENSITIVE_FIELDS) {
    if (str.includes(`"${field}"`)) {
      throw new Error(`[CACHE SECURITY VIOLATION] Attempted to cache sensitive field: ${field}`);
    }
  }
};

/**
 * Generate canonical MD5 hash for query objects/filters
 * @param {Object} queryObj
 * @returns {string}
 */
const hashQuery = (queryObj = {}) => {
  if (!queryObj || Object.keys(queryObj).length === 0) return 'all';
  // Sort keys alphabetically for canonical hash
  const sorted = {};
  Object.keys(queryObj)
    .sort()
    .forEach((k) => {
      sorted[k] = queryObj[k];
    });
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex').substring(0, 12);
};

const cacheService = {
  /**
   * Get value from cache by key
   * @param {string} key
   * @returns {Promise<any|null>} Parsed JSON or null
   */
  async get(key) {
    try {
      const client = getRedisClient();
      if (!client || !client.isOpen || getRedisStatus() !== 'CONNECTED') {
        metrics.misses++;
        return null;
      }

      const raw = await client.get(key);
      if (raw === null || raw === undefined) {
        metrics.misses++;
        return null;
      }

      metrics.hits++;
      return JSON.parse(raw);
    } catch (err) {
      metrics.errors++;
      console.warn(`[CACHE SERVICE GET ERROR] Key: ${key} - ${err.message}`);
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds Default 60 seconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlSeconds = 60) {
    try {
      auditSecurity(value);

      const client = getRedisClient();
      if (!client || !client.isOpen || getRedisStatus() !== 'CONNECTED') {
        return false;
      }

      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, serialized, { EX: ttlSeconds });
      } else {
        await client.set(key, serialized);
      }
      return true;
    } catch (err) {
      metrics.errors++;
      console.warn(`[CACHE SERVICE SET ERROR] Key: ${key} - ${err.message}`);
      return false;
    }
  },

  /**
   * Delete single key or array of keys
   * @param {string|string[]} keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async delete(keys) {
    try {
      const client = getRedisClient();
      if (!client || !client.isOpen || getRedisStatus() !== 'CONNECTED') {
        return 0;
      }

      const keysArr = Array.isArray(keys) ? keys : [keys];
      if (keysArr.length === 0) return 0;

      const deletedCount = await client.del(keysArr);
      return deletedCount;
    } catch (err) {
      metrics.errors++;
      console.warn(`[CACHE SERVICE DEL ERROR] Keys: ${keys} - ${err.message}`);
      return 0;
    }
  },

  /**
   * Delete matching key pattern (e.g. "smartqueue:organizations:*")
   * @param {string} pattern
   * @returns {Promise<number>}
   */
  async deletePattern(pattern) {
    try {
      const client = getRedisClient();
      if (!client || !client.isOpen || getRedisStatus() !== 'CONNECTED') {
        return 0;
      }

      const matchingKeys = await client.keys(pattern);
      if (matchingKeys && matchingKeys.length > 0) {
        return await client.del(matchingKeys);
      }
      return 0;
    } catch (err) {
      metrics.errors++;
      console.warn(`[CACHE SERVICE DEL PATTERN ERROR] Pattern: ${pattern} - ${err.message}`);
      return 0;
    }
  },

  /**
   * Cache-Aside Wrapper with Stampede Prevention
   * READ: Redis GET -> HIT -> return cached data; MISS -> execute loader -> Redis SET -> return data.
   * @param {string} key
   * @param {Function} loader Async data loader function (MongoDB query)
   * @param {number} ttlSeconds TTL in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, loader, ttlSeconds = 60) {
    // 1. Try reading from Redis first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 2. Check if a loader request for this key is already in-flight (Stampede Protection)
    if (inFlightPromises.has(key)) {
      return await inFlightPromises.get(key);
    }

    // 3. Execute loader and cache result
    const promise = (async () => {
      try {
        const freshData = await loader();
        if (freshData !== null && freshData !== undefined) {
          // Set in background without blocking caller response
          this.set(key, freshData, ttlSeconds).catch((e) =>
            console.warn(`[CACHE SET ASIDE ERR] ${e.message}`)
          );
        }
        return freshData;
      } finally {
        inFlightPromises.delete(key);
      }
    })();

    inFlightPromises.set(key, promise);
    return await promise;
  },

  /**
   * Get metrics snapshot
   */
  getMetrics() {
    return { ...metrics };
  },

  /**
   * Reset metrics
   */
  resetMetrics() {
    metrics.hits = 0;
    metrics.misses = 0;
    metrics.errors = 0;
  },

  /**
   * Expose query canonical hasher helper
   */
  hashQuery,
};

module.exports = cacheService;
