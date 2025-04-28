import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DirectLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // First, clear any existing token
      localStorage.removeItem('doorpro_auth_token');
      
      // Make login request
      const response = await apiRequest("POST", "/api/direct-auth/direct-login", {
        username,
        password
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        // Store token
        localStorage.setItem('doorpro_auth_token', data.token);
        
        setSuccess(`Login successful! Redirecting to dashboard...`);
        
        // Redirect after a short delay to show the success message
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError("Authentication failed. Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md p-4">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <img 
                src="/images/doorpro-logo-large.png" 
                alt="DoorPro CRM" 
                className="h-20 w-auto" 
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-primary">
              DoorPro CRM
            </CardTitle>
            <CardDescription className="text-center">
              Log in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="mb-4 bg-green-50 border-green-500 text-green-700">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <Input 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <Input 
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Log in
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 bg-blue-50 p-3 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-700">Cross-Platform Access</h4>
              <p className="text-xs text-blue-600 mt-1">
                This secure login works across all devices including mobile apps, web browsers, 
                and desktop applications - ensuring consistent access no matter how you connect.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between flex-col space-y-2">
            <div className="text-sm text-primary hover:underline">
              Need an account? Contact your administrator
            </div>
            <div className="text-xs text-gray-400 text-center mt-4">
              Demo credentials: admin / password
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}