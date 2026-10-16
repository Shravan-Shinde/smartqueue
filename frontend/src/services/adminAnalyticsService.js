import apiClient from './api';

/**
 * Admin Analytics API Service Foundation (Ready for Sprint 15 UI Visualization)
 */
export const adminAnalyticsService = {
  // Get overview metrics with optional filters
  async getAnalyticsOverview(params = {}) {
    const response = await apiClient.get('/admin/analytics/overview', { params });
    return response.data;
  },

  // Get queue-level operational performance metrics
  async getAnalyticsQueues(params = {}) {
    const response = await apiClient.get('/admin/analytics/queues', { params });
    return response.data;
  },

  // Get counter-level performance & handled service load
  async getAnalyticsCounters(params = {}) {
    const response = await apiClient.get('/admin/analytics/counters', { params });
    return response.data;
  },

  // Get throughput and 24-hour peak traffic breakdown
  async getAnalyticsTraffic(params = {}) {
    const response = await apiClient.get('/admin/analytics/traffic', { params });
    return response.data;
  },

  // Get live crowd status and queue waiting count breakdown
  async getAnalyticsCrowd(params = {}) {
    const response = await apiClient.get('/admin/analytics/crowd', { params });
    return response.data;
  },
};

export default adminAnalyticsService;
