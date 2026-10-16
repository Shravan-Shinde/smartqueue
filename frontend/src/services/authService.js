import apiClient from './api';

/**
 * Authentication Service wrapping HTTP-only cookie auth endpoints
 */
export const authService = {
  /**
   * Register a new user (always creates CUSTOMER role)
   */
  async register(userData) {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  /**
   * Login user with email & password
   */
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  /**
   * Fetch currently authenticated user profile from HTTP-only cookie
   */
  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  /**
   * Google authentication with verified ID token
   */
  async googleAuth(idToken) {
    const response = await apiClient.post('/auth/google', { idToken });
    return response.data;
  },

  /**
   * Logout user and clear HTTP-only cookie
   */
  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
};

export default authService;
