const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const Counter = require('../models/Counter');
const QueueModel = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const todayStr = new Date().toISOString().split('T')[0];

async function ensureUser(userData) {
  let user = await User.findOne({ email: userData.email });
  if (!user) {
    user = await User.create(userData);
  }
  return user;
}
const seedDatabase = async () => {
  console.log('====================================================');
  console.log('SMARTQUEUE — SEEDING DEMO DATABASE DATA (IDEMPOTENT)');
  console.log('====================================================\n');

  try {
    await connectDB();

    console.log('[1/7] Cleaning existing collection records...');
    await Promise.all([
      Organization.deleteMany({}),
      Location.deleteMany({}),
      Department.deleteMany({}),
      Counter.deleteMany({}),
      QueueModel.deleteMany({}),
      QueueEntry.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('  ✓ Collections cleared successfully.');

    console.log('[2/7] Seeding Users (Admin, Staff, Customers)...');
    const demoPassword = 'Demo@12345';
    const legacyPassword = 'Password@123456';

    // Primary Demo Accounts
    const demoAdmin = await ensureUser({
      name: 'Shravan Shinde',
      email: 'demo.admin@smartqueue.local',
      password: demoPassword,
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
    });

    const demoStaff = await ensureUser({
      name: 'Dr. Rahul Sharma',
      email: 'demo.staff@smartqueue.local',
      password: demoPassword,
      role: 'STAFF',
      isActive: true,
      isVerified: true,
    });

    const demoCustomer = await ensureUser({
      name: 'Shravan Shinde',
      email: 'demo.customer@smartqueue.local',
      password: demoPassword,
      role: 'CUSTOMER',
      phone: '+91 98765 43210',
      isActive: true,
      isVerified: true,
    });

    // Backwards Compatibility Aliases
    await ensureUser({
      name: 'System Admin (Legacy)',
      email: 'admin@smartqueue.com',
      password: legacyPassword,
      role: 'ADMIN',
      isActive: true,
    });

    await ensureUser({
      name: 'Staff User (Legacy)',
      email: 'staff@smartqueue.com',
      password: legacyPassword,
      role: 'STAFF',
      isActive: true,
    });

    await ensureUser({
      name: 'Customer User (Legacy)',
      email: 'customer@smartqueue.com',
      password: legacyPassword,
      role: 'CUSTOMER',
      isActive: true,
    });

    // Other Waiting Customers
    const customer2 = await ensureUser({
      name: 'Arjun Desai',
      email: 'david.miller@example.com',
      password: demoPassword,
      role: 'CUSTOMER',
      isActive: true,
    });

    const customer3 = await ensureUser({
      name: 'Priya Patel',
      email: 'priya.patel@example.com',
      password: demoPassword,
      role: 'CUSTOMER',
      isActive: true,
    });

    const customer4 = await ensureUser({
      name: 'Vikram Singh',
      email: 'vikram.singh@example.com',
      password: demoPassword,
      role: 'CUSTOMER',
      isActive: true,
    });

    console.log('  ✓ Created Demo Users:');
    console.log('     • Customer: demo.customer@smartqueue.local / Demo@12345');
    console.log('     • Staff:    demo.staff@smartqueue.local    / Demo@12345');
    console.log('     • Admin:    demo.admin@smartqueue.local    / Demo@12345');

    console.log('[3/7] Seeding Organizations, Locations & Departments...');
    
    // Org 1: Apex Health City Hospital
    const orgApex = await Organization.create({
      name: 'Apex Health City Hospital',
      slug: 'apex-health-city',
      category: 'HOSPITAL',
      description: 'Multi-specialty tertiary care hospital with 24/7 emergency, OPD, and cardiology diagnostics.',
      email: 'contact@apexhospital.org',
      phone: '+91 20 5551 2345',
      website: 'https://apexhospital.org',
      logoUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locApex = await Location.create({
      organizationId: orgApex._id,
      name: 'Central Tower OPD Wing',
      address: 'Plot 42, University Road, Shivajinagar',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411005',
      coordinates: { latitude: 18.5204, longitude: 73.8567 },
      operatingHours: { open: '08:00', close: '20:00' },
      isActive: true,
    });

    const deptApexOpd = await Department.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      name: 'General Medicine & OPD',
      code: 'OPD-CARD',
      prefix: 'OPD',
      description: 'Outpatient consultations, routine checkups, and general health screenings.',
      isActive: true,
    });

    const deptApexCardio = await Department.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      name: 'Cardiology Specialist Consult',
      code: 'CARD-SPEC',
      prefix: 'CARD',
      description: 'Senior cardiologist consultation and non-invasive cardiac checkups.',
      isActive: true,
    });

    // Org 2: National Trust Bank
    const orgBank = await Organization.create({
      name: 'National Trust Bank',
      slug: 'national-trust-bank',
      category: 'BANK',
      description: 'Premier retail and commercial banking branch providing cash deposits, forex, and loan servicing.',
      email: 'support@nationaltrustbank.com',
      phone: '+91 22 4433 8800',
      website: 'https://nationaltrustbank.com',
      logoUrl: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=300',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locBank = await Location.create({
      organizationId: orgBank._id,
      name: 'Bandra Financial Center Branch',
      address: 'BKC Avenue 4, Bandra Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400051',
      coordinates: { latitude: 19.0657, longitude: 72.8687 },
      operatingHours: { open: '09:30', close: '16:30' },
      isActive: true,
    });

    const deptBankCash = await Department.create({
      organizationId: orgBank._id,
      locationId: locBank._id,
      name: 'Retail Cash & Accounts',
      code: 'RETAIL-CASH',
      prefix: 'CSH',
      description: 'Counter cash deposits, withdrawals, demand drafts, and basic account services.',
      isActive: true,
    });

    const deptBankLoans = await Department.create({
      organizationId: orgBank._id,
      locationId: locBank._id,
      name: 'Home & Personal Loans Desk',
      code: 'LOAN-DESK',
      prefix: 'LON',
      description: 'Loan application verification, document submission, and counseling.',
      isActive: true,
    });

    // Org 3: Metropolitan RTO
    const orgRto = await Organization.create({
      name: 'Metropolitan RTO & Driving License Bureau',
      slug: 'metro-rto-bureau',
      category: 'GOVERNMENT',
      description: 'State transport department branch for driving test appointments, vehicle registration, and permits.',
      email: 'helpdesk@metrorto.gov.in',
      phone: '+91 80 2211 4455',
      website: 'https://metrorto.gov.in',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locRto = await Location.create({
      organizationId: orgRto._id,
      name: 'Koramangala Zonal Center',
      address: '8th Main Road, 4th Block Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560034',
      isActive: true,
    });

    const deptRtoDl = await Department.create({
      organizationId: orgRto._id,
      locationId: locRto._id,
      name: 'Driving License & Verification',
      code: 'DL-VERIFY',
      prefix: 'RTO',
      description: 'Biometric capture, learner license verification, and permanent license processing.',
      isActive: true,
    });

    // Org 4: Luxe Hair & Spa Lounge
    const orgSalon = await Organization.create({
      name: 'Luxe Hair & Spa Lounge',
      slug: 'luxe-hair-spa',
      category: 'SALON',
      description: 'Luxury styling lounge offering precision haircutting, hair coloring, and relaxing spa treatments.',
      email: 'appointments@luxesalon.com',
      phone: '+91 11 6655 1122',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locSalon = await Location.create({
      organizationId: orgSalon._id,
      name: 'Connaught Place Flagship',
      address: 'Block E, Inner Circle, Connaught Place',
      city: 'Delhi',
      state: 'Delhi NCR',
      zipCode: '110001',
      isActive: true,
    });

    const deptSalonStyling = await Department.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      name: 'Hair Styling & Spa',
      code: 'STYLING-SPA',
      prefix: 'SPA',
      description: 'Senior stylist consultations, hair cut, coloring, and essential spa treatment.',
      isActive: true,
    });

    // Org 5: Pune Civic Service Center
    const orgCivic = await Organization.create({
      name: 'Pune Civic Service Center',
      slug: 'pune-civic-center',
      category: 'SERVICE_CENTER',
      description: 'Integrated municipal facility for property tax payment, birth/death certificates, and civic grievances.',
      email: 'contact@punecivic.gov.in',
      phone: '+91 20 2550 0000',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locCivic = await Location.create({
      organizationId: orgCivic._id,
      name: 'PMC Head Office Complex',
      address: 'Near Dengle Bridge, Shivajinagar',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411005',
      isActive: true,
    });

    const deptCivicTax = await Department.create({
      organizationId: orgCivic._id,
      locationId: locCivic._id,
      name: 'Property Tax & Certificates Counter',
      code: 'CIVIC-TAX',
      prefix: 'TAX',
      description: 'Property tax payment counter and official certificate issuance.',
      isActive: true,
    });

    // Org 6: Nova Student Services
    const orgCollege = await Organization.create({
      name: 'Nova Student Services Center',
      slug: 'nova-student-services',
      category: 'COLLEGE',
      description: 'Centralized university administrative block for transcript issuance, fee payments, and admissions.',
      email: 'students@nova.edu.in',
      phone: '+91 20 6789 1234',
      isActive: true,
      ownerId: demoAdmin._id,
    });

    const locCollege = await Location.create({
      organizationId: orgCollege._id,
      name: 'Main Campus Admin Building',
      address: 'Kothrud Education Zone, Paud Road',
      city: 'Pune',
      state: 'Maharashtra',
      zipCode: '411038',
      isActive: true,
    });

    const deptCollegeAdmin = await Department.create({
      organizationId: orgCollege._id,
      locationId: locCollege._id,
      name: 'Transcripts & Certificate Desk',
      code: 'STU-CERT',
      prefix: 'STU',
      description: 'Student transcript verification, degree collection, and fee receipts.',
      isActive: true,
    });

    console.log('  ✓ Created 6 Organizations with Locations & Departments.');

    console.log('[4/7] Seeding Staff Counters & Operational Queues...');
    
    // Counters
    const counterApex1 = await Counter.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexOpd._id,
      name: 'Counter 101 (OPD Registration)',
      number: 'C-101',
      assignedStaffId: demoStaff._id,
      status: 'AVAILABLE',
      isActive: true,
    });

    const counterSalon1 = await Counter.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      name: 'Spa Station 1',
      number: 'S-01',
      status: 'AVAILABLE',
      isActive: true,
    });

    const counterBank1 = await Counter.create({
      organizationId: orgBank._id,
      locationId: locBank._id,
      departmentId: deptBankCash._id,
      name: 'Teller Counter 1',
      number: 'T-01',
      status: 'AVAILABLE',
      isActive: true,
    });

    // Queues
    const queueApexOpd = await QueueModel.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexOpd._id,
      name: 'General Medicine & OPD Queue',
      prefix: 'OPD',
      avgServiceTimeMins: 10,
      maxCapacity: 100,
      status: 'OPEN',
      isActive: true,
    });

    const queueApexCardio = await QueueModel.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexCardio._id,
      name: 'Cardiology Specialist Consult',
      prefix: 'CARD',
      avgServiceTimeMins: 15,
      maxCapacity: 50,
      status: 'OPEN',
      isActive: true,
    });

    const queueBankCash = await QueueModel.create({
      organizationId: orgBank._id,
      locationId: locBank._id,
      departmentId: deptBankCash._id,
      name: 'Teller Cash & Deposit Line',
      prefix: 'CSH',
      avgServiceTimeMins: 5,
      maxCapacity: 150,
      status: 'OPEN',
      isActive: true,
    });

    const queueRtoDl = await QueueModel.create({
      organizationId: orgRto._id,
      locationId: locRto._id,
      departmentId: deptRtoDl._id,
      name: 'Learner License Verification Queue',
      prefix: 'RTO',
      avgServiceTimeMins: 8,
      maxCapacity: 200,
      status: 'OPEN',
      isActive: true,
    });

    const queueSalonSpa = await QueueModel.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      name: 'Hair Styling & Spa Walk-in Line',
      prefix: 'SPA',
      avgServiceTimeMins: 20,
      maxCapacity: 30,
      status: 'OPEN',
      isActive: true,
    });

    const queueCivicTax = await QueueModel.create({
      organizationId: orgCivic._id,
      locationId: locCivic._id,
      departmentId: deptCivicTax._id,
      name: 'Property Tax & Certificates Queue',
      prefix: 'TAX',
      avgServiceTimeMins: 10,
      maxCapacity: 100,
      status: 'OPEN',
      isActive: true,
    });

    const queueCollege = await QueueModel.create({
      organizationId: orgCollege._id,
      locationId: locCollege._id,
      departmentId: deptCollegeAdmin._id,
      name: 'Student Certificate Verification Queue',
      prefix: 'STU',
      avgServiceTimeMins: 7,
      maxCapacity: 80,
      status: 'OPEN',
      isActive: true,
    });

    console.log('  ✓ Created 3 Counters and 7 Active Queues.');

    console.log('[5/7] Seeding Customer Live Queue Ticket & History Records...');

    // 1. ACTIVE LIVE QUEUE TICKET FOR DEMO CUSTOMER (SPA-104 at Luxe Hair & Spa Lounge)
    // 3 people ahead of customer: SPA-101, SPA-102, SPA-103
    await QueueEntry.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      queueId: queueSalonSpa._id,
      customerId: customer2._id,
      ticketNumber: 'SPA-101',
      sequenceNumber: 101,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 25 * 60 * 1000),
      estimatedWaitMinutes: 5,
      qrToken: 'SQ_TKT_SPA101_SEED',
      qrTokenCreatedAt: new Date(),
      isCheckedIn: true,
      checkedInAt: new Date(Date.now() - 20 * 60 * 1000),
      isActive: true,
    });

    await QueueEntry.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      queueId: queueSalonSpa._id,
      customerId: customer3._id,
      ticketNumber: 'SPA-102',
      sequenceNumber: 102,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 18 * 60 * 1000),
      estimatedWaitMinutes: 10,
      qrToken: 'SQ_TKT_SPA102_SEED',
      qrTokenCreatedAt: new Date(),
      isCheckedIn: true,
      checkedInAt: new Date(Date.now() - 15 * 60 * 1000),
      isActive: true,
    });

    await QueueEntry.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      queueId: queueSalonSpa._id,
      customerId: customer4._id,
      ticketNumber: 'SPA-103',
      sequenceNumber: 103,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 10 * 60 * 1000),
      estimatedWaitMinutes: 15,
      qrToken: 'SQ_TKT_SPA103_SEED',
      qrTokenCreatedAt: new Date(),
      isCheckedIn: false,
      isActive: true,
    });

    // DEMO CUSTOMER TICKET: SPA-104 (Position 4, 3 people ahead!)
    const activeDemoTicket = await QueueEntry.create({
      organizationId: orgSalon._id,
      locationId: locSalon._id,
      departmentId: deptSalonStyling._id,
      queueId: queueSalonSpa._id,
      customerId: demoCustomer._id,
      ticketNumber: 'SPA-104',
      sequenceNumber: 104,
      sequenceDate: todayStr,
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 5 * 60 * 1000),
      estimatedWaitMinutes: 20,
      qrToken: 'SQ_TKT_SPA104_SEED',
      qrTokenCreatedAt: new Date(),
      isCheckedIn: true,
      checkedInAt: new Date(Date.now() - 4 * 60 * 1000),
      isActive: true,
    });

    // Update queue sequence counter
    queueSalonSpa.lastSequenceDate = todayStr;
    queueSalonSpa.lastSequenceNumber = 104;
    await queueSalonSpa.save();

    // 2. COMPLETED SERVICE RECORD 1 (Apex Hospital OPD-099)
    const completedRecord1 = await QueueEntry.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexOpd._id,
      queueId: queueApexOpd._id,
      customerId: demoCustomer._id,
      ticketNumber: 'OPD-099',
      sequenceNumber: 99,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      priority: 'NORMAL',
      calledByCounterId: counterApex1._id,
      calledByUserId: demoStaff._id,
      joinedAt: new Date(Date.now() - 120 * 60 * 1000),
      calledAt: new Date(Date.now() - 95 * 60 * 1000),
      startedAt: new Date(Date.now() - 94 * 60 * 1000),
      completedAt: new Date(Date.now() - 80 * 60 * 1000),
      isCheckedIn: true,
      isActive: false,
    });

    // 3. COMPLETED SERVICE RECORD 2 (National Trust Bank CSH-045)
    await QueueEntry.create({
      organizationId: orgBank._id,
      locationId: locBank._id,
      departmentId: deptBankCash._id,
      queueId: queueBankCash._id,
      customerId: demoCustomer._id,
      ticketNumber: 'CSH-045',
      sequenceNumber: 45,
      sequenceDate: todayStr,
      status: 'COMPLETED',
      priority: 'NORMAL',
      calledByCounterId: counterBank1._id,
      calledByUserId: demoStaff._id,
      joinedAt: new Date(Date.now() - 240 * 60 * 1000),
      calledAt: new Date(Date.now() - 225 * 60 * 1000),
      startedAt: new Date(Date.now() - 224 * 60 * 1000),
      completedAt: new Date(Date.now() - 215 * 60 * 1000),
      isCheckedIn: true,
      isActive: false,
    });

    // 4. CANCELLED VISIT RECORD (Apex Hospital OPD-088)
    await QueueEntry.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexOpd._id,
      queueId: queueApexOpd._id,
      customerId: demoCustomer._id,
      ticketNumber: 'OPD-088',
      sequenceNumber: 88,
      sequenceDate: todayStr,
      status: 'CANCELLED',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 360 * 60 * 1000),
      cancelledAt: new Date(Date.now() - 350 * 60 * 1000),
      isCheckedIn: false,
      isActive: false,
    });

    // 5. NO-SHOW VISIT RECORD (Pune Civic Center TAX-031)
    await QueueEntry.create({
      organizationId: orgCivic._id,
      locationId: locCivic._id,
      departmentId: deptCivicTax._id,
      queueId: queueCivicTax._id,
      customerId: demoCustomer._id,
      ticketNumber: 'TAX-031',
      sequenceNumber: 31,
      sequenceDate: todayStr,
      status: 'NO_SHOW',
      priority: 'NORMAL',
      joinedAt: new Date(Date.now() - 480 * 60 * 1000),
      calledAt: new Date(Date.now() - 450 * 60 * 1000),
      noShowAt: new Date(Date.now() - 440 * 60 * 1000),
      isCheckedIn: true,
      isActive: false,
    });

    console.log('  ✓ Created Active Token SPA-104 (3 ahead) & 4 Historical Records (Completed, Cancelled, No-Show).');

    console.log('[6/7] Seeding Reviews & Persistent Notifications...');

    // Seed 5-star review for OPD-099
    await Review.create({
      organizationId: orgApex._id,
      locationId: locApex._id,
      departmentId: deptApexOpd._id,
      queueId: queueApexOpd._id,
      queueEntryId: completedRecord1._id,
      customerId: demoCustomer._id,
      rating: 5,
      comment: 'Outstanding queue management experience! Received live position alerts on phone and avoided waiting in crowded hall.',
      status: 'PUBLISHED',
    });

    // Seed Notifications for Demo Customer
    await Notification.create({
      userId: demoCustomer._id,
      type: 'QUEUE_JOINED',
      title: 'Queue Joined Successfully',
      message: 'You have joined Hair Styling & Spa Walk-in Line. Your digital ticket token is SPA-104.',
      queueId: queueSalonSpa._id,
      queueEntryId: activeDemoTicket._id,
      isRead: false,
    });

    await Notification.create({
      userId: demoCustomer._id,
      type: 'SERVICE_COMPLETED',
      title: 'Service Visit Completed',
      message: 'Your consultation at General Medicine & OPD Queue (OPD-099) has been completed. Thank you for using SmartQueue!',
      queueId: queueApexOpd._id,
      queueEntryId: completedRecord1._id,
      isRead: true,
    });

    console.log('  ✓ Created Customer Review and Notifications.');

    console.log('\n====================================================');
    console.log('DATABASE SEED COMPLETE! OFFICIAL DEMO CREDENTIALS:');
    console.log('  👤 Customer: demo.customer@smartqueue.local / Demo@12345');
    console.log('  👨‍💼 Staff:    demo.staff@smartqueue.local    / Demo@12345');
    console.log('  👑 Admin:    demo.admin@smartqueue.local    / Demo@12345');
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  }
};

seedDatabase();
