import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [location, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Get token from URL query parameter
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Validate token on page load
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setIsValidatingToken(false);
        setIsTokenValid(false);
        setErrorMessage("Missing reset token. Please request a new password reset link.");
        return;
      }

      try {
        const res = await apiRequest("GET", `/api/auth/verify-reset-token?token=${token}`);
        const data = await res.json();

        if (res.ok) {
          setIsTokenValid(true);
          if (data.email) {
            setEmail(data.email);
          }
        } else {
          setErrorMessage(data.message || "Invalid or expired token. Please request a new password reset link.");
        }
      } catch (error) {
        setErrorMessage("An error occurred while validating your token. Please try again.");
        console.error("Token validation error:", error);
      } finally {
        setIsValidatingToken(false);
      }
    }

    validateToken();
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!token) {
      setErrorMessage("Missing reset token. Please request a new password reset link.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
      });
      
      const result = await res.json();
      
      if (res.ok) {
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      } else {
        setErrorMessage(result.message || "An error occurred while resetting your password. Please try again.");
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred. Please try again.");
      console.error("Reset password error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">DoorPro CRM</h1>
          <p className="text-neutral-600">Reset Your Password</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>
              {isTokenValid && email 
                ? `Create a new password for ${email}` 
                : "Reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidatingToken ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
                <p className="text-neutral-600">Verifying your reset link...</p>
              </div>
            ) : isSuccess ? (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Password Reset Successfully</AlertTitle>
                <AlertDescription className="text-green-700">
                  Your password has been reset successfully. You will be redirected to the login page in a moment.
                </AlertDescription>
              </Alert>
            ) : !isTokenValid ? (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Invalid Reset Link</AlertTitle>
                <AlertDescription>
                  {errorMessage || "Your password reset link is invalid or has expired. Please request a new one."}
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {errorMessage && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input 
                    id="password"
                    type="password"
                    placeholder="Enter your new password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input 
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter>
            <p className="text-center w-full text-sm">
              <Link href="/login" className="text-primary hover:underline">
                Back to Login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}