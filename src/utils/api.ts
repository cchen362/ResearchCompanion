/**
 * API utility for making HTTP requests to the backend
 */

interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

interface ApiError extends Error {
  response?: {
    status: number;
    statusText: string;
    data: any;
  };
}

class ApiClient {
  private baseURL: string;

  constructor() {
    // Use environment variable or default to relative path
    this.baseURL = import.meta.env.VITE_API_BASE_URL || '';
  }

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(response.statusText) as ApiError;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
        };
        throw error;
      }

      return {
        data: responseData as T,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      if ((error as ApiError).response) {
        throw error;
      }
      // Network error or other issue
      const apiError = new Error('Network error') as ApiError;
      apiError.response = {
        status: 0,
        statusText: 'Network Error',
        data: null,
      };
      throw apiError;
    }
  }

  async get<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T>(url: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  async put<T>(url: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  async patch<T>(url: string, data?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, options);
  }

  async delete<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }
}

export const api = new ApiClient();
export type { ApiResponse, ApiError };
