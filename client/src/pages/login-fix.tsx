import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, LogIn } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginFix() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Try standard cookie-based authentication first
      console.log("Attempting standard login...");
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log("Standard login successful");
        setLoginSuccess(true);
        // Show success message briefly then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
        return;
      }
      
      // If standard login fails, try token-based authentication
      console.log("Standard login failed, trying token-based login...");
      const tokenResponse = await fetch('/api/direct-auth/direct-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values)
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenResponse.ok && tokenData.success && tokenData.token) {
        console.log("Token-based login successful");
        // Store token in localStorage
        localStorage.setItem('doorpro_auth_token', tokenData.token);
        setLoginSuccess(true);
        // Show success message briefly then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        // Both authentication methods failed
        console.log("All login methods failed");
        setError(data.message || "Authentication failed. Please check your credentials and try again.");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setError("Failed to connect to the server. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="h-screen grid place-items-center bg-gray-50">
      <div className="w-full max-w-md p-4">
        <Card className="shadow-lg">
          <CardHeader>
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
            
            {loginSuccess && (
              <Alert className="mb-4 bg-green-50 border border-green-200 text-green-800">
                <AlertTitle>Login Successful</AlertTitle>
                <AlertDescription>Redirecting to dashboard...</AlertDescription>
              </Alert>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
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
            </Form>

            <div className="mt-4 bg-blue-50 p-3 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-700">Cross-Platform Access</h4>
              <p className="text-xs text-blue-600 mt-1">
                This secure login works across all devices including mobile apps, web browsers, 
                and desktop applications - ensuring consistent access no matter how you connect.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between flex-col space-y-2">
            <Link to="/register" className="text-sm text-primary hover:underline">
              Need an account? Register here
            </Link>
            <div className="text-xs text-gray-400 text-center mt-4">
              Demo credentials: admin / password
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}