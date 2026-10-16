import apiClient from './api';

export const reviewService = {
  // Customer: Submit review for a completed queue ticket
  async submitReview(queueEntryId, reviewData) {
    const response = await apiClient.post(`/queue-entries/${queueEntryId}/review`, reviewData);
    return response.data;
  },

  // Customer: Fetch review for a specific entry
  async getEntryReview(queueEntryId) {
    const response = await apiClient.get(`/queue-entries/${queueEntryId}/review`);
    return response.data;
  },

  // Admin: Get paginated reviews list with filters
  async getAdminReviews(params = {}) {
    const response = await apiClient.get('/admin/reviews', { params });
    return response.data;
  },

  // Admin: Get aggregate review rating summary stats
  async getAdminReviewSummary(params = {}) {
    const response = await apiClient.get('/admin/reviews/summary', { params });
    return response.data;
  },

  // Admin: Toggle review status (PUBLISHED / HIDDEN)
  async updateReviewStatus(reviewId, status) {
    const response = await apiClient.patch(`/admin/reviews/${reviewId}/status`, { status });
    return response.data;
  },
};

export default reviewService;
