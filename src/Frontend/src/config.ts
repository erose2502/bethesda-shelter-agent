/**
 * Application configuration
 */

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  refreshInterval: 10000, // 10 seconds
} as const;

export default config;
