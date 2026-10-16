import apiClient from './api';

/**
 * Customer Queue Join & Digital Token API Service
 */
export const queueService = {
  // Get active public queues for a department
  async getQueuesForDepartment(departmentId) {
    const response = await apiClient.get(`/departments/${departmentId}/queues`);
    return response.data;
  },

  // Get public queue details by ID
  async getQueueById(queueId) {
    const response = await apiClient.get(`/queues/${queueId}`);
    return response.data;
  },

  // Customer joins an OPEN queue
  async joinQueue(queueId) {
    const response = await apiClient.post(`/queues/${queueId}/join`);
    return response.data;
  },

  // Get customer's current active queue entry
  async getActiveQueueEntry() {
    const response = await apiClient.get('/queues/my-active-entry');
    return response.data;
  },

  // Get specific queue entry details
  async getQueueEntryById(entryId) {
    const response = await apiClient.get(`/queue-entries/${entryId}`);
    return response.data;
  },

  // Cancel an active queue entry
  async cancelQueueEntry(entryId) {
    const response = await apiClient.patch(`/queue-entries/${entryId}/cancel`);
    return response.data;
  },

  // Get entry wait-time details
  async getEntryWaitTime(entryId) {
    const response = await apiClient.get(`/queue-entries/${entryId}/wait-time`);
    return response.data;
  },

  // Get secure QR token payload for queue entry
  async getEntryQrToken(entryId) {
    const response = await apiClient.get(`/queue-entries/${entryId}/qr`);
    return response.data;
  },
};

export default queueService;
