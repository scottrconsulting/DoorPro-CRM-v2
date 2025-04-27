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
): Promise<Response> {
  // Always use the current browser domain for API requests
  let fullUrl = url;
  if (url.startsWith('/') && typeof window !== 'undefined') {
    // IMPORTANT: This ensures we always use the same domain as the browser window
    // rather than any domain that might be embedded in relative URLs
    fullUrl = `${window.location.origin}${url}`;
  }
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: data 
        ? { 
            "Content-Type": "application/json",
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          } 
        : {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
      body: data ? JSON.stringify(data) : undefined,
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
    if (url.startsWith('/') && typeof window !== 'undefined') {
      // IMPORTANT: This ensures we always use the current page domain for API requests
      url = `${window.location.origin}${url}`;
    }
    
    try {
      console.log(`Fetching from: ${url}`);
      const res = await fetch(url, {
        credentials: "include", // Essential for sending cookies
        mode: 'cors',  // Use CORS for cross-domain requests
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
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
