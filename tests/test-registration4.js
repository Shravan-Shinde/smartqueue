const BASE_URL = 'http://localhost:5000/api/v1';

async function runTests() {
  try {
    const adminLogin = await fetch(BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo.admin@smartqueue.local',
        password: 'Demo@12345'
      })
    });
    const cookie = adminLogin.headers.get('set-cookie');
    
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
    console.log(createStaffData);
  } catch (error) {
    console.error('Test Failed:', error);
  }
}
runTests();
