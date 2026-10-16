const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  try {
    console.log('Testing public customer registration...');
    const registerRes = await fetch(BASE_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: 'test.customer.' + Date.now() + '@example.com',
        password: 'StrongPassword123'
      })
    });
    const registerData = await registerRes.json();
    console.log('Customer registration:', registerData.success ? 'PASSED' : 'FAILED');
    assert.strictEqual(registerData.data.user.role, 'CUSTOMER');

    console.log('Testing rejection of public STAFF registration (manual manipulation)...');
    const registerStaffRes = await fetch(BASE_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Hacker',
        email: 'test.hacker.' + Date.now() + '@example.com',
        password: 'StrongPassword123',
        role: 'STAFF'
      })
    });
    const registerStaffData = await registerStaffRes.json();
    console.log('Hack registration resulted in role:', registerStaffData.data.user.role);
    assert.strictEqual(registerStaffData.data.user.role, 'CUSTOMER', 'Backend must force CUSTOMER role');
    console.log('Staff rejection:', 'PASSED (forced to CUSTOMER)');
    
    // Login as Admin
    console.log('Logging in as Admin...');
    const adminLogin = await fetch(BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo.admin@smartqueue.local',
        password: 'Demo@12345'
      })
    });
    const cookie = adminLogin.headers.get('set-cookie');
    
    // Create staff
    console.log('Testing Admin-created Staff account...');
    const createStaff = await fetch(BASE_URL + '/admin/staff', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookie 
      },
      body: JSON.stringify({
        name: 'New Staff',
        email: 'new.staff.' + Date.now() + '@example.com',
        password: 'Password123'
      })
    });
    const createStaffData = await createStaff.json();
    console.log('Admin creating Staff account:', createStaffData.success ? 'PASSED' : 'FAILED');
    assert.strictEqual(createStaffData.data.user.role, 'STAFF');

    console.log('ALL REGISTRATION TESTS PASSED.');
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

runTests();
