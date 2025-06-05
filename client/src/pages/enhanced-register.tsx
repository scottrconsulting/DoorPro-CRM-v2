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
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

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
  subscriptionTier: z.enum(["free", "pro"]).default("free"),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the Terms of Service and Privacy Policy"
  })
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors }, watch, trigger, setValue } = useForm<RegisterFormValues>({
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
      
      if (!data.available) {
        toast({
          title: "Username Unavailable",
          description: `"${username}" is already taken. Please try a different username.`,
          variant: "destructive",
        });
      }
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
      
      if (!data.available) {
        toast({
          title: "Email Already Registered",
          description: `An account with "${email}" already exists. Please sign in or use a different email.`,
          variant: "destructive",
          action: (
            <button 
              onClick={() => setLocation('/login')}
              className="text-sm underline hover:no-underline"
            >
              Sign In
            </button>
          ),
        });
      }
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
        setErrorMessage(null);
        setLocation('/login'); // Redirect to login on successful registration
      }
    },
    onError: (error: any) => {
      // Handle specific duplicate registration errors
      const errorMessage = error?.message || 'Registration failed. Please try again.';
      
      if (errorMessage.includes('Username already exists') || errorMessage.includes('username already taken')) {
        setErrorMessage("This username is already taken. Please choose a different username.");
        setUsernameAvailable(false);
        setStep(1); // Go back to step 1 to fix the username
      } else if (errorMessage.includes('Email already registered') || errorMessage.includes('email already exists')) {
        setErrorMessage("This email address is already registered. Please use a different email or sign in to your existing account.");
        setEmailAvailable(false);
        setStep(1); // Go back to step 1 to fix the email
      } else {
        setErrorMessage(errorMessage);
      }
    },
  });

  const validateStep = async (stepNumber: number): Promise<boolean> => {
    switch (stepNumber) {
      case 1:
        // Check if required fields are filled and available
        const step1Fields = await trigger(["username", "fullName", "email"]);
        const hasValidUsername = watchedValues.username.length >= 3 && usernameAvailable === true;
        const hasValidEmail = watchedValues.email.includes('@') && emailAvailable === true;
        const hasValidFullName = watchedValues.fullName.length >= 2;
        
        console.log('Step 1 validation:', {
          step1Fields,
          hasValidUsername,
          hasValidEmail,
          hasValidFullName,
          usernameAvailable,
          emailAvailable
        });
        
        return step1Fields && hasValidUsername && hasValidEmail && hasValidFullName;
      case 2:
        return await trigger(["password", "confirmPassword"]);
      case 3:
        return await trigger(["subscriptionTier"]);
      case 4:
        return await trigger(["agreeToTerms"]);
      default:
        return true;
    }
  };

  const handleNext = async () => {
    console.log('handleNext called for step:', step);
    
    // Clear any previous error messages
    setErrorMessage(null);
    
    const isValid = await validateStep(step);
    console.log('Step validation result:', isValid);
    
    if (isValid && step < 4) {
      setStep(step + 1);
      console.log('Advanced to step:', step + 1);
    } else if (!isValid) {
      console.log('Validation failed for step:', step);
      if (step === 1) {
        if (usernameAvailable === false) {
          setErrorMessage("Please choose a different username - this one is already taken.");
        } else if (emailAvailable === false) {
          setErrorMessage("Please use a different email address - this one is already registered.");
        } else {
          setErrorMessage("Please fill out all required fields correctly.");
        }
      }
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setErrorMessage(null);

    // If not on final step, just advance to next step
    if (step < 4) {
      const isValid = await validateStep(step);
      if (isValid) {
        setStep(step + 1);
      } else {
        // Show specific error messages for step 1
        if (step === 1) {
          if (usernameAvailable === false) {
            setErrorMessage("Username is already taken. Please choose a different one.");
            return;
          }
          if (emailAvailable === false) {
            setErrorMessage("Email is already registered. Please use a different email or try logging in.");
            return;
          }
        }
      }
      return;
    }

    // Final step - validate all fields before submission
    const isFormValid = await trigger();
    if (!isFormValid) {
      setErrorMessage("Please correct the errors above before proceeding.");
      return;
    }

    // Final step - submit the form
    const { confirmPassword, agreeToTerms, ...userData } = data;

    // Ensure terms are agreed to
    if (!agreeToTerms) {
      setErrorMessage("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    // Only allow admin privileges for the master account email (removed for normal registration)
    registerMutation.mutate(userData);
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
          <div className="space-y-2">
            <p className="text-sm text-red-500">This username is already taken.</p>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <p className="text-xs text-orange-700">
                <strong>Suggestions:</strong> Try adding numbers, underscores, or variations like "{watchedValues.username}123", "{watchedValues.username}_pro", or "{watchedValues.username}2024".
              </p>
            </div>
          </div>
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
          <div className="space-y-2">
            <p className="text-sm text-red-500">This email address is already registered.</p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800 font-medium">Already have an account?</p>
              <p className="text-xs text-blue-600 mt-1">
                If this email belongs to you, <Link href="/login" className="font-medium underline hover:no-underline">sign in here</Link> instead.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Forgot your password? <Link href="/forgot-password" className="font-medium underline hover:no-underline">Reset it here</Link>.
              </p>
            </div>
          </div>
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
          onValueChange={(value) => setValue("subscriptionTier", value as "free" | "pro", { shouldValidate: true })}
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
    </div>
  );

  // Step 4: Terms and Final Confirmation
  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Review and Confirm</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-6">
          <div className="flex justify-between">
            <span>Username:</span>
            <span className="font-medium">{watchedValues.username}</span>
          </div>
          <div className="flex justify-between">
            <span>Email:</span>
            <span className="font-medium">{watchedValues.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Plan:</span>
            <span className="font-medium capitalize">
              {watchedValues.subscriptionTier === "free" ? "Free Tier" : "Pro Tier"} 
              {watchedValues.subscriptionTier === "pro" ? " - $29/month" : " - $0/month"}
            </span>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium mb-2">Terms of Service Summary</h4>
          <p className="text-sm text-gray-600 mb-2">
            By creating an account, you agree to our terms and conditions, including:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Responsible use of our platform and services</li>
            <li>• Data privacy and protection policies</li>
            <li>• Subscription and billing terms (if applicable)</li>
            <li>• Content and conduct guidelines</li>
          </ul>
        </div>
      </div>

      <div className="flex items-start space-x-3">
        <Checkbox 
          id="agreeToTerms"
          {...register("agreeToTerms")}
          checked={watchedValues.agreeToTerms}
          onCheckedChange={(checked) => {
            setValue("agreeToTerms", checked as boolean, { shouldValidate: true });
          }}
        />
        <Label htmlFor="agreeToTerms" className="text-sm leading-relaxed cursor-pointer">
          I agree to the{" "}
          <a href="#" className="text-blue-600 hover:underline font-medium">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-blue-600 hover:underline font-medium">Privacy Policy</a>
        </Label>
      </div>

      {errors.agreeToTerms && (
        <p className="text-sm text-red-500 mt-2">{errors.agreeToTerms.message}</p>
      )}
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
              {errorMessage && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {errorMessage}
                  </AlertDescription>
                </Alert>
              )}
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

              {/* Show validation errors for step 1 */}
              {step === 1 && (usernameAvailable === false || emailAvailable === false) && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">Registration Issue Detected</p>
                      {usernameAvailable === false && (
                        <p>• Username "{watchedValues.username}" is already taken</p>
                      )}
                      {emailAvailable === false && (
                        <p>• Email "{watchedValues.email}" is already registered</p>
                      )}
                      <p className="text-sm mt-2">Please resolve these issues above to continue with your registration.</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-4">
                {step > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep(step - 1)}
                  >
                    Previous
                  </Button>
                )}
                <Button 
                  type={step === 4 ? "submit" : "button"}
                  onClick={step < 4 ? handleNext : undefined}
                  disabled={
                    registerMutation.isPending || 
                    (step === 1 && (usernameAvailable === false || emailAvailable === false || isCheckingUsername || isCheckingEmail)) ||
                    (step === 4 && !watchedValues.agreeToTerms)
                  }
                  className={step === 1 ? "ml-auto" : ""}
                >
                  {registerMutation.isPending ? (
                    "Creating Account..."
                  ) : step === 4 ? (
                    "Create Account"
                  ) : (
                    "Next"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter>
            <p className="text-center w-full text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}