import apiClient from './api';

/**
 * Admin Counter & Queue Management API Service
 */
export const adminCounterQueueService = {
  // Counter Admin APIs
  async getCounters(organizationId, locationId, departmentId, params = {}) {
    const response = await apiClient.get(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/counters`,
      { params }
    );
    return response.data;
  },

  async createCounter(organizationId, locationId, departmentId, counterData) {
    const response = await apiClient.post(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/counters`,
      counterData
    );
    return response.data;
  },

  async updateCounter(organizationId, locationId, departmentId, counterId, counterData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/counters/${counterId}`,
      counterData
    );
    return response.data;
  },

  async updateCounterStatus(organizationId, locationId, departmentId, counterId, statusData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/counters/${counterId}/status`,
      statusData
    );
    return response.data;
  },

  // Queue Admin APIs
  async getQueues(organizationId, locationId, departmentId, params = {}) {
    const response = await apiClient.get(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/queues`,
      { params }
    );
    return response.data;
  },

  async createQueue(organizationId, locationId, departmentId, queueData) {
    const response = await apiClient.post(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/queues`,
      queueData
    );
    return response.data;
  },

  async updateQueue(organizationId, locationId, departmentId, queueId, queueData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/queues/${queueId}`,
      queueData
    );
    return response.data;
  },

  async updateQueueStatus(organizationId, locationId, departmentId, queueId, statusData) {
    const response = await apiClient.patch(
      `/admin/organizations/${organizationId}/locations/${locationId}/departments/${departmentId}/queues/${queueId}/status`,
      statusData
    );
    return response.data;
  },
};

export default adminCounterQueueService;
