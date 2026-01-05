import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    if (error.response) {
      // Server responded with error
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // No response received
      console.error('No response received:', error.request);
    } else {
      // Request setup error
      console.error('Error message:', error.message);
    }
    return Promise.reject(error);
  }
);

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
 * Transcribe audio and generate summary
 */
export async function transcribeAudio(audioBlob: Blob) {
  // Convert blob to base64
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
  });

  reader.readAsDataURL(audioBlob);
  const audio = await base64Promise;

  const response = await api.post('/transcribe', {
    audio,
    mimeType: audioBlob.type
  });

  return response.data;
}

/**
 * Check API health
 */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data;
}

export default api;