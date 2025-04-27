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
  // Handle relative URLs by prepending the origin
  let fullUrl = url;
  if (url.startsWith('/') && typeof window !== 'undefined') {
    fullUrl = `${window.location.origin}${url}`;
  }
  
  try {
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
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
    // Convert key to URL, handling relative paths by prepending with window.location.origin
    let url = queryKey[0] as string;
    if (url.startsWith('/') && typeof window !== 'undefined') {
      url = `${window.location.origin}${url}`;
    }
    
    try {
      console.log(`Fetching from: ${url}`);
      const res = await fetch(url, {
        credentials: "include",
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
