import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: { isFormData?: boolean }
): Promise<Response> {
  // Always use the current browser domain for API requests
  let fullUrl = url;
  if (url.startsWith('/') && typeof window !== 'undefined') {
    // On mobile browsers, we may need to use a specific domain
    // This helps avoid gateway errors on some mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hasGatewayError = window.localStorage.getItem('hadGatewayError') === 'true';

    if (isMobile && hasGatewayError) {
      // Use the Replit preview URL directly
      fullUrl = `https://door-pro-crm.scottrconsult.repl.co${url}`;
    } else {
      // IMPORTANT: This ensures we always use the same domain as the browser window
      fullUrl = `${window.location.origin}${url}`;
    }
  }

  try {
    // Get auth token if it exists
    const token = localStorage.getItem('doorpro_auth_token');

    // Create headers with authorization if we have a token
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    // Add content-type for requests with data, but not for FormData
    if (data && !options?.isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth token if it exists - always send it for all API requests
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      // Log token presence for debugging
      console.log(`Using auth token for ${url}`);
    } else {
      console.warn(`No auth token found for ${url}`);
    }

    // Handle body differently for FormData vs JSON
    let body: any = undefined;
    if (data) {
      body = options?.isFormData ? data : JSON.stringify(data);
    }

    const res = await fetch(fullUrl, {
      method,
      headers,
      body,
      credentials: "include", // This ensures cookies are sent with the request
      mode: 'cors', // Enable CORS for cross-domain requests
    });

    await throwIfResNotOk(res);

    // Return the original response without trying to read its body
    // This allows the caller to decide how to handle the response (as json, text, etc)
    return res;
  } catch (error) {
    console.error(`API Request error (${method} ${url}):`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>({ on401: unauthorizedBehavior }: { on401: UnauthorizedBehavior }): QueryFunction<T> => {
  return async ({ queryKey }) => {
    // Always use the current browser domain for API requests
    let url = queryKey[0] as string;

    // On mobile browsers, we may need to use a specific domain
    // This helps avoid gateway errors on some mobile devices
    if (url.startsWith('/') && typeof window !== 'undefined') {
      // Force use of the Replit preview domain if we're on mobile and experiencing issues
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const hasGatewayError = window.localStorage.getItem('hadGatewayError') === 'true';

      if (isMobile && hasGatewayError) {
        // Use the Replit preview URL directly
        url = `https://door-pro-crm.scottrconsult.repl.co${url}`;
      } else {
        // Use the current page domain
        url = `${window.location.origin}${url}`;
      }
    }

    try {
      console.log(`Fetching from: ${url}`);

      // Get auth token if it exists
      const token = localStorage.getItem('doorpro_auth_token');

      // Create headers
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      // Add auth token if it exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log(`Using auth token for query: ${url}`);
      } else {
        console.warn(`No auth token found for query: ${url}`);
      }

      const res = await fetch(url, {
        credentials: "include", // Essential for sending cookies
        mode: 'cors',  // Use CORS for cross-domain requests
        headers
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null as any;
      }

      await throwIfResNotOk(res);
      try {
        // First try to parse as JSON
        const text = await res.text();
        if (!text || text.trim() === '') {
          // Handle empty responses
          return [];
        }
        return JSON.parse(text);
      } catch (parseError) {
        console.error(`Error parsing JSON response from ${url}:`, parseError);
        // Return an empty array for collection endpoints or null for single entity endpoints
        return url.includes('/api/contacts') || url.includes('/api/visits') || url.includes('/api/schedules') ? [] : null;
      }
    } catch (error) {
      console.error(`Query error for ${url}:`, error);
      throw error;
    }
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});