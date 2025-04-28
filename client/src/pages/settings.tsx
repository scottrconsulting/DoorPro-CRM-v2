import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { UserRole, getPlanName } from "@/lib/auth";
import { Link } from "wouter";
import { Customization } from "@shared/schema";
import { 
  STATISTICS_METRICS, 
  STATISTICS_METRIC_LABELS 
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Profile schema
const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
});

// Password schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Preferences schema
const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  defaultMapType: z.enum(["roadmap", "satellite"]),
  notificationEmail: z.boolean(),
  notificationPush: z.boolean(),
  defaultScheduleView: z.enum(["day", "week", "month"]),
  autoCheckIn: z.boolean(),
  statisticsMetrics: z.array(z.string()).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export default function Settings() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Fetch customization settings
  const { data: customization } = useQuery<Customization>({
    queryKey: ["/api/customizations/current"],
    enabled: !!user
  });

  // Set mounted state to avoid hydration issues with theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Preferences form
  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      theme: mounted ? (theme as "light" | "dark" | "system") : "light",
      defaultMapType: customization?.mapDefaultView || "roadmap",
      notificationEmail: true,
      notificationPush: true,
      defaultScheduleView: "week",
      autoCheckIn: false,
      statisticsMetrics: customization?.statisticsMetrics || ["today_visits", "conversions", "follow_ups", "sales_count"],
    },
  });
  
  // Update the form when theme changes
  useEffect(() => {
    if (mounted) {
      preferencesForm.setValue("theme", theme as "light" | "dark" | "system");
    }
  }, [theme, mounted, preferencesForm]);

  const onProfileSubmit = (data: ProfileFormValues) => {
    setIsUpdating(true);
    // In a real app, this would call a mutation to update the user profile
    setTimeout(() => {
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
      setIsUpdating(false);
    }, 1000);
  };

  const onPasswordSubmit = (data: PasswordFormValues) => {
    setIsUpdating(true);
    // In a real app, this would call a mutation to update the password
    setTimeout(() => {
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
      setIsUpdating(false);
    }, 1000);
  };

  // Customization mutation
  const updateCustomizationMutation = useMutation({
    mutationFn: async (data: Partial<Customization>) => {
      const response = await apiRequest('PUT', '/api/customizations/current', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customizations/current'] });
    }
  });

  const onPreferencesSubmit = (data: PreferencesFormValues) => {
    setIsUpdating(true);
    
    // Update theme if it's changed
    if (data.theme !== theme) {
      setTheme(data.theme);
    }
    
    // Update customization in the database
    updateCustomizationMutation.mutate({
      mapDefaultView: data.defaultMapType,
      statisticsMetrics: data.statisticsMetrics || []
    }, {
      onSuccess: () => {
        toast({
          title: "Preferences saved",
          description: "Your preferences have been updated successfully.",
        });
        setIsUpdating(false);
      },
      onError: (error) => {
        toast({
          title: "Error saving preferences",
          description: error.message,
          variant: "destructive"
        });
        setIsUpdating(false);
      }
    });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-sans text-neutral-800">Account Settings</h1>
        <Button variant="outline" onClick={logout}>
          <span className="material-icons text-sm mr-1">logout</span>
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="h-16 w-16 bg-primary text-white rounded-full flex items-center justify-center">
                      <span className="material-icons text-2xl">person</span>
                    </div>
                    <div>
                      <h3 className="font-medium">{user?.fullName}</h3>
                      <p className="text-sm text-neutral-500">{user?.username}</p>
                      <div className="text-xs bg-neutral-200 px-1.5 py-0.5 rounded-md text-neutral-700 inline-block mt-1">
                        {getPlanName(user?.role)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john.doe@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter your current password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter your new password" {...field} />
                        </FormControl>
                        <FormDescription>
                          Password must be at least 6 characters long
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm your new password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Updating..." : "Update Password"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>App Preferences</CardTitle>
              <CardDescription>
                Customize how the application works for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...preferencesForm}>
                <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Appearance</h3>
                    
                    <FormField
                      control={preferencesForm.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Theme</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              setTheme(value);
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select theme" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose your preferred theme for the application
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Dashboard</h3>
                    
                    <FormField
                      control={preferencesForm.control}
                      name="statisticsMetrics"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statistics Metrics</FormLabel>
                          <FormDescription>
                            Select the metrics you want to display on your dashboard
                          </FormDescription>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                            {STATISTICS_METRICS.map((metric) => (
                              <FormItem
                                key={metric}
                                className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(metric)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      if (checked) {
                                        field.onChange([...currentValue, metric]);
                                      } else {
                                        field.onChange(
                                          currentValue.filter((value) => value !== metric)
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {STATISTICS_METRIC_LABELS[metric] || metric}
                                </FormLabel>
                              </FormItem>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Map Preferences</h3>
                    
                    <FormField
                      control={preferencesForm.control}
                      name="defaultMapType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Default Map View</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="roadmap" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Standard (Road Map)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="satellite" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Satellite
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Notifications</h3>
                    
                    <FormField
                      control={preferencesForm.control}
                      name="notificationEmail"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Email Notifications
                            </FormLabel>
                            <FormDescription>
                              Receive email notifications for important updates
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={preferencesForm.control}
                      name="notificationPush"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Push Notifications
                            </FormLabel>
                            <FormDescription>
                              Receive push notifications on your device
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Schedule Settings</h3>
                    
                    <FormField
                      control={preferencesForm.control}
                      name="defaultScheduleView"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Calendar View</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select view" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="week">Week</SelectItem>
                              <SelectItem value="month">Month</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={preferencesForm.control}
                      name="autoCheckIn"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Automatic Check-in
                            </FormLabel>
                            <FormDescription>
                              Automatically check in when arriving at a location
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Preferences"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans</CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium">Current Plan</h3>
                      <p className="text-sm text-neutral-500">Your active subscription details</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {getPlanName(user?.role)} Plan
                      </div>
                      <p className="text-sm text-neutral-500">
                        {user?.role === UserRole.PRO ? "$29/month" : "Free"}
                      </p>
                    </div>
                  </div>
                  
                  {user?.role === UserRole.FREE && (
                    <Link href="/upgrade">
                      <Button className="w-full">Upgrade to Pro</Button>
                    </Link>
                  )}
                  
                  {user?.role === UserRole.PRO && (
                    <>
                      <div className="flex items-center justify-between text-sm py-2 border-t border-neutral-200 mt-4">
                        <span>Next billing date</span>
                        <span className="font-medium">November 15, 2023</span>
                      </div>
                      <div className="flex items-center justify-between text-sm py-2 border-t border-neutral-200">
                        <span>Payment method</span>
                        <span className="font-medium">Visa ending in 4242</span>
                      </div>
                      <div className="mt-4 flex justify-end space-x-2">
                        <Button variant="outline" size="sm">Update Payment</Button>
                        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                          Cancel Subscription
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Billing History</h3>
                  
                  {user?.role === UserRole.FREE ? (
                    <p className="text-neutral-500 py-4 text-center">
                      No billing history available on the Free plan
                    </p>
                  ) : (
                    <div className="border rounded-md">
                      <div className="grid grid-cols-4 bg-neutral-50 p-3 text-sm font-medium border-b">
                        <div>Date</div>
                        <div>Description</div>
                        <div>Amount</div>
                        <div className="text-right">Receipt</div>
                      </div>
                      <div className="grid grid-cols-4 p-3 text-sm border-b">
                        <div>Oct 15, 2023</div>
                        <div>Monthly subscription</div>
                        <div>$29.00</div>
                        <div className="text-right">
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 p-3 text-sm border-b">
                        <div>Sep 15, 2023</div>
                        <div>Monthly subscription</div>
                        <div>$29.00</div>
                        <div className="text-right">
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t flex justify-between">
              <p className="text-sm text-neutral-500">
                Questions about billing? Contact <a href="mailto:support@doorprocrm.com" className="text-primary hover:underline">support@doorprocrm.com</a>
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
