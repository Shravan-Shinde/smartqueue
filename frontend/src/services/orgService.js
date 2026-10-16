import apiClient from './api';

/**
 * Organization Discovery Service
 * Wraps read-only API calls for Organizations, Locations, and Departments
 */
export const orgService = {
  /**
   * Fetch public paginated organization list with search, category & city filters
   */
  async getOrganizations(params = {}) {
    const response = await apiClient.get('/organizations', { params });
    return response.data;
  },

  /**
   * Fetch single organization details by ID
   */
  async getOrganizationById(organizationId) {
    const response = await apiClient.get(`/organizations/${organizationId}`);
    return response.data;
  },

  /**
   * Fetch locations for a given organization ID
   */
  async getLocations(organizationId) {
    const response = await apiClient.get(`/organizations/${organizationId}/locations`);
    return response.data;
  },

  /**
   * Fetch specific location details
   */
  async getLocationById(organizationId, locationId) {
    const response = await apiClient.get(`/organizations/${organizationId}/locations/${locationId}`);
    return response.data;
  },

  /**
   * Fetch departments/services for a given location and organization
   */
  async getDepartments(organizationId, locationId) {
    const response = await apiClient.get(
      `/organizations/${organizationId}/locations/${locationId}/departments`
    );
    return response.data;
  },
};

export default orgService;
