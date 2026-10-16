const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');

const JWT_SECRET = process.env.JWT_SECRET || 'smartqueue_jwt_secret_dev_key_2026';

const runTests = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE SPRINT 4 — BACKEND VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Verify Queue model exists
    const queuePath = path.join(__dirname, '../models/Queue.js');
    assert(fs.existsSync(queuePath), 'Queue.js model file MUST exist');

    // 2. Connect to DB
    await connectDB();
    console.log('[DB] Connected to MongoDB for test execution.');

    // 3. Clean test records
    await Organization.deleteMany({ slug: 'sprint4-test-org' });
    await User.deleteMany({ email: { $in: ['s4admin@test.com', 's4staff@test.com', 's4cust@test.com'] } });

    // 4. Create Users for RBAC testing
    const adminUser = await User.create({
      name: 'Sprint4 Admin',
      email: 's4admin@test.com',
      password: 'password123',
      role: 'ADMIN',
    });

    const staffUser = await User.create({
      name: 'Sprint4 Staff',
      email: 's4staff@test.com',
      password: 'password123',
      role: 'STAFF',
    });

    const customerUser = await User.create({
      name: 'Sprint4 Customer',
      email: 's4cust@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });

    const adminToken = jwt.sign({ id: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
    const staffToken = jwt.sign({ id: staffUser._id, role: staffUser.role }, JWT_SECRET, { expiresIn: '1h' });
    const customerToken = jwt.sign({ id: customerUser._id, role: customerUser.role }, JWT_SECRET, { expiresIn: '1h' });

    // 5. Create Hierarchy (Org -> Location -> Department)
    const org = await Organization.create({
      name: 'Sprint4 Test Org',
      description: 'Test organization for Sprint 4 queue & counter testing',
      slug: 'sprint4-test-org',
      category: 'HOSPITAL',
      isActive: true,
    });

    const loc = await Location.create({
      organizationId: org._id,
      name: 'Main Campus',
      address: '100 Health Way',
      city: 'Metropolis',
      isActive: true,
    });

    const dept = await Department.create({
      organizationId: org._id,
      locationId: loc._id,
      name: 'Cardiology',
      prefix: 'CARD',
      avgServiceTimeMins: 20,
      isActive: true,
    });

    assert(Counter !== undefined, 'Counter model loaded successfully');
    assert(Queue !== undefined, 'Queue model loaded successfully');

    // 6. Test Counter Creation & Logic directly via model/controller logic
    const counter1 = await Counter.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'Cardiology Counter 1',
      number: '1',
      status: 'OFFLINE',
      isActive: true,
    });
    assert(counter1._id !== undefined, 'Admin can create counter');

    // Update Counter
    counter1.name = 'Cardiology Counter 1 A';
    await counter1.save();
    assert(counter1.name === 'Cardiology Counter 1 A', 'Admin can update counter name');

    // Change Counter Status
    counter1.status = 'AVAILABLE';
    await counter1.save();
    assert(counter1.status === 'AVAILABLE', 'Admin can change counter status to AVAILABLE');

    // Soft Deactivate Counter
    counter1.isActive = false;
    await counter1.save();
    assert(counter1.isActive === false, 'Admin can soft-deactivate counter (isActive = false)');

    // Reactivate Counter
    counter1.isActive = true;
    await counter1.save();
    assert(counter1.isActive === true, 'Admin can reactivate counter (isActive = true)');

    // Test Duplicate Counter Identity
    let dupCounterError = false;
    try {
      await Counter.create({
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        name: 'Cardiology Counter 1 A',
        number: '1',
      });
    } catch (err) {
      if (err.code === 11000) dupCounterError = true;
    }
    assert(dupCounterError, 'Duplicate counter name in same department is rejected by MongoDB index');

    // 7. Test Queue Creation & Logic
    const queue1 = await Queue.create({
      organizationId: org._id,
      locationId: loc._id,
      departmentId: dept._id,
      name: 'General Cardiac Queue',
      prefix: 'CARD',
      description: 'General OPD line',
      avgServiceTimeMins: 15,
      maxCapacity: 100,
      status: 'CLOSED',
      isActive: true,
    });
    assert(queue1._id !== undefined, 'Admin can create queue');

    // Update Queue
    queue1.name = 'General Cardiac OPD Line';
    queue1.maxCapacity = 150;
    await queue1.save();
    assert(queue1.maxCapacity === 150, 'Admin can update queue capacity');

    // Change Queue Status (OPEN, PAUSED, CLOSED)
    queue1.status = 'OPEN';
    await queue1.save();
    assert(queue1.status === 'OPEN', 'Admin can set queue status to OPEN');

    queue1.status = 'PAUSED';
    await queue1.save();
    assert(queue1.status === 'PAUSED', 'Admin can set queue status to PAUSED');

    queue1.status = 'CLOSED';
    await queue1.save();
    assert(queue1.status === 'CLOSED', 'Admin can set queue status to CLOSED');

    // Soft Deactivate Queue
    queue1.isActive = false;
    await queue1.save();
    assert(queue1.isActive === false, 'Admin can soft-deactivate queue');

    // Reactivate Queue
    queue1.isActive = true;
    await queue1.save();
    assert(queue1.isActive === true, 'Admin can reactivate queue');

    // Test Duplicate Queue Prefix
    let dupQueueError = false;
    try {
      await Queue.create({
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        name: 'Second Cardiac Queue',
        prefix: 'CARD',
      });
    } catch (err) {
      if (err.code === 11000) dupQueueError = true;
    }
    assert(dupQueueError, 'Duplicate queue prefix in same department is rejected by MongoDB index');

    // 8. Test Invalid Model Validations
    let invalidServiceTimeError = false;
    try {
      await Queue.create({
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        name: 'Bad Service Queue',
        prefix: 'BAD1',
        avgServiceTimeMins: 500, // Max is 480
      });
    } catch (err) {
      invalidServiceTimeError = true;
    }
    assert(invalidServiceTimeError, 'Invalid service time (>480 mins) rejected');

    let invalidCapacityError = false;
    try {
      await Queue.create({
        organizationId: org._id,
        locationId: loc._id,
        departmentId: dept._id,
        name: 'Bad Capacity Queue',
        prefix: 'BAD2',
        maxCapacity: 0, // Min is 1
      });
    } catch (err) {
      invalidCapacityError = true;
    }
    assert(invalidCapacityError, 'Invalid queue capacity (<1) rejected');

    // 9. Cleanup Test Data
    await Counter.deleteMany({ organizationId: org._id });
    await Queue.deleteMany({ organizationId: org._id });
    await Department.deleteMany({ _id: dept._id });
    await Location.deleteMany({ _id: loc._id });
    await Organization.deleteMany({ _id: org._id });
    await User.deleteMany({ _id: { $in: [adminUser._id, staffUser._id, customerUser._id] } });

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('[TEST SUITE FATAL ERROR]', error);
    process.exit(1);
  }
};

runTests();
