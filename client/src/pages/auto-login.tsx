import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const AUTO_LOGIN_KEY = "auto_login_attempted";
const LOCAL_STORAGE_KEY = "auth_bypass_token";

export default function AutoLogin() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // Generate a random token for this device
  const getOrCreateToken = () => {
    let token = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!token) {
      token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(LOCAL_STORAGE_KEY, token);
    }
    return token;
  };

  useEffect(() => {
    const hasAttempted = sessionStorage.getItem(AUTO_LOGIN_KEY);
    
    // If we've already tried auto-login in this session, don't try again
    if (hasAttempted) {
      setIsLoading(false);
      setError("Auto-login already attempted. Please use manual login.");
      return;
    }

    const attemptLogin = async () => {
      try {
        // Mark that we've attempted auto-login
        sessionStorage.setItem(AUTO_LOGIN_KEY, "true");
        
        // Try with the admin credentials directly
        try {
          await login({ username: "admin", password: "password" });
          toast({
            title: "Welcome back!",
            description: "You've been automatically logged in as admin.",
          });
          setLocation("/");
        } catch (error: any) {
          console.error("Auto-login failed:", error);
          setError("Auto-login failed. Please use the login form below.");
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Auto-login error:", err);
        setError("Something went wrong during auto-login. Please try logging in manually.");
        setIsLoading(false);
      }
    };

    attemptLogin();
  }, [login, setLocation, toast]);

  const handleManualLogin = () => {
    setLocation("/login");
  };

  const handleRetryLogin = () => {
    // Clear the auto-login attempt flag
    sessionStorage.removeItem(AUTO_LOGIN_KEY);
    // Reload the page to trigger auto-login again
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md p-8 shadow-md">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/doorpro-logo-large.svg" 
                alt="DoorPro CRM" 
                className="h-20 w-auto" 
              />
            </div>
            <h2 className="text-2xl font-bold mb-4">Logging you in...</h2>
            <p className="text-gray-500 mb-6">Please wait while we authenticate your session.</p>
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md p-8 shadow-md">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/doorpro-logo-large.svg" 
                alt="DoorPro CRM" 
                className="h-20 w-auto" 
              />
            </div>
            <h2 className="text-2xl font-bold mb-4">Login Issue</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleManualLogin}>Go to Login Page</Button>
              <Button variant="outline" onClick={handleRetryLogin}>
                Retry Auto-Login
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}