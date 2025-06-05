import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

export default function EmailVerification() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Extract token from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      verifyEmailMutation.mutate(tokenParam);
    }
  }, []);

  // Email verification mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (verificationToken: string) => {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Email verification failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setVerificationStatus('success');
      } else {
        setVerificationStatus('error');
        setErrorMessage(data.message || 'Email verification failed');
      }
    },
    onError: (error: Error) => {
      setVerificationStatus('error');
      setErrorMessage(error.message || 'Email verification failed');
    },
  });

  // Resend verification email mutation
  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to resend verification email');
      }
      
      return response.json();
    },
  });

  const renderContent = () => {
    if (!token) {
      return (
        <div className="text-center space-y-4">
          <Mail className="w-16 h-16 text-blue-500 mx-auto" />
          <h3 className="text-xl font-semibold">Check Your Email</h3>
          <p className="text-gray-600">
            We've sent a verification link to your email address. Please click the link to verify your account.
          </p>
          <p className="text-sm text-gray-500">
            Didn't receive the email? Check your spam folder or contact support.
          </p>
        </div>
      );
    }

    if (verificationStatus === 'pending' || verifyEmailMutation.isPending) {
      return (
        <div className="text-center space-y-4">
          <RefreshCw className="w-16 h-16 text-blue-500 mx-auto animate-spin" />
          <h3 className="text-xl font-semibold">Verifying Your Email...</h3>
          <p className="text-gray-600">
            Please wait while we verify your email address.
          </p>
        </div>
      );
    }

    if (verificationStatus === 'success') {
      return (
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h3 className="text-xl font-semibold text-green-700">Email Verified Successfully!</h3>
          <p className="text-gray-600">
            Your account has been activated. You can now log in and start using DoorPro CRM.
          </p>
          <Button 
            onClick={() => setLocation('/login')}
            className="w-full"
          >
            Continue to Login
          </Button>
        </div>
      );
    }

    if (verificationStatus === 'error') {
      return (
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h3 className="text-xl font-semibold text-red-700">Verification Failed</h3>
          <Alert variant="destructive">
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Button 
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Try Again
            </Button>
            <Button 
              variant="ghost"
              onClick={() => setLocation('/register')}
              className="w-full"
            >
              Back to Registration
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">DoorPro CRM</h1>
          <p className="text-gray-600">Email Verification</p>
        </div>
        
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Verify Your Email</CardTitle>
            <CardDescription>
              Complete your account setup by verifying your email address
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Need help? {" "}
            <Link href="/support" className="text-blue-600 hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}