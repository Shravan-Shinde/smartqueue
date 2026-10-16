const jwt = require('jsonwebtoken');

/**
 * Generates signed JWT token and sets HTTP-only cookie on response
 * Payload contains only minimal authorization info: { userId, role }
 */
const generateToken = (res, userId, role) => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing.');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

  // Sign JWT with minimal payload
  const token = jwt.sign({ userId, role }, secret, {
    expiresIn: expiresIn,
  });

  // Configure HTTP-only cookie
  const sameSite = process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite: sameSite,
    maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
  };

  res.cookie('smartqueue_token', token, cookieOptions);

  return token;
};

/**
 * Clears authentication HTTP-only cookie
 */
const clearTokenCookie = (res) => {
  const sameSite = process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax');

  res.cookie('smartqueue_token', '', {
    httpOnly: true,
    expires: new Date(0),
    sameSite: sameSite,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
  });
};

module.exports = {
  generateToken,
  clearTokenCookie,
};
