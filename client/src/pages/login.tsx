import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Force hard browser redirect to ensure it works on deployed version
    // Check if we're on the deployed version or localhost
    const currentUrl = window.location.href;
    if (currentUrl.includes('door-pro-crm.replit.app')) {
      // For the deployed app
      window.location.href = 'https://door-pro-crm.replit.app/direct-login';
    } else {
      // For local development
      navigate("/direct-login");
    }
  }, [navigate]);

  return (
    <div className="h-screen grid place-items-center bg-gray-50">
      <div className="text-center">
        <p>Redirecting to the improved login page...</p>
        <p className="text-sm text-gray-500 mt-2">If you're not redirected automatically, 
           <a href="/direct-login" className="text-primary ml-1">click here</a>
        </p>
      </div>
    </div>
  );
}