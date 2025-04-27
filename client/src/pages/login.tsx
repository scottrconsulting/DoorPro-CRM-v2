import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ExternalLink } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoginPending, loginError } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [location, setLocation] = useLocation();
  const [isCrossOriginIssue, setIsCrossOriginIssue] = useState(false);
  
  // Check if we're in an external browser tab vs. the Replit preview
  useEffect(() => {
    // If we're running in a new tab or external window
    const isExternalTab = window.location.host.includes('replit.app');
    const previewHost = window.location.host.includes('picard.replit.dev');
    setIsCrossOriginIssue(isExternalTab && !previewHost);
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    setErrorMessage(null);
    login(data);
  };

  // Extract error message from loginError
  const extractErrorMessage = (error: any) => {
    if (!error) return null;
    
    if (typeof error === 'string') return error;
    
    if (error.message) {
      return error.message;
    }
    
    if (error.data && error.data.message) {
      return error.data.message;
    }
    
    return "An error occurred during login. Please try again.";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">DoorPro CRM</h1>
          <p className="text-neutral-600">Log in to your account</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Log In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {(errorMessage || loginError) && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {errorMessage || extractErrorMessage(loginError)}
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username"
                  placeholder="Enter your username"
                  {...register("username")}
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input 
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoginPending}
              >
                {isLoginPending ? "Logging in..." : "Log In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <p className="text-center w-full text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </Card>
        
        {isCrossOriginIssue && (
          <div className="mt-4">
            <Alert className="bg-amber-50 border-amber-300">
              <AlertDescription className="text-amber-800">
                <div className="flex flex-col space-y-2">
                  <p className="font-medium">Having trouble logging in?</p>
                  <p>Use the button below to open the app in a preview window:</p>
                  
                  <Button 
                    variant="outline" 
                    className="border-amber-400 text-amber-700 hover:bg-amber-100 flex items-center gap-2"
                    onClick={() => {
                      // Open a special preview window
                      window.open('https://replit.com/@ScottRConsult/door-pro-crm?v=1', '_blank');
                    }}
                  >
                    <ExternalLink size={16} /> Open in Preview Mode
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500">
            By logging in, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>{" "}
            and{" "}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
