import apiClient from './api';

export const customerHistoryService = {
  // Get paginated customer service history list with filters
  async getCustomerHistory(params = {}) {
    const response = await apiClient.get('/customers/me/history', { params });
    return response.data;
  },

  // Get detailed history record for a specific ticket entry
  async getHistoryDetail(entryId) {
    const response = await apiClient.get(`/customers/me/history/${entryId}`);
    return response.data;
  },
};

export default customerHistoryService;
