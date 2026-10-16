import apiClient from './api';

/**
 * Customer Notification API Service
 */
export const notificationService = {
  // Get paginated customer notifications
  async getNotifications(page = 1, limit = 20, unreadOnly = false) {
    const params = { page, limit };
    if (unreadOnly) params.unreadOnly = true;
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  // Get customer unread notification count
  async getUnreadCount() {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  },

  // Mark single notification as read
  async markAsRead(notificationId) {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  // Mark all unread notifications as read
  async markAllAsRead() {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },
};

export default notificationService;
