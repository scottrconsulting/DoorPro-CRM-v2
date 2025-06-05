import { useEffect, useState } from "react";

// A protected route component that checks session-based authentication
export default function SimpleProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      try {
        // Check session with the server using the new auth endpoint
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include', // Include cookies for session
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setIsAuthenticated(true);
          } else {
            // Not authenticated, redirect to login
            window.location.href = "/login";
          }
        } else {
          // Session invalid, redirect to login
          window.location.href = "/login";
        }
      } catch (error) {
        console.error("Session verification error:", error);
        // On error, redirect to login
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };
    
    verifySession();
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