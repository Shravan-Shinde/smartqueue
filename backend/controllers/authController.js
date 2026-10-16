const User = require('../models/User');
const { generateToken, clearTokenCookie } = require('../utils/jwt');

/**
 * Format clean user object for safe API responses (never includes password)
 */
const formatUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  role: user.role,
  profileImage: user.profileImage || null,
  isVerified: user.isVerified,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

/**
 * POST /api/v1/auth/register
 * Register a new public CUSTOMER account
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address',
      });
    }

    // MANDATORY SECURITY RULE: Public registration ALWAYS creates CUSTOMER role
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || null,
      role: 'CUSTOMER', // Strictly forced server-side
    });

    // Set HTTP-only JWT Cookie
    generateToken(res, user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 * Authenticate user & issue HTTP-only JWT cookie
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Generic error message for security
    const genericErrorMessage = 'Invalid email or password.';

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: genericErrorMessage,
      });
    }

    // Compare password hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: genericErrorMessage,
      });
    }

    // Set HTTP-only JWT Cookie
    generateToken(res, user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 * Get currently authenticated user profile
 */
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: formatUserResponse(req.user),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/logout
 * Clear HTTP-only authentication cookie
 */
const logoutUser = async (req, res, next) => {
  try {
    clearTokenCookie(res);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/google
 * Verify Google ID token, link or create CUSTOMER account, and issue HTTP-only JWT
 */
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

let googleOAuthClient = null;
const getGoogleOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return null;
  }
  if (!googleOAuthClient) {
    googleOAuthClient = new OAuth2Client(clientId);
  }
  return googleOAuthClient;
};

const googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    const configuredClientId = process.env.GOOGLE_CLIENT_ID;

    if (!configuredClientId) {
      return res.status(500).json({
        success: false,
        message: 'Google Sign-In is not configured on the server. Missing GOOGLE_CLIENT_ID environment variable.',
      });
    }

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required.',
      });
    }

    const client = getGoogleOAuthClient();
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: configuredClientId,
      });
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google authentication token.',
      });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google authentication token payload.',
      });
    }

    // Security: Validate issuer
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google authentication token issuer.',
      });
    }

    // Security: Check verified email status
    if (!payload.email_verified || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Google email address is not verified. Please verify your email with Google first.',
      });
    }

    const googleSubjectId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture || null;

    // Check if user already exists by googleId
    let user = await User.findOne({ googleId: googleSubjectId });

    if (!user) {
      // Check if user exists by verified email address
      user = await User.findOne({ email });

      if (user) {
        // Handle account-linking conflict / association:
        // If account has a different googleId, reject conflict
        if (user.googleId && user.googleId !== googleSubjectId) {
          return res.status(409).json({
            success: false,
            message: 'This email is already associated with a different Google account.',
          });
        }

        // Safely link Google identity to existing account
        user.googleId = googleSubjectId;
        if (!user.isVerified) {
          user.isVerified = true;
        }
        if (!user.profileImage && picture) {
          user.profileImage = picture;
        }
        // Save user without modifying or touching password
        await user.save();
      } else {
        // New account creation via Google:
        // STRICT SECURITY RULE: Public registration ALWAYS creates CUSTOMER role
        const randomPassword = crypto.randomBytes(32).toString('hex') + 'Aa1!';
        user = await User.create({
          name,
          email,
          password: randomPassword,
          googleId: googleSubjectId,
          authProvider: 'GOOGLE',
          role: 'CUSTOMER', // Strictly forced server-side
          isVerified: true,
          profileImage: picture,
          isActive: true,
        });
      }
    }

    // Verify account active status
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.',
      });
    }

    // Set HTTP-only JWT Cookie using existing session architecture
    generateToken(res, user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: formatUserResponse(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  googleAuth,
};
