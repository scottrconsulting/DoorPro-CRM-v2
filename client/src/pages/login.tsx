import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDirectAuth } from "@/hooks/use-direct-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated: isAuthAuthenticated, isLoading: isAuthLoading, login: authLogin } = useAuth();
  const { isAuthenticated: isDirectAuthenticated, isLoading: isDirectLoading, login: directLogin } = useDirectAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirectLoginEnabled, setIsDirectLoginEnabled] = useState(true);

  // Use useEffect for redirection to avoid React warnings
  useEffect(() => {
    if ((isAuthAuthenticated && !isAuthLoading) || (isDirectAuthenticated && !isDirectLoading)) {
      navigate("/");
    }
  }, [isAuthAuthenticated, isAuthLoading, isDirectAuthenticated, isDirectLoading, navigate]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setLoginError(null);
    
    try {
      // Try the direct auth first for more reliable cross-browser login
      if (isDirectLoginEnabled) {
        try {
          await directLogin({
            username: values.username,
            password: values.password,
          });
          navigate("/");
          return;
        } catch (error) {
          console.error("Direct login failed, falling back to standard login:", error);
          // Disable direct login for this session if it failed
          setIsDirectLoginEnabled(false);
        }
      }
      
      // Fallback to standard login
      await authLogin({
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
              DoorPro CRM
            </CardTitle>
            <CardDescription className="text-center">
              Log in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loginError && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{loginError}</AlertDescription>
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
                
                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <Label htmlFor="rememberMe" className="text-sm cursor-pointer">
                          Remember me
                        </Label>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting || isAuthLoading || isDirectLoading}
                >
                  {isSubmitting || isAuthLoading || isDirectLoading ? (
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
          </CardContent>
          <CardFooter className="flex justify-between flex-col space-y-2">
            <div className="flex justify-between w-full">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
              <Link to="/direct-login" className="text-sm text-primary hover:underline">
                Use token login
              </Link>
            </div>
            <div className="text-sm text-gray-500 text-center mt-2">
              Don't have an account?{" "}
              <Link to="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded mt-2 text-center">
              Having login issues? Try our <Link to="/direct-login" className="font-semibold underline">token-based login</Link> for more reliable access
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