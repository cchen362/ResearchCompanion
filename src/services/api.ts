import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { logger } from '@/utils/logger';

// Fix for Git Bash path conversion issue - ensure we always get '/api' not Windows paths
const API_URL = import.meta.env.VITE_API_BASE_URL?.startsWith('C:')
  ? '/api'  // Fallback if Git Bash converted the path
  : (import.meta.env.VITE_API_BASE_URL || '/api');

// Standard timeout for regular operations
const STANDARD_TIMEOUT = 60000; // 60 seconds

// Extended timeout for long-running operations
const LONG_OPERATION_TIMEOUT = 300000; // 5 minutes

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: STANDARD_TIMEOUT, // Default to standard timeout
});

/**
 * Create an API instance with extended timeout for long operations
 * Use this for operations like digest generation, agent runs, etc.
 */
export const longOperationApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: LONG_OPERATION_TIMEOUT,
});

/**
 * Helper to make API call with custom timeout
 */
export function apiWithTimeout(timeout: number = STANDARD_TIMEOUT): AxiosInstance {
  const instance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout,
  });

  // Apply the same interceptors
  applyInterceptors(instance);

  return instance;
}

/**
 * Apply standard interceptors to an axios instance
 */
function applyInterceptors(instance: AxiosInstance) {
  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      // Add auth token if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      logger.debug(`[API] Request: ${config.method?.toUpperCase()} ${config.url} (timeout: ${config.timeout}ms)`);
      return config;
    },
    (error) => {
      logger.error('[API] Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      logger.error('[API] Response Error:', error);
      if (error.response) {
        logger.error('[API] Response data:', error.response.data);
        logger.error('[API] Response status:', error.response.status);
      } else if (error.request) {
        logger.error('[API] No response received:', error.request);
      } else {
        logger.error('[API] Error message:', error.message);
      }
      return Promise.reject(error);
    }
  );
}

// Apply interceptors to the main api instance
applyInterceptors(api);

// Apply interceptors to the long operation instance
applyInterceptors(longOperationApi);

/**
 * Parse a natural language search query
 */
export async function parseSearchQuery(query: string) {
  const response = await api.post('/parse-search-query', { query });
  return response.data;
}

/**
 * Search the web for medical information
 */
export async function searchWeb(query: string, limit = 10) {
  const response = await api.post('/websearch', { query, limit });
  return response.data;
}

/**
 * Search PubMed for medical literature
 */
export async function searchPubMed(query: string, limit = 10) {
  const response = await api.post('/pubmed-search', { query, limit });
  return response.data;
}

/**
 * Search for clinical trials
 */
export async function searchClinicalTrials(
  query: string,
  status = 'RECRUITING',
  location?: { country?: string; state?: string }
) {
  const response = await api.post('/clinical-trials', { query, status, location });
  return response.data;
}

/**
 * Summarize search results
 */
export async function summarizeResults(
  results: any[],
  query: string,
  context?: string
) {
  const response = await api.post('/summarize', { results, query, context });
  return response.data;
}

/**
 * Summarize search results with extended timeout
 * Use this when summarizing large result sets
 */
export async function summarizeResultsLong(
  results: any[],
  query: string,
  context?: string
) {
  const response = await longOperationApi.post('/summarize', { results, query, context });
  return response.data;
}

/**
 * Check API health
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

// Default export for backward compatibility
export default api;