import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// A very simple protected route component that directly checks for token
export default function SimpleProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Get the token from localStorage
        const token = localStorage.getItem('doorpro_auth_token');
        
        if (!token) {
          // No token found, redirect to login
          window.location.href = "/login";
          return;
        }
        
        // Verify the token with the server
        const response = await apiRequest("POST", "/api/direct-auth/verify-token", { token });
        const data = await response.json();
        
        if (data.valid) {
          setIsAuthenticated(true);
        } else {
          // Token is invalid, redirect to login
          window.location.href = "/login";
        }
      } catch (error) {
        console.error("Token verification error:", error);
        // On error, redirect to login
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyToken();
  }, []);
  
  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Only render children if authenticated
  if (!isAuthenticated) {
    return null;
  }
  
  return <>{children}</>;
}