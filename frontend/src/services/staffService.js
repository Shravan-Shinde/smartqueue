import apiClient from './api';

/**
 * Staff Operational API Service
 */
export const staffService = {
  // Get staff member's assigned counter & queue details
  async getMyCounter(counterId = null) {
    const params = counterId ? { counterId } : {};
    const response = await apiClient.get('/staff/my-counter', { params });
    return response.data;
  },

  // Get waiting stream for counter's queue
  async getWaitingQueue(queueId, counterId = null) {
    const params = counterId ? { counterId } : {};
    const response = await apiClient.get(`/staff/queues/${queueId}/waiting`, { params });
    return response.data;
  },

  // Call next customer in queue (FIFO claim)
  async callNext(queueId, counterId = null) {
    const payload = counterId ? { counterId } : {};
    const response = await apiClient.post(`/staff/queues/${queueId}/call-next`, payload);
    return response.data;
  },

  // Start service for called customer
  async startService(entryId) {
    const response = await apiClient.post(`/staff/queue-entries/${entryId}/start`);
    return response.data;
  },

  // Complete service for customer being served
  async completeService(entryId) {
    const response = await apiClient.post(`/staff/queue-entries/${entryId}/complete`);
    return response.data;
  },

  // Update counter operational status (AVAILABLE <-> OFFLINE)
  async updateCounterStatus(status) {
    const response = await apiClient.patch('/staff/my-counter/status', { status });
    return response.data;
  },

  // Get staff operational history with pagination, status, and date filters
  async getStaffHistory({ page = 1, limit = 20, status = 'ALL', date = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (status && status !== 'ALL') params.append('status', status);
    if (date) params.append('date', date);

    const response = await apiClient.get(`/staff/history?${params.toString()}`);
    return response.data;
  },

  // Get daily staff operational summary metrics
  async getStaffHistorySummary({ date = '' } = {}) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);

    const response = await apiClient.get(`/staff/history/summary?${params.toString()}`);
    return response.data;
  },

  // Update queue entry priority (NORMAL, APPOINTMENT, PRIORITY, EMERGENCY)
  async updateEntryPriority(entryId, priority) {
    const response = await apiClient.patch(`/staff/queue-entries/${entryId}/priority`, { priority });
    return response.data;
  },

  // Check in customer via QR token
  async checkInWithQrToken(qrToken) {
    const response = await apiClient.post('/queues/check-in', { qrToken });
    return response.data;
  },
};

export default staffService;


