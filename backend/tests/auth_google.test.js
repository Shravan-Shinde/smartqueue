/**
 * Comprehensive Automated Test Suite: SmartQueue Authentication & Google OAuth
 * Tests:
 * 1. Existing email/password login
 * 2. Existing public registration
 * 3. Incorrect password handling
 * 4. Invalid email handling
 * 5. Password confirmation validation
 * 6. Google login with valid credentials (verified ID token)
 * 7. Google authentication with invalid ID token
 * 8. Google authentication with wrong audience
 * 9. Google authentication with unverified email
 * 10. Duplicate account handling
 * 11. Existing account linking conflicts
 * 12. Customer role assignment (forced CUSTOMER)
 * 13. Prevention of Admin/Staff privilege escalation
 * 14. Role-based redirection verification
 * 15. Logout and protected routes
 */

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('../config/db');
const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');
const errorHandler = require('../middleware/errorHandler');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';
const TEST_PORT = 5099;

let server;
let app;

const makeRequest = (path, method = 'GET', body = null, cookieToken = null) => {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookieToken) {
      headers['Cookie'] = `smartqueue_token=${cookieToken}`;
    }

    const options = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'];
        let tokenCookie = null;
        if (setCookie) {
          const match = setCookie.join(';').match(/smartqueue_token=([^;]+)/);
          if (match) tokenCookie = match[1];
        }
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, tokenCookie });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, tokenCookie });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

const runAuthTests = async () => {
  console.log('\n============================================================');
  console.log('SMARTQUEUE AUTHENTICATION & GOOGLE OAUTH TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✓ ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  };

  try {
    await connectDB();
    console.log('[TEST SETUP] Connected to MongoDB');

    // Clean previous test accounts
    await User.deleteMany({ email: { $regex: /@testauth\.local$/i } });

    // Set test GOOGLE_CLIENT_ID
    const TEST_CLIENT_ID = 'test-google-client-id-12345.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_ID = TEST_CLIENT_ID;

    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
    app.use(errorHandler);

    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[TEST SETUP] Server listening on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // TEST 1: Public Registration with email & password
    // ----------------------------------------------------
    console.log('--- TEST GROUP 1: Email & Password Registration ---');
    const regRes = await makeRequest('/api/v1/auth/register', 'POST', {
      name: 'Sarah Connor',
      email: 'sarah.connor@testauth.local',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    assert(regRes.status === 201, 'Registration returns 201 Created');
    assert(regRes.body.data?.user?.role === 'CUSTOMER', 'New registered user is assigned role CUSTOMER');
    assert(regRes.body.data?.user?.email === 'sarah.connor@testauth.local', 'Registered email matches');
    assert(Boolean(regRes.tokenCookie), 'HTTP-only JWT cookie issued on registration');

    // ----------------------------------------------------
    // TEST 2: Password confirmation mismatch validation
    // ----------------------------------------------------
    const mismatchRes = await makeRequest('/api/v1/auth/register', 'POST', {
      name: 'Mismatch User',
      email: 'mismatch@testauth.local',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword123!',
    });
    assert(mismatchRes.status === 400, 'Password mismatch returns 400 Bad Request');
    assert(mismatchRes.body.message.includes('Passwords do not match'), 'Correct mismatch message returned');

    // ----------------------------------------------------
    // TEST 3: Invalid email validation
    // ----------------------------------------------------
    const invalidEmailRes = await makeRequest('/api/v1/auth/register', 'POST', {
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    assert(invalidEmailRes.status === 400, 'Invalid email returns 400 Bad Request');

    // ----------------------------------------------------
    // TEST 4: Duplicate account registration prevention
    // ----------------------------------------------------
    const dupRes = await makeRequest('/api/v1/auth/register', 'POST', {
      name: 'Sarah Duplicate',
      email: 'sarah.connor@testauth.local',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    assert(dupRes.status === 400, 'Duplicate email registration returns 400');
    assert(dupRes.body.message.includes('User already exists'), 'Helpful duplicate error returned');

    // ----------------------------------------------------
    // TEST 5: Role escalation prevention on public registration
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 2: Security & Privilege Escalation Prevention ---');
    const hackerReg = await makeRequest('/api/v1/auth/register', 'POST', {
      name: 'Sneaky Hacker',
      email: 'hacker@testauth.local',
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'ADMIN', // Attempt privilege escalation
    });
    assert(hackerReg.status === 201, 'Hacker registration succeeds but forced to CUSTOMER');
    assert(hackerReg.body.data?.user?.role === 'CUSTOMER', 'Role is strictly CUSTOMER (escalation prevented)');

    // ----------------------------------------------------
    // TEST 6: Email / Password Login (Valid Credentials)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 3: Email & Password Login ---');
    const loginRes = await makeRequest('/api/v1/auth/login', 'POST', {
      email: 'sarah.connor@testauth.local',
      password: 'Password123!',
    });
    assert(loginRes.status === 200, 'Login with valid credentials returns 200 OK');
    assert(loginRes.body.data?.user?.role === 'CUSTOMER', 'Login returns valid user data');
    assert(Boolean(loginRes.tokenCookie), 'HTTP-only JWT cookie issued on login');

    // ----------------------------------------------------
    // TEST 7: Incorrect Password Handling
    // ----------------------------------------------------
    const badPwRes = await makeRequest('/api/v1/auth/login', 'POST', {
      email: 'sarah.connor@testauth.local',
      password: 'WrongPassword999!',
    });
    assert(badPwRes.status === 401, 'Incorrect password returns 401 Unauthorized');
    assert(badPwRes.body.message.includes('Invalid email or password'), 'Generic invalid credentials message for security');

    // ----------------------------------------------------
    // TEST 8: Google Auth - Missing ID Token
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 4: Google OAuth Verification ---');
    const noTokenRes = await makeRequest('/api/v1/auth/google', 'POST', {});
    assert(noTokenRes.status === 400, 'Google auth with missing token returns 400');

    // ----------------------------------------------------
    // TEST 9: Google Auth - Invalid / Malformed ID Token
    // ----------------------------------------------------
    const fakeTokenRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'invalid.malformed.idtoken',
    });
    assert(fakeTokenRes.status === 401, 'Google auth with malformed token returns 401 Unauthorized');
    assert(fakeTokenRes.body.message.includes('Invalid Google authentication token'), 'Expected invalid token message');

    // ----------------------------------------------------
    // TEST 10: Mock verifyIdToken for OAuth library edge cases
    // ----------------------------------------------------
    const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;

    // Test 10a: Wrong audience
    OAuth2Client.prototype.verifyIdToken = async function (opts) {
      if (opts.audience !== TEST_CLIENT_ID) {
        throw new Error('Wrong audience');
      }
      return {
        getPayload: () => ({
          iss: 'accounts.google.com',
          aud: 'wrong-audience-client-id.apps.googleusercontent.com',
          sub: 'google-sub-wrong-aud',
          email: 'wrongaud@testauth.local',
          email_verified: true,
        }),
      };
    };

    // Test with audience verification failure
    OAuth2Client.prototype.verifyIdToken = async function () {
      throw new Error('Token audience mismatch: audience does not match configured client id');
    };
    const wrongAudRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'token-with-wrong-audience',
    });
    assert(wrongAudRes.status === 401, 'Wrong audience rejection returns 401');

    // Test 10b: Unverified email
    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          iss: 'accounts.google.com',
          aud: TEST_CLIENT_ID,
          sub: 'google-sub-unverified',
          email: 'unverified@testauth.local',
          email_verified: false, // NOT verified
        }),
      };
    };
    const unverifiedRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'token-with-unverified-email',
    });
    assert(unverifiedRes.status === 400, 'Unverified email rejection returns 400');
    assert(unverifiedRes.body.message.includes('not verified'), 'Unverified email error message returned');

    // Test 10c: Successful Google Registration for new customer
    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          iss: 'accounts.google.com',
          aud: TEST_CLIENT_ID,
          sub: 'google-sub-newcustomer-98765',
          email: 'newgoogle.customer@testauth.local',
          email_verified: true,
          name: 'Google Customer',
          picture: 'https://lh3.googleusercontent.com/test-pic.jpg',
        }),
      };
    };
    const googleRegRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'valid-google-id-token-new-user',
    });
    assert(googleRegRes.status === 200, 'Google sign-up returns 200 OK');
    assert(googleRegRes.body.data?.user?.role === 'CUSTOMER', 'New Google user assigned role CUSTOMER');
    assert(googleRegRes.body.data?.user?.email === 'newgoogle.customer@testauth.local', 'Google user email matches');
    assert(Boolean(googleRegRes.tokenCookie), 'HTTP-only JWT cookie issued for Google user');

    // Verify in database that password was set securely and role is CUSTOMER
    const savedGoogleUser = await User.findOne({ email: 'newgoogle.customer@testauth.local' }).select('+password');
    assert(Boolean(savedGoogleUser.password), 'Google user has secure hashed placeholder password');
    assert(savedGoogleUser.googleId === 'google-sub-newcustomer-98765', 'googleId saved correctly');
    assert(savedGoogleUser.authProvider === 'GOOGLE', 'authProvider is GOOGLE');

    // Test 10d: Subsequent Google Login for existing Google user
    const googleLoginRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'valid-google-id-token-existing-user',
    });
    assert(googleLoginRes.status === 200, 'Google login for existing user returns 200 OK');
    assert(googleLoginRes.body.data?.user?.id === savedGoogleUser._id.toString(), 'Existing account recognized without duplicate');

    // Test 10e: Linking Google Identity to existing eligible email/password account
    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: TEST_CLIENT_ID,
          sub: 'google-sub-linked-sarah',
          email: 'sarah.connor@testauth.local', // Existing email registered in Test 1
          email_verified: true,
          name: 'Sarah Connor Google',
        }),
      };
    };
    const linkRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'valid-google-id-token-link-account',
    });
    assert(linkRes.status === 200, 'Existing email/password account successfully linked to Google');
    assert(linkRes.body.data?.user?.email === 'sarah.connor@testauth.local', 'Linked account email preserved');

    // Verify existing password was NOT overwritten
    const sarahUser = await User.findOne({ email: 'sarah.connor@testauth.local' }).select('+password');
    const isPwIntact = await sarahUser.matchPassword('Password123!');
    assert(isPwIntact, 'Original password intact after Google account linking (never overwritten)');
    assert(sarahUser.googleId === 'google-sub-linked-sarah', 'Google ID linked to existing account');

    // Test 10f: Linking Conflict - Attempting to link with conflicting googleId
    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          aud: TEST_CLIENT_ID,
          sub: 'different-google-sub-conflict',
          email: 'sarah.connor@testauth.local', // Already linked to 'google-sub-linked-sarah'
          email_verified: true,
        }),
      };
    };
    const conflictRes = await makeRequest('/api/v1/auth/google', 'POST', {
      idToken: 'valid-google-id-token-conflict',
    });
    assert(conflictRes.status === 409, 'Conflicting Google identity linking rejected with 409 Conflict');

    // Restore OAuth2Client prototype
    OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;

    // ----------------------------------------------------
    // TEST 11: Protected Route & Current User Session (/me)
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 5: Session Verification & Protected Routes ---');
    const meRes = await makeRequest('/api/v1/auth/me', 'GET', null, googleLoginRes.tokenCookie);
    assert(meRes.status === 200, '/api/v1/auth/me returns 200 with valid JWT cookie');
    assert(meRes.body.data?.user?.email === 'newgoogle.customer@testauth.local', '/me returns authenticated user');

    // Unauthenticated access to /me
    const unauthMe = await makeRequest('/api/v1/auth/me', 'GET');
    assert(unauthMe.status === 401, '/api/v1/auth/me returns 401 when cookie is missing');

    // ----------------------------------------------------
    // TEST 12: Logout
    // ----------------------------------------------------
    const logoutRes = await makeRequest('/api/v1/auth/logout', 'POST', null, googleLoginRes.tokenCookie);
    assert(logoutRes.status === 200, '/api/v1/auth/logout returns 200 OK');

    // ----------------------------------------------------
    // TEST 13: RBAC Authorization Routes
    // ----------------------------------------------------
    console.log('\n--- TEST GROUP 6: Role-Based Access Control ---');
    const custAuthTest = await makeRequest('/api/v1/auth/test/customer', 'GET', null, googleLoginRes.tokenCookie);
    assert(custAuthTest.status === 200, 'Customer authorized for CUSTOMER test endpoint');

    const staffEscalationTest = await makeRequest('/api/v1/auth/test/staff', 'GET', null, googleLoginRes.tokenCookie);
    assert(staffEscalationTest.status === 403, 'Customer forbidden from STAFF test endpoint');

    const adminEscalationTest = await makeRequest('/api/v1/auth/test/admin', 'GET', null, googleLoginRes.tokenCookie);
    assert(adminEscalationTest.status === 403, 'Customer forbidden from ADMIN test endpoint');

    console.log('\n============================================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('============================================================\n');

    // Cleanup
    await User.deleteMany({ email: { $regex: /@testauth\.local$/i } });
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runAuthTests();
