const axios = require('axios');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  try {
    console.log('Testing public customer registration...');
    const registerRes = await axios.post(\\/auth/register\, {
      name: 'Test Customer',
      email: 'test.customer.' + Date.now() + '@example.com',
      password: 'StrongPassword123'
    });
    console.log('Customer registration:', registerRes.data.success ? 'PASSED' : 'FAILED');
    assert.strictEqual(registerRes.data.data.user.role, 'CUSTOMER');

    console.log('Testing rejection of public STAFF registration (manual manipulation)...');
    const registerStaffRes = await axios.post(\\/auth/register\, {
      name: 'Test Hacker',
      email: 'test.hacker.' + Date.now() + '@example.com',
      password: 'StrongPassword123',
      role: 'STAFF'
    });
    console.log('Hack registration resulted in role:', registerStaffRes.data.data.user.role);
    assert.strictEqual(registerStaffRes.data.data.user.role, 'CUSTOMER', 'Backend must force CUSTOMER role');
    console.log('Staff rejection:', 'PASSED (forced to CUSTOMER)');
    
    // Login as Admin
    console.log('Logging in as Admin...');
    let cookie;
    const adminLogin = await axios.post(\\/auth/login\, {
      email: 'demo.admin@smartqueue.local',
      password: 'Demo@12345'
    });
    cookie = adminLogin.headers['set-cookie'][0];
    
    // Create staff
    console.log('Testing Admin-created Staff account...');
    const createStaff = await axios.post(\\/admin/staff\, {
      name: 'New Staff',
      email: 'new.staff.' + Date.now() + '@example.com',
      password: 'Password123'
    }, {
      headers: { Cookie: cookie }
    });
    console.log('Admin creating Staff account:', createStaff.data.success ? 'PASSED' : 'FAILED');
    assert.strictEqual(createStaff.data.data.user.role, 'STAFF');

    console.log('ALL REGISTRATION TESTS PASSED.');
  } catch (error) {
    console.error('Test Failed:', error.response?.data || error.message);
  }
}

runTests();
