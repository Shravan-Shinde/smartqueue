import apiClient from './api';

/**
 * Admin Live Crowd REST API Service
 */
export const adminLiveCrowdService = {
  // Fetch real-time live crowd snapshot
  async getLiveCrowdSnapshot(params = {}) {
    const response = await apiClient.get('/admin/live-crowd', { params });
    return response.data;
  },
};

export default adminLiveCrowdService;
