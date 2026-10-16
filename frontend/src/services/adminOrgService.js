import apiClient from './api';

/**
 * Admin Organization, Location, and Department CRUD API Service
 */
export const adminOrgService = {
  // Organization Admin APIs
  async getOrganizations(params = {}) {
    const response = await apiClient.get('/admin/organizations', { params });
    return response.data;
  },

  async createOrganization(orgData) {
    const response = await apiClient.post('/admin/organizations', orgData);
    return response.data;
  },

  async getOrganizationById(organizationId) {
    const response = await apiClient.get(`/admin/organizations/${organizationId}`);
    return response.data;
  },

  async updateOrganization(organizationId, orgData) {
    const response = await apiClient.patch(`/admin/organizations/${organizationId}`, orgData);
    return response.data;
  },

  async toggleOrganizationStatus(organizationId) {
    const response = await apiClient.patch(`/admin/organizations/${organizationId}/status`);
    return response.data;
  },

  // Location Admin APIs
  async getLocations(organizationId) {
    const response = await apiClient.get(`/admin/organizations/${organizationId}/locations`);
    return response.data;
  },

  async createLocation(organizationId, locationData) {
    const response = await apiClient.post(`/admin/organizations/${organizationId}/locations`, locationData);
    return response.data;
  },

  async updateLocation(organizationId, locationId, locationData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}`,
      locationData
    );
    return response.data;
  },

  async toggleLocationStatus(organizationId, locationId) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/status`
    );
    return response.data;
  },

  // Department Admin APIs
  async getDepartments(organizationId, locationId) {
    const response = await apiClient.get(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments`
    );
    return response.data;
  },

  async createDepartment(organizationId, locationId, deptData) {
    const response = await apiClient.post(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments`,
      deptData
    );
    return response.data;
  },

  async updateDepartment(organizationId, locationId, departmentId, deptData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}`,
      deptData
    );
    return response.data;
  },

  async toggleDepartmentStatus(organizationId, locationId, departmentId) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/status`
    );
    return response.data;
  },
};

export default adminOrgService;
