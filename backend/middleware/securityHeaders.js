/**
 * SmartQueue HTTP Security Headers Middleware
 * Protects against MIME sniffing, clickjacking, XSS, and referrer leaks.
 */
const securityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing & clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable browser XSS filtering
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HTTP Strict Transport Security in production environments
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
};

module.exports = securityHeaders;
