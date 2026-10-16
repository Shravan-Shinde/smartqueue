const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect Middleware: Verifies JWT in HTTP-only cookie & attaches authenticated user
 */
const protect = async (req, res, next) => {
  try {
    let token = req.cookies ? req.cookies.smartqueue_token : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Authentication cookie missing',
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('FATAL SECURITY ERROR: JWT_SECRET missing in environment');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    // Verify token payload
    const decoded = jwt.verify(token, secret);

    // Fetch user from MongoDB
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: User account no longer exists',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Account has been deactivated',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Invalid or expired session token',
    });
  }
};

/**
 * Authorize Roles Middleware: Enforces backend Role-Based Access Control (RBAC)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] roles`,
      });
    }
    next();
  };
};

/**
 * Optional Auth Middleware: Attaches req.user if valid token present, does not block if unauthenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies ? req.cookies.smartqueue_token : null;
    const secret = process.env.JWT_SECRET;
    if (token && secret) {
      const decoded = jwt.verify(token, secret);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (err) {
    // Ignore invalid token in optional auth
  }
  next();
};

module.exports = {
  protect,
  authorizeRoles,
  optionalAuth,
};
