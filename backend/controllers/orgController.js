const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const Location = require('../models/Location');
const Department = require('../models/Department');
const cacheService = require('../services/cacheService');

/**
 * Utility helper to safely escape regex special characters
 */
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * GET /api/v1/organizations
 * Public paginated organization discovery with search, category & city filters
 */
const getOrganizations = async (req, res, next) => {
  try {
    const { search, category, city, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    const queryParams = {
      search: search ? String(search).trim() : '',
      category: category ? String(category).trim().toUpperCase() : '',
      city: city ? String(city).trim() : '',
      page: pageNum,
      limit: limitNum,
    };

    const cacheKey = `smartqueue:organizations:${cacheService.hashQuery(queryParams)}`;

    const data = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const skip = (pageNum - 1) * limitNum;
        const query = { isActive: true };

        if (queryParams.search) {
          const sanitizedSearch = escapeRegex(queryParams.search);
          const searchRegex = new RegExp(sanitizedSearch, 'i');
          query.$or = [{ name: searchRegex }, { description: searchRegex }];
        }

        if (queryParams.category && queryParams.category !== 'ALL') {
          query.category = queryParams.category;
        }

        if (queryParams.city) {
          const sanitizedCity = escapeRegex(queryParams.city);
          const cityRegex = new RegExp(sanitizedCity, 'i');
          const matchingLocations = await Location.find({
            city: cityRegex,
            isActive: true,
          }).select('organizationId');

          const orgIdsInCity = matchingLocations.map((loc) => loc.organizationId);
          query._id = { $in: orgIdsInCity };
        }

        const total = await Organization.countDocuments(query);
        const organizations = await Organization.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean();

        const totalPages = Math.ceil(total / limitNum) || 1;

        return {
          organizations,
          pagination: {
            total,
            page: pageNum,
            totalPages,
            limit: limitNum,
          },
        };
      },
      120
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/organizations/:organizationId
 * Public organization details endpoint
 */
const getOrganizationById = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Organization ID format',
      });
    }

    const cacheKey = `smartqueue:organization:${organizationId}`;
    const organization = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await Organization.findOne({
          _id: organizationId,
          isActive: true,
        }).lean();
      },
      120
    );

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found or inactive',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        organization,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/organizations/:organizationId/locations
 * Discover active locations belonging to an organization
 */
const getLocations = async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Organization ID format',
      });
    }

    const cacheKey = `smartqueue:location-list:${organizationId}`;
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const organization = await Organization.findOne({
          _id: organizationId,
          isActive: true,
        }).lean();

        if (!organization) return null;

        const locations = await Location.find({
          organizationId,
          isActive: true,
        })
          .sort({ name: 1 })
          .lean();

        return { organizationId, locations };
      },
      120
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found or inactive',
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/organizations/:organizationId/locations/:locationId
 * Get specific location details for an organization
 */
const getLocationById = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Organization or Location ID format',
      });
    }

    const cacheKey = `smartqueue:location:${locationId}`;
    const location = await cacheService.getOrSet(
      cacheKey,
      async () => {
        return await Location.findOne({
          _id: locationId,
          organizationId,
          isActive: true,
        }).lean();
      },
      120
    );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found or does not belong to the specified organization',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        location,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/organizations/:organizationId/locations/:locationId/departments
 * Discover active departments/services available at a location
 */
const getDepartments = async (req, res, next) => {
  try {
    const { organizationId, locationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Organization or Location ID format',
      });
    }

    const cacheKey = `smartqueue:dept-list:${locationId}`;
    const result = await cacheService.getOrSet(
      cacheKey,
      async () => {
        const location = await Location.findOne({
          _id: locationId,
          organizationId,
          isActive: true,
        }).lean();

        if (!location) return null;

        const departments = await Department.find({
          locationId,
          organizationId,
          isActive: true,
        })
          .select('_id name description prefix avgServiceTimeMins isActive createdAt')
          .sort({ name: 1 })
          .lean();

        return { organizationId, locationId, departments };
      },
      120
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Location not found or does not belong to specified organization',
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrganizations,
  getOrganizationById,
  getLocations,
  getLocationById,
  getDepartments,
};
