const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateInput,
  createOrgValidators,
  updateOrgValidators,
  createLocationValidators,
  updateLocationValidators,
  createDepartmentValidators,
  updateDepartmentValidators,
} = require('../validators/adminOrgValidators');

const {
  adminGetOrganizations,
  adminCreateOrganization,
  adminGetOrganizationById,
  adminUpdateOrganization,
  adminToggleOrganizationStatus,
  adminGetLocations,
  adminCreateLocation,
  adminGetLocationById,
  adminUpdateLocation,
  adminToggleLocationStatus,
  adminGetDepartments,
  adminCreateDepartment,
  adminGetDepartmentById,
  adminUpdateDepartment,
  adminToggleDepartmentStatus,
} = require('../controllers/adminOrgController');

// All Admin routes require authentication and ADMIN role authorization
router.use(protect);
router.use(authorizeRoles('ADMIN'));

// ==========================================
// Organization Admin Management Endpoints
// ==========================================
router.get('/', adminGetOrganizations);
router.post('/', createOrgValidators, validateInput, adminCreateOrganization);
router.get('/:organizationId', adminGetOrganizationById);
router.patch('/:organizationId', updateOrgValidators, validateInput, adminUpdateOrganization);
router.patch('/:organizationId/status', adminToggleOrganizationStatus);

// ==========================================
// Location Admin Management Endpoints
// ==========================================
router.get('/:organizationId/locations', adminGetLocations);
router.post('/:organizationId/locations', createLocationValidators, validateInput, adminCreateLocation);
router.get('/:organizationId/locations/:locationId', adminGetLocationById);
router.patch('/:organizationId/locations/:locationId', updateLocationValidators, validateInput, adminUpdateLocation);
router.patch('/:organizationId/locations/:locationId/status', adminToggleLocationStatus);

// ==========================================
// Department Admin Management Endpoints
// ==========================================
router.get('/:organizationId/locations/:locationId/departments', adminGetDepartments);
router.post('/:organizationId/locations/:locationId/departments', createDepartmentValidators, validateInput, adminCreateDepartment);
router.get('/:organizationId/locations/:locationId/departments/:departmentId', adminGetDepartmentById);
router.patch('/:organizationId/locations/:locationId/departments/:departmentId', updateDepartmentValidators, validateInput, adminUpdateDepartment);
router.patch('/:organizationId/locations/:locationId/departments/:departmentId/status', adminToggleDepartmentStatus);

// ==========================================
// Counter & Queue Admin Management Endpoints
// ==========================================
const adminCounterQueueRoutes = require('./adminCounterQueueRoutes');
router.use('/', adminCounterQueueRoutes);

module.exports = router;
