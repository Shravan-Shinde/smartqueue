import axios from 'axios';

/**
 * Reusable Axios Client Instance with credentials support for HTTP-only cookies
 * Uses VITE_API_URL environment variable.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for transmitting HTTP-only authentication cookies
  timeout: 10000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = error.response?.data?.message;
    if (!errorMessage && error.response?.status === 401) {
      errorMessage = 'Authentication failed. Please check your credentials.';
    }
    const customError = {
      message: errorMessage || 'Network communication error',
      status: error.response?.status || 500,
      errors: error.response?.data?.errors || null,
    };
    return Promise.reject(customError);
  }
);

export default apiClient;
