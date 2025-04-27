import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Customization, CONTACT_STATUSES, PIN_COLORS, DEFAULT_PIN_COLORS, QUICK_ACTIONS, DASHBOARD_WIDGETS, DASHBOARD_WIDGET_LABELS } from "@shared/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Check, Info, Lock, Plus, Settings, Trash2, UserPlus, X } from "lucide-react";

export default function Customize() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPro = user?.role === "pro" || user?.role === "admin";
useEffect(() => {
  // Force pro access for admin users
  if (user?.role === "admin") {
    queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
      ...old,
      user: { ...old.user, role: "admin" }
    }));
  }
}, [user]);
  
  // State for customization settings
  const [activeTab, setActiveTab] = useState("appearance");
  const [newStatus, setNewStatus] = useState("");
  const [newQuickAction, setNewQuickAction] = useState("");
  const [newAppointmentType, setNewAppointmentType] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState(30); // minutes
  const [theme, setTheme] = useState<string>("light");
  const [primaryColor, setPrimaryColor] = useState<string>("blue");
  
  // Dashboard widgets state
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>(DASHBOARD_WIDGETS);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DASHBOARD_WIDGETS);
  const [customWidgetLabels, setCustomWidgetLabels] = useState<Record<string, string>>({});
  const [editingWidgetLabel, setEditingWidgetLabel] = useState<string | null>(null);
  
  // Fetch user's customization settings
  const { data: customization, isLoading } = useQuery<Customization>({
    queryKey: ["/api/customizations/current"],
    queryFn: async ({ queryKey }) => {
      const response = await apiRequest("GET", queryKey[0] as string);
      if (!response.ok) {
        // Return default settings if not found
        return {
          id: 0,
          userId: user?.id,
          teamId: null,
          theme: "light",
          primaryColor: "blue",
          pinColors: DEFAULT_PIN_COLORS,
          quickActions: QUICK_ACTIONS,
          customStatuses: [],
          customFields: [],
          appointmentTypes: ["Sales Presentation", "Product Demo", "Follow-up Meeting", "Installation"],
          confirmationOptions: {
            sms: true,
            email: true,
            reminderTime: 30
          },
          noteTemplates: {},
          createdAt: new Date(),
          updatedAt: new Date()
        } as unknown as Customization;
      }
      return response.json();
    },
    enabled: !!user
  });
  
  // State to track UI editing
  const [editedPinColors, setEditedPinColors] = useState<Record<string, string>>({});
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  const [quickActions, setQuickActions] = useState<string[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<string[]>([]);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editingAppointmentType, setEditingAppointmentType] = useState<{index: number, value: string} | null>(null);
  
  // Set initial values when data is loaded
  useEffect(() => {
    if (customization) {
      setEditedPinColors(customization.pinColors || DEFAULT_PIN_COLORS);
      setCustomStatuses(customization.customStatuses || []);
      setQuickActions(customization.quickActions || QUICK_ACTIONS);
      setAppointmentTypes(customization.appointmentTypes || []);
      
      // Set theme and primary color
      setTheme(customization.theme || "light");
      setPrimaryColor(customization.primaryColor || "blue");
      
      // Initialize status labels for default statuses
      const initialStatusLabels: Record<string, string> = {
        no_answer: "No Answer",
        presented: "Demoed",
        booked: "Booked",
        sold: "Sold",
        not_interested: "Not Interested",
        no_soliciting: "No Soliciting",
        check_back: "Check Back"
      };
      
      // If there are custom status labels in customization, use those
      if (customization.statusLabels) {
        Object.keys(customization.statusLabels).forEach(status => {
          initialStatusLabels[status] = customization.statusLabels?.[status] || initialStatusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        });
      }
      setStatusLabels(initialStatusLabels);
      
      if (customization.confirmationOptions) {
        setSmsEnabled(customization.confirmationOptions.sms);
        setEmailEnabled(customization.confirmationOptions.email);
        setReminderTime(customization.confirmationOptions.reminderTime);
      }
      
      // Initialize dashboard widgets settings
      if (customization.dashboardWidgets) {
        setEnabledWidgets(customization.dashboardWidgets || DASHBOARD_WIDGETS);
        setWidgetOrder(customization.dashboardWidgets || DASHBOARD_WIDGETS);
      }
      
      if (customization.dashboardWidgetLabels) {
        setCustomWidgetLabels(customization.dashboardWidgetLabels || {});
      }
    }
  }, [customization]);
  
  // Save customization settings
  const saveCustomizationMutation = useMutation({
    mutationFn: async (updatedCustomization: Partial<Customization>) => {
      const response = await apiRequest(
        "PUT", 
        "/api/customizations/current",
        updatedCustomization
      );
      
      // Check if the response status is 204 No Content
      if (response.status === 204) {
        return null;
      }
      
      const clonedResponse = response.clone();
      try {
        return await clonedResponse.json();
      } catch (error) {
        console.log("Empty or invalid JSON response, returning null");
        return null;
      }
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your customization settings have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/customizations/current"] });
    },
    onError: (error) => {
      toast({
        title: "Error Saving Settings",
        description: `An error occurred: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handle saving all customization settings
  const handleSaveSettings = () => {
    saveCustomizationMutation.mutate({
      userId: user?.id,
      theme,
      primaryColor,
      pinColors: editedPinColors,
      quickActions,
      customStatuses,
      statusLabels,
      appointmentTypes,
      confirmationOptions: {
        sms: smsEnabled,
        email: emailEnabled,
        reminderTime
      },
      dashboardWidgets: enabledWidgets,
      dashboardWidgetLabels: customWidgetLabels
    });
  };
  
  // Handle adding a new custom status
  const handleAddCustomStatus = () => {
    if (!newStatus) return;
    if (customStatuses.includes(newStatus) || CONTACT_STATUSES.includes(newStatus)) {
      toast({
        title: "Status Already Exists",
        description: "This status is already in the list.",
        variant: "destructive",
      });
      return;
    }
    
    setCustomStatuses([...customStatuses, newStatus]);
    setNewStatus("");
  };
  
  // Handle adding a new quick action
  const handleAddQuickAction = () => {
    if (!newQuickAction) return;
    if (quickActions.includes(newQuickAction)) {
      toast({
        title: "Quick Action Already Exists",
        description: "This quick action is already in the list.",
        variant: "destructive",
      });
      return;
    }
    
    setQuickActions([...quickActions, newQuickAction]);
    setNewQuickAction("");
  };
  
  // Handle adding a new appointment type
  const handleAddAppointmentType = () => {
    if (!newAppointmentType) return;
    if (appointmentTypes.includes(newAppointmentType)) {
      toast({
        title: "Appointment Type Already Exists",
        description: "This appointment type is already in the list.",
        variant: "destructive",
      });
      return;
    }
    
    setAppointmentTypes([...appointmentTypes, newAppointmentType]);
    setNewAppointmentType("");
  };
  
  // Update pin color for a status
  const updatePinColor = (status: string, color: string) => {
    setEditedPinColors({
      ...editedPinColors,
      [status]: color
    });
  };
  
  // No color picker needed since we only use standard Google Maps colors
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customize</h2>
          <p className="text-muted-foreground">
            Personalize your door-to-door sales CRM experience
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link href="/customize-message-templates">
            <Button variant="outline">Message Templates</Button>
          </Link>
          <Button onClick={handleSaveSettings} disabled={saveCustomizationMutation.isPending}>
            {saveCustomizationMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-2 md:grid-cols-none h-auto">
          <TabsTrigger value="appearance" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>
            Dashboard Widgets
          </TabsTrigger>
          <TabsTrigger value="map-pins" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Map Pins
          </TabsTrigger>
          <TabsTrigger value="quick-actions" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="m8 3 4 8 5-5 5 15H2L8 3z"></path></svg>
            Quick Actions
          </TabsTrigger>
        </TabsList>
        
        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Visual Settings</CardTitle>
              <CardDescription>
                Customize how the application looks and feels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select 
                    value={theme} 
                    onValueChange={setTheme} 
                    disabled={!isPro}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Light" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isPro && (
                    <p className="text-xs text-muted-foreground flex items-center mt-1">
                      <Lock className="h-3 w-3 mr-1" /> Available with Pro plan
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <Select 
                    value={primaryColor} 
                    onValueChange={setPrimaryColor} 
                    disabled={!isPro}
                  >
                    <SelectTrigger id="primary-color">
                      <SelectValue placeholder="Blue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>
                  {!isPro && (
                    <p className="text-xs text-muted-foreground flex items-center mt-1">
                      <Lock className="h-3 w-3 mr-1" /> Available with Pro plan
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Contact Statuses</CardTitle>
              <CardDescription>
                Customize status labels and add new statuses for your contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default status customization section */}
              <div className="space-y-4">
                <h3 className="text-base font-semibold mb-3">Contact Statuses</h3>
                <div className="space-y-2">
                  {CONTACT_STATUSES.map(status => (
                    <div key={status} className="flex items-center justify-between p-2 border rounded">
                      {editingStatus === status ? (
                        <Input 
                          value={statusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          onChange={(e) => setStatusLabels({
                            ...statusLabels,
                            [status]: e.target.value
                          })}
                          autoFocus
                          className="flex-1 mr-2"
                        />
                      ) : (
                        <div className="flex items-center justify-between flex-1">
                          <span className="font-medium">{status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                          <span>{statusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                        </div>
                      )}
                      
                      <div className="flex space-x-1">
                        {editingStatus === status ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setEditingStatus(null)}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                const updatedLabels = {...statusLabels};
                                delete updatedLabels[status];
                                setStatusLabels(updatedLabels);
                                setEditingStatus(null);
                              }}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setEditingStatus(status)}
                              title="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t pt-5 space-y-4">
                <h3 className="text-base font-semibold mb-3">Custom Statuses</h3>
                
                {customStatuses.length === 0 ? (
                  <div className="text-center p-4 border border-dashed rounded-md">
                    <p className="text-muted-foreground">No custom statuses added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customStatuses.map((status, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span>{status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCustomStatuses(customStatuses.filter(s => s !== status))}
                          disabled={!isPro}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 mt-2">
                  <Input 
                    placeholder="New status name..." 
                    value={newStatus} 
                    onChange={e => setNewStatus(e.target.value)}
                    disabled={!isPro && customStatuses.length >= 3}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddCustomStatus}
                    disabled={!newStatus || (!isPro && customStatuses.length >= 3)}
                    className="bg-blue-400 hover:bg-blue-500 text-white"
                  >
                    Add
                  </Button>
                </div>
                
                {!isPro && (
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Info className="h-3 w-3 mr-1" /> Free accounts limited to 3 custom statuses. Upgrade to Pro for unlimited.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Appointment Settings</CardTitle>
              <CardDescription>
                Configure appointment types and notification settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Appointment Types</Label>
                <div className="space-y-2">
                  {appointmentTypes.map((type, index) => (
                    <div key={type} className="flex items-center justify-between p-2 border rounded">
                      {editingAppointmentType && editingAppointmentType.index === index ? (
                        <Input 
                          value={editingAppointmentType.value}
                          onChange={(e) => setEditingAppointmentType({
                            index,
                            value: e.target.value
                          })}
                          autoFocus
                          className="flex-1 mr-2"
                        />
                      ) : (
                        <span>{type}</span>
                      )}
                      
                      <div className="flex space-x-1">
                        {editingAppointmentType && editingAppointmentType.index === index ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                const newTypes = [...appointmentTypes];
                                newTypes[index] = editingAppointmentType.value;
                                setAppointmentTypes(newTypes);
                                setEditingAppointmentType(null);
                              }}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setEditingAppointmentType(null)}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setEditingAppointmentType({index, value: type})}
                              title="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </Button>
                            <Button
                              variant="ghost" 
                              size="icon"
                              onClick={() => setAppointmentTypes(appointmentTypes.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="New appointment type..." 
                    value={newAppointmentType} 
                    onChange={e => setNewAppointmentType(e.target.value)}
                    disabled={!isPro && appointmentTypes.length >= 4}
                  />
                  <Button 
                    onClick={handleAddAppointmentType}
                    disabled={!newAppointmentType || (!isPro && appointmentTypes.length >= 4)}
                  >
                    Add
                  </Button>
                </div>
                
                {!isPro && (
                  <p className="text-xs text-muted-foreground flex items-center mt-1">
                    <Info className="h-3 w-3 mr-1" /> Free accounts limited to 4 appointment types. Upgrade for more.
                  </p>
                )}
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Confirmation Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-confirmation" className="flex items-center gap-2">
                      <span>SMS Notifications</span>
                      {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </Label>
                    <Switch 
                      id="sms-confirmation" 
                      checked={smsEnabled} 
                      onCheckedChange={setSmsEnabled}
                      disabled={!isPro}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email-confirmation">Email Notifications</Label>
                    <Switch 
                      id="email-confirmation" 
                      checked={emailEnabled} 
                      onCheckedChange={setEmailEnabled}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reminder-time">Reminder Time (minutes before appointment)</Label>
                    <Input 
                      id="reminder-time" 
                      type="number" 
                      min={5} 
                      max={120} 
                      value={reminderTime} 
                      onChange={e => setReminderTime(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Dashboard Widgets Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard Widgets</CardTitle>
              <CardDescription>
                Choose which stats and widgets appear on your dashboard and customize their order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Enable/Disable Widgets</Label>
                  <p className="text-sm text-muted-foreground">Select which widgets to display on your dashboard.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {DASHBOARD_WIDGETS.map(widget => (
                      <div key={widget} className="flex items-center space-x-2 p-2 border rounded">
                        <Checkbox 
                          id={`widget-${widget}`} 
                          checked={enabledWidgets.includes(widget)}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              const newEnabledWidgets = [...enabledWidgets, widget];
                              setEnabledWidgets(newEnabledWidgets);
                              
                              // Add to widget order if not already there
                              if (!widgetOrder.includes(widget)) {
                                setWidgetOrder([...widgetOrder, widget]);
                              }
                            } else {
                              setEnabledWidgets(enabledWidgets.filter(w => w !== widget));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor={`widget-${widget}`} 
                            className="font-medium cursor-pointer flex items-center justify-between"
                          >
                            <span>{DASHBOARD_WIDGET_LABELS[widget] || widget}</span>
                            
                            {editingWidgetLabel === widget ? (
                              <Input 
                                value={customWidgetLabels[widget] || DASHBOARD_WIDGET_LABELS[widget] || widget}
                                onChange={(e) => setCustomWidgetLabels({
                                  ...customWidgetLabels,
                                  [widget]: e.target.value
                                })}
                                onClick={(e) => e.stopPropagation()}
                                className="w-40 ml-2 text-sm"
                                size={20}
                              />
                            ) : (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingWidgetLabel(widget);
                                }}
                                className="text-xs"
                              >
                                Edit Label
                              </Button>
                            )}
                          </Label>
                          
                          {editingWidgetLabel === widget && (
                            <div className="flex space-x-1 mt-1 justify-end">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingWidgetLabel(null)}
                              >
                                <Check className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  const updatedLabels = {...customWidgetLabels};
                                  delete updatedLabels[widget];
                                  setCustomWidgetLabels(updatedLabels);
                                  setEditingWidgetLabel(null);
                                }}
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="border-t pt-5 space-y-2">
                  <Label className="text-base font-semibold">Widget Order</Label>
                  <p className="text-sm text-muted-foreground">Drag and drop to rearrange the order of widgets on your dashboard.</p>
                  
                  <div className="space-y-2 mt-3">
                    {enabledWidgets.length === 0 ? (
                      <div className="text-center p-4 border border-dashed rounded-md">
                        <p className="text-muted-foreground">No widgets enabled. Enable widgets above to arrange them.</p>
                      </div>
                    ) : (
                      widgetOrder
                        .filter(widget => enabledWidgets.includes(widget))
                        .map((widget, index) => (
                        <div 
                          key={widget} 
                          className="flex items-center justify-between p-3 bg-muted/50 border rounded-md"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <span>{customWidgetLabels[widget] || DASHBOARD_WIDGET_LABELS[widget] || widget}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (index === 0) return;
                                const newOrder = [...widgetOrder];
                                const temp = newOrder[index];
                                newOrder[index] = newOrder[index - 1];
                                newOrder[index - 1] = temp;
                                setWidgetOrder(newOrder);
                              }}
                              disabled={index === 0}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m18 15-6-6-6 6"/></svg>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (index === widgetOrder.filter(w => enabledWidgets.includes(w)).length - 1) return;
                                const newOrder = [...widgetOrder];
                                const temp = newOrder[index];
                                newOrder[index] = newOrder[index + 1];
                                newOrder[index + 1] = temp;
                                setWidgetOrder(newOrder);
                              }}
                              disabled={index === widgetOrder.filter(w => enabledWidgets.includes(w)).length - 1}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m6 9 6 6 6-6"/></svg>
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Map Pins Tab */}
        <TabsContent value="map-pins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map Pin Configuration</CardTitle>
              <CardDescription>
                Customize both pin labels and colors in one place for a unified map appearance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Status ID</TableHead>
                      <TableHead>Display Label</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="w-24">Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...CONTACT_STATUSES, ...customStatuses].map(status => (
                      <TableRow key={status}>
                        <TableCell className="font-medium text-sm text-muted-foreground">
                          {status}
                        </TableCell>
                        <TableCell>
                          {editingStatus === status ? (
                            <div className="flex items-center gap-2">
                              <Input 
                                value={statusLabels[status] !== undefined ? statusLabels[status] : status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                onChange={(e) => setStatusLabels({
                                  ...statusLabels,
                                  [status]: e.target.value
                                })}
                                placeholder="Enter display label"
                                autoFocus
                                className="w-full"
                              />
                              <Button
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingStatus(null)}
                                className="px-2"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="px-2 py-1 cursor-pointer hover:bg-slate-50 rounded-md w-fit font-medium"
                              onClick={() => setEditingStatus(status)}
                            >
                              {statusLabels[status] !== undefined ? statusLabels[status] : status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                              <span className="ml-2 text-xs text-muted-foreground">(click to edit)</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue"} 
                              onValueChange={color => updatePinColor(status, color)}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue>
                                  <div className="flex items-center">
                                    <div 
                                      className="w-4 h-4 rounded-full mr-2" 
                                      style={{ 
                                        backgroundColor: editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue",
                                        border: '1px solid #ddd'
                                      }}
                                    />
                                    {(editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue").charAt(0).toUpperCase() + 
                                     (editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue").slice(1)}
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {PIN_COLORS.map(color => (
                                  <SelectItem key={color} value={color}>
                                    <div className="flex items-center">
                                      <div 
                                        className="w-4 h-4 rounded-full mr-2" 
                                        style={{ 
                                          backgroundColor: color,
                                          border: '1px solid #ddd'
                                        }}
                                      />
                                      {color.charAt(0).toUpperCase() + color.slice(1)}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" 
                              style={{ backgroundColor: editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue" }}
                              title={statusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            >
                              {(statusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')).charAt(0).toUpperCase()}
                            </div>
                          </div>
                        </TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              

              
              {/* Legend Preview */}
              <div className="mt-8 bg-white p-4 border rounded-md">
                <h3 className="text-base font-semibold mb-3">Map Legend Preview</h3>
                <div className="flex flex-wrap gap-4">
                  {[...CONTACT_STATUSES, ...customStatuses].map(status => (
                    <div key={status} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: editedPinColors[status] || DEFAULT_PIN_COLORS[status as keyof typeof DEFAULT_PIN_COLORS] || "blue" }}
                      />
                      <span className="text-sm">
                        {statusLabels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-3 w-3 inline-block mr-1" />
                  Note: Google Maps has limited color options for pins. Your custom colors will be mapped to the closest available Google Maps pin color.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Quick Actions Tab */}
        <TabsContent value="quick-actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Action Settings</CardTitle>
              <CardDescription>
                Configure quick actions for easy status updates when clicking on houses.
                {isPro ? ' Pro users can fully customize quick actions.' : ' Upgrade to Pro for more customization options.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg mb-4">
                <h3 className="font-medium mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  How Quick Actions Work
                </h3>
                <ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
                  <li>Click a house to instantly apply the selected quick action status (no form opens)</li>
                  <li>Press and hold on a house to open the full contact form</li>
                  <li>Quick actions allow for faster data entry during door-to-door sales</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Selected Quick Actions</h3>
                <p className="text-sm text-muted-foreground">
                  Choose which statuses can be applied with a quick click (max {isPro ? 8 : 4})
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[...CONTACT_STATUSES, ...customStatuses].map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`quick-${status}`} 
                        checked={quickActions.includes(status)}
                        onCheckedChange={(checked: boolean | "indeterminate") => {
                          if (checked === true) {
                            if ((!isPro && quickActions.length >= 4) || quickActions.length >= 8) {
                              toast({
                                title: `Maximum ${isPro ? 8 : 4} quick actions`,
                                description: `${isPro ? 'You can select up to 8 quick actions.' : 'Free users can select up to 4 quick actions. Upgrade to Pro for more.'}`,
                                variant: "destructive"
                              });
                              return;
                            }
                            setQuickActions([...quickActions, status]);
                          } else {
                            setQuickActions(quickActions.filter(s => s !== status));
                          }
                        }}
                      />
                      <Label 
                        htmlFor={`quick-${status}`}
                        className="text-sm font-normal"
                      >
                        {status.replace(/_/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="default-quick-action">Default quick action</Label>
                  <Select disabled={!isPro} defaultValue="no_answer">
                    <SelectTrigger id="default-quick-action" className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {quickActions.map(action => (
                        <SelectItem key={action} value={action}>
                          {action.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}