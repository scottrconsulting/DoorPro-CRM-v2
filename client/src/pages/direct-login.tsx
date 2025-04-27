import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useDirectAuth } from "@/hooks/use-direct-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function DirectLogin() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading, login, error: authError } = useDirectAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Use useEffect for redirection to avoid React warnings
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setLoginError(null);
    
    try {
      await login({
        username: values.username,
        password: values.password,
      });
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      setLoginError(error.message || "Authentication failed. Please check your credentials and try again.");
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
              Token-Based Login
            </CardTitle>
            <CardDescription className="text-center">
              This login uses a token-based system for more reliable access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(loginError || authError) && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{loginError || authError}</AlertDescription>
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
                  disabled={isSubmitting || isLoading}
                >
                  {isSubmitting || isLoading ? (
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
              <h4 className="text-sm font-semibold text-blue-700">About this login method</h4>
              <p className="text-xs text-blue-600 mt-1">
                This page uses a token-based authentication system that bypasses cookies entirely. 
                Use this login method if you experience issues with the standard login page 
                when accessing from external browsers.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between flex-col space-y-2">
            <Link to="/login" className="text-sm text-primary hover:underline">
              Return to standard login
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