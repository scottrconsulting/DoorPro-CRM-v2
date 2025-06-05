import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle, AlertCircle, Crown, Users, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  confirmPassword: z.string(),
  subscriptionTier: z.enum(["free", "pro"]),
  agreeToTerms: z.boolean().refine(val => val === true, "You must agree to the terms and conditions"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const subscriptionPlans = {
  free: {
    name: "Free Tier",
    price: "$0/month",
    icon: Zap,
    features: [
      "Up to 50 contacts",
      "1 territory",
      "10 schedules per month",
      "100 API requests per day",
      "Basic support"
    ],
    limits: "Perfect for getting started"
  },
  pro: {
    name: "Pro Tier",
    price: "$29/month",
    icon: Crown,
    features: [
      "Up to 1,000 contacts",
      "10 territories",
      "100 schedules per month",
      "1,000 API requests per day",
      "Priority support",
      "Data export",
      "Custom integrations"
    ],
    limits: "For growing businesses"
  }
};

export default function EnhancedRegister() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, trigger } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      subscriptionTier: "free",
      agreeToTerms: false,
    },
  });

  const watchedValues = watch();

  // Username availability check
  const checkUsername = async (username: string) => {
    if (username.length < 3) return;
    
    setIsCheckingUsername(true);
    try {
      const response = await fetch(`/api/auth/check-username/${encodeURIComponent(username)}`);
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (error) {
      console.error('Username check failed:', error);
      setUsernameAvailable(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Email availability check
  const checkEmail = async (email: string) => {
    if (!email.includes('@')) return;
    
    setIsCheckingEmail(true);
    try {
      const response = await fetch(`/api/auth/check-email/${encodeURIComponent(email)}`);
      const data = await response.json();
      setEmailAvailable(data.available);
    } catch (error) {
      console.error('Email check failed:', error);
      setEmailAvailable(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormValues) => {
      const { confirmPassword, agreeToTerms, ...registrationData } = data;
      const response = await fetch('/api/auth/register-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setStep(4); // Success step
      }
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  const nextStep = async () => {
    if (step === 1) {
      const isValid = await trigger(['username', 'fullName', 'email']);
      if (isValid && usernameAvailable && emailAvailable) {
        setStep(2);
      }
    } else if (step === 2) {
      const isValid = await trigger(['password', 'confirmPassword']);
      if (isValid) {
        setStep(3);
      }
    }
  };

  const previousStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const getStepProgress = () => {
    return ((step - 1) / 3) * 100;
  };

  // Step 1: Account Information
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <Input 
            id="username"
            placeholder="Choose a unique username"
            {...register("username")}
            onChange={(e) => {
              register("username").onChange(e);
              checkUsername(e.target.value);
            }}
          />
          {isCheckingUsername && (
            <div className="absolute right-3 top-3">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
          {usernameAvailable === true && (
            <CheckCircle className="absolute right-3 top-3 w-4 h-4 text-green-500" />
          )}
          {usernameAvailable === false && (
            <AlertCircle className="absolute right-3 top-3 w-4 h-4 text-red-500" />
          )}
        </div>
        {errors.username && (
          <p className="text-sm text-red-500">{errors.username.message}</p>
        )}
        {usernameAvailable === false && (
          <p className="text-sm text-red-500">Username is already taken</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input 
          id="fullName"
          placeholder="Enter your full name"
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-sm text-red-500">{errors.fullName.message}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email Address</Label>
        <div className="relative">
          <Input 
            id="email"
            type="email"
            placeholder="Enter your email address"
            {...register("email")}
            onChange={(e) => {
              register("email").onChange(e);
              checkEmail(e.target.value);
            }}
          />
          {isCheckingEmail && (
            <div className="absolute right-3 top-3">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          )}
          {emailAvailable === true && (
            <CheckCircle className="absolute right-3 top-3 w-4 h-4 text-green-500" />
          )}
          {emailAvailable === false && (
            <AlertCircle className="absolute right-3 top-3 w-4 h-4 text-red-500" />
          )}
        </div>
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
        {emailAvailable === false && (
          <p className="text-sm text-red-500">Email is already registered</p>
        )}
      </div>
    </div>
  );

  // Step 2: Password Setup
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password"
          type="password"
          placeholder="Create a strong password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
        <div className="text-xs text-gray-500">
          Password must contain at least 8 characters with uppercase, lowercase, and numbers
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input 
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>
    </div>
  );

  // Step 3: Subscription Plan Selection
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Choose Your Plan</h3>
        <RadioGroup 
          value={watchedValues.subscriptionTier} 
          onValueChange={(value) => register("subscriptionTier").onChange({ target: { value } })}
          className="space-y-4"
        >
          {Object.entries(subscriptionPlans).map(([key, plan]) => {
            const Icon = plan.icon;
            return (
              <div key={key} className={`border rounded-lg p-4 ${watchedValues.subscriptionTier === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value={key} id={key} />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-5 h-5" />
                      <Label htmlFor={key} className="font-semibold">{plan.name}</Label>
                      <span className="text-lg font-bold text-blue-600">{plan.price}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{plan.limits}</p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox 
          id="agreeToTerms"
          checked={watchedValues.agreeToTerms}
          onCheckedChange={(checked) => register("agreeToTerms").onChange({ target: { checked } })}
        />
        <Label htmlFor="agreeToTerms" className="text-sm">
          I agree to the{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
        </Label>
      </div>
      {errors.agreeToTerms && (
        <p className="text-sm text-red-500">{errors.agreeToTerms.message}</p>
      )}
    </div>
  );

  // Step 4: Success/Email Verification
  const renderStep4 = () => (
    <div className="text-center space-y-4">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
      <h3 className="text-xl font-semibold">Account Created Successfully!</h3>
      <p className="text-gray-600">
        We've sent a verification email to <strong>{watchedValues.email}</strong>
      </p>
      <p className="text-sm text-gray-500">
        Please check your email and click the verification link to activate your account.
      </p>
      <Button 
        onClick={() => setLocation('/login')}
        className="w-full"
      >
        Continue to Login
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">DoorPro CRM</h1>
          <p className="text-gray-600">Join thousands of sales professionals</p>
        </div>
        
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Step {step} of 4 - {step === 1 ? 'Account Information' : step === 2 ? 'Security' : step === 3 ? 'Choose Plan' : 'Verification'}
            </CardDescription>
            <Progress value={getStepProgress()} className="w-full" />
          </CardHeader>
          
          <CardContent>
            {registerMutation.error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  {(registerMutation.error as any)?.message || 'Registration failed. Please try again.'}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}

              {step < 4 && (
                <div className="flex space-x-3 mt-6">
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={previousStep} className="flex-1">
                      Previous
                    </Button>
                  )}
                  {step < 3 ? (
                    <Button 
                      type="button" 
                      onClick={nextStep} 
                      className="flex-1"
                      disabled={
                        (step === 1 && (!usernameAvailable || !emailAvailable)) ||
                        isCheckingUsername || 
                        isCheckingEmail
                      }
                    >
                      Next
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={registerMutation.isPending || !watchedValues.agreeToTerms}
                    >
                      {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                    </Button>
                  )}
                </div>
              )}
            </form>
          </CardContent>
          
          {step < 4 && (
            <CardFooter>
              <p className="text-center w-full text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}