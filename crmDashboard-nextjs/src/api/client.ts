/**
 * API Client
 * Base configuration for API requests
 */

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  error?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private headers: Record<string, string>;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout || 60000; // Increased to 60 seconds for LLM queries
    this.headers = config.headers || {
      "Content-Type": "application/json",
    };
  }

  /**
   * Set authorization token
   */
  setAuthToken(token: string) {
    this.headers["Authorization"] = `Bearer ${token}`;
  }

  /**
   * Remove authorization token
   */
  removeAuthToken() {
    delete this.headers["Authorization"];
  }

  /**
   * Make a request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to extract error message from response body
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            // Handle FastAPI validation errors
            if (Array.isArray(errorData.detail)) {
              const validationErrors = errorData.detail.map((err: any) => {
                const field = err.loc?.[err.loc.length - 1] || 'field';
                return `${field}: ${err.msg}`;
              }).join(', ');
              errorMessage = `Validation errors: ${validationErrors}`;
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            }
          }
        } catch {
          // If response body is not JSON, use default message
        }
        throw {
          message: errorMessage,
          status: response.status,
        } as ApiError;
      }

      const data = await response.json();
      // Wrap backend response in ApiResponse format for consistency
      return {
        data,
        success: true,
      } as ApiResponse<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === "AbortError") {
        throw {
          message: "Request timeout",
          code: "TIMEOUT",
        } as ApiError;
      }

      throw error as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.request<T>(endpoint + queryString, {
      method: "GET",
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }
}

// Create and export a default instance
// Use relative URLs to Next.js API routes (SSR) - backend URL is never exposed to client
export const apiClient = new ApiClient({
  baseURL: "/api", // All requests go through Next.js API routes which proxy to backend
});

// Helper for chatbot service that needs special endpoint
export const chatbotApiClient = new ApiClient({
  baseURL: "/api/chatbot", // Chatbot-specific API routes
});

export default apiClient;

