const express = require('express');
const router = express.Router();

const {
  getOrganizations,
  getOrganizationById,
  getLocations,
  getLocationById,
  getDepartments,
} = require('../controllers/orgController');

// Public Read-Only Discovery Endpoints
router.get('/', getOrganizations);
router.get('/:organizationId', getOrganizationById);
router.get('/:organizationId/locations', getLocations);
router.get('/:organizationId/locations/:locationId', getLocationById);
router.get('/:organizationId/locations/:locationId/departments', getDepartments);

module.exports = router;
