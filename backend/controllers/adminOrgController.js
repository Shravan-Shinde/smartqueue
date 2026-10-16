const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const cacheService = require('../services/cacheService');

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// ==========================================
// 1. ORGANIZATION ADMIN CONTROLLERS
// ==========================================

/**
 * GET /api/v1/admin/organizations
 * Admin list organizations with active/inactive status filters & search
 */
const adminGetOrganizations = async (req, res, next) => {
  try {
    const { search, category, status, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Status filter: ACTIVE, INACTIVE, ALL (default ALL for Admin)
    if (status === 'ACTIVE') {
      query.isActive = true;
    } else if (status === 'INACTIVE') {
      query.isActive = false;
    }

    // Category filter
    if (category && category !== 'ALL') {
      query.category = category.trim().toUpperCase();
    }

    // Search filter (name, description, or slug)
    if (search && typeof search === 'string' && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim());
      const regex = new RegExp(sanitized, 'i');
      query.$or = [{ name: regex }, { description: regex }, { slug: regex }];
    }

    const total = await Organization.countDocuments(query);
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: {
        organizations,
        pagination: {
          total,
          page: pageNum,
          totalPages,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/organizations
 * Create a new Organization
 */
const adminCreateOrganization = async (req, res, next) => {
  try {
    const { name, description, slug, category, logo, banner, isActive } = req.body;

    const formattedSlug = slug.toLowerCase().trim();

    // Check duplicate slug
    const existingOrg = await Organization.findOne({ slug: formattedSlug });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'Organization slug already exists.',
      });
    }

    const organization = await Organization.create({
      name,
      description,
      slug: formattedSlug,
      category,
      logo: logo || null,
      banner: banner || null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await cacheService.deletePattern('smartqueue:organizations:*');

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: { organization },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Organization slug already exists.',
      });
    }
    next(error);
  }
};

/**
 * GET /api/v1/admin/organizations/:organizationId
 */
const adminGetOrganizationById = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid Organization ID format' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    res.status(200).json({ success: true, data: { organization } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId
 * Update Organization fields
 */
const adminUpdateOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid Organization ID format' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const { name, description, slug, category, logo, banner, isActive } = req.body;

    // Check duplicate slug if slug is modified
    if (slug && slug.toLowerCase().trim() !== organization.slug) {
      const formattedSlug = slug.toLowerCase().trim();
      const existing = await Organization.findOne({ slug: formattedSlug });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Organization slug already exists.',
        });
      }
      organization.slug = formattedSlug;
    }

    if (name !== undefined) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (category !== undefined) organization.category = category;
    if (logo !== undefined) organization.logo = logo;
    if (banner !== undefined) organization.banner = banner;
    if (isActive !== undefined) organization.isActive = Boolean(isActive);

    await organization.save();

    await cacheService.delete(`smartqueue:organization:${organizationId}`);
    await cacheService.deletePattern('smartqueue:organizations:*');

    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: { organization },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Organization slug already exists.',
      });
    }
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId/status
 * Soft Deactivate / Reactivate Organization
 */
const adminToggleOrganizationStatus = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid Organization ID format' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    organization.isActive = !organization.isActive;
    await organization.save();

    await cacheService.delete(`smartqueue:organization:${organizationId}`);
    await cacheService.deletePattern('smartqueue:organizations:*');

    res.status(200).json({
      success: true,
      message: `Organization ${organization.isActive ? 'reactivated' : 'deactivated'} successfully`,
      data: { organization },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. LOCATION ADMIN CONTROLLERS
// ==========================================

/**
 * GET /api/v1/admin/organizations/:organizationId/locations
 */
const adminGetLocations = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid Organization ID format' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const locations = await Location.find({ organizationId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      data: { organizationId, locations },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/organizations/:organizationId/locations
 */
const adminCreateLocation = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ success: false, message: 'Invalid Organization ID format' });
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const { name, address, city, state, postalCode, phone, latitude, longitude, isActive } = req.body;

    const location = await Location.create({
      organizationId,
      name,
      address,
      city,
      state: state || null,
      postalCode: postalCode || null,
      phone: phone || null,
      latitude: latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== undefined ? Number(longitude) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await cacheService.delete(`smartqueue:location-list:${organizationId}`);

    res.status(201).json({
      success: true,
      message: 'Location created successfully',
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/organizations/:organizationId/locations/:locationId
 */
const adminGetLocationById = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const location = await Location.findOne({ _id: locationId, organizationId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found under specified organization' });
    }

    res.status(200).json({ success: true, data: { location } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId
 */
const adminUpdateLocation = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const location = await Location.findOne({ _id: locationId, organizationId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found under specified organization' });
    }

    const { name, address, city, state, postalCode, phone, latitude, longitude, isActive } = req.body;

    if (name !== undefined) location.name = name;
    if (address !== undefined) location.address = address;
    if (city !== undefined) location.city = city;
    if (state !== undefined) location.state = state;
    if (postalCode !== undefined) location.postalCode = postalCode;
    if (phone !== undefined) location.phone = phone;
    if (latitude !== undefined) location.latitude = latitude;
    if (longitude !== undefined) location.longitude = longitude;
    if (isActive !== undefined) location.isActive = Boolean(isActive);

    await location.save();

    await cacheService.delete([`smartqueue:location:${locationId}`, `smartqueue:location-list:${organizationId}`]);

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/status
 */
const adminToggleLocationStatus = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const location = await Location.findOne({ _id: locationId, organizationId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found under specified organization' });
    }

    location.isActive = !location.isActive;
    await location.save();

    await cacheService.delete([`smartqueue:location:${locationId}`, `smartqueue:location-list:${organizationId}`]);

    res.status(200).json({
      success: true,
      message: `Location ${location.isActive ? 'reactivated' : 'deactivated'} successfully`,
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. DEPARTMENT ADMIN CONTROLLERS
// ==========================================

/**
 * GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments
 */
const adminGetDepartments = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const location = await Location.findOne({ _id: locationId, organizationId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location relationship invalid' });
    }

    const departments = await Department.find({ locationId, organizationId }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      data: { organizationId, locationId, departments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/admin/organizations/:organizationId/locations/:locationId/departments
 */
const adminCreateDepartment = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    // Verify Hierarchy Relationship
    const location = await Location.findOne({ _id: locationId, organizationId });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location does not belong to specified organization' });
    }

    const { name, description, prefix, avgServiceTimeMins, isActive } = req.body;

    const department = await Department.create({
      organizationId,
      locationId,
      name,
      description: description || '',
      prefix: prefix || 'A',
      avgServiceTimeMins: avgServiceTimeMins ? Number(avgServiceTimeMins) : 15,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await cacheService.delete(`smartqueue:dept-list:${locationId}`);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId
 */
const adminGetDepartmentById = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(organizationId) ||
      !mongoose.Types.ObjectId.isValid(locationId) ||
      !mongoose.Types.ObjectId.isValid(departmentId)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const department = await Department.findOne({
      _id: departmentId,
      locationId,
      organizationId,
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found under specified location & organization' });
    }

    res.status(200).json({ success: true, data: { department } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId
 */
const adminUpdateDepartment = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(organizationId) ||
      !mongoose.Types.ObjectId.isValid(locationId) ||
      !mongoose.Types.ObjectId.isValid(departmentId)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const department = await Department.findOne({
      _id: departmentId,
      locationId,
      organizationId,
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found under specified location & organization' });
    }

    const { name, description, prefix, avgServiceTimeMins, isActive } = req.body;

    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;
    if (prefix !== undefined) department.prefix = prefix;
    if (avgServiceTimeMins !== undefined) department.avgServiceTimeMins = Number(avgServiceTimeMins);
    if (isActive !== undefined) department.isActive = Boolean(isActive);

    await department.save();

    await cacheService.delete([`smartqueue:department:${departmentId}`, `smartqueue:dept-list:${locationId}`]);
    await cacheService.deletePattern(`smartqueue:department-queues:${departmentId}:*`);

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/admin/organizations/:organizationId/locations/:locationId/departments/:departmentId/status
 */
const adminToggleDepartmentStatus = async (req, res, next) => {
  try {
    const { organizationId, locationId, departmentId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(organizationId) ||
      !mongoose.Types.ObjectId.isValid(locationId) ||
      !mongoose.Types.ObjectId.isValid(departmentId)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const department = await Department.findOne({
      _id: departmentId,
      locationId,
      organizationId,
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found under specified location & organization' });
    }

    department.isActive = !department.isActive;
    await department.save();

    await cacheService.delete([`smartqueue:department:${departmentId}`, `smartqueue:dept-list:${locationId}`]);
    await cacheService.deletePattern(`smartqueue:department-queues:${departmentId}:*`);

    res.status(200).json({
      success: true,
      message: `Department ${department.isActive ? 'reactivated' : 'deactivated'} successfully`,
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
