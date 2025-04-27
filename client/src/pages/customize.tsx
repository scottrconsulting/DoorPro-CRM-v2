import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Customization, CONTACT_STATUSES, PIN_COLORS, QUICK_ACTIONS } from "@shared/schema";

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
  
  // State for customization settings
  const [activeTab, setActiveTab] = useState("appearance");
  const [newStatus, setNewStatus] = useState("");
  const [newQuickAction, setNewQuickAction] = useState("");
  const [newAppointmentType, setNewAppointmentType] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState(30); // minutes
  
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
          pinColors: Object.fromEntries(CONTACT_STATUSES.map((status, i) => [status, PIN_COLORS[i % PIN_COLORS.length]])),
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
  
  // Set initial values when data is loaded
  useEffect(() => {
    if (customization) {
      setEditedPinColors(customization.pinColors || {});
      setCustomStatuses(customization.customStatuses || []);
      setQuickActions(customization.quickActions || QUICK_ACTIONS);
      setAppointmentTypes(customization.appointmentTypes || []);
      
      // Initialize status labels for default statuses
      const initialStatusLabels: Record<string, string> = {};
      CONTACT_STATUSES.forEach(status => {
        initialStatusLabels[status] = customization.statusLabels?.[status] || status.replace(/_/g, ' ');
      });
      setStatusLabels(initialStatusLabels);
      
      if (customization.confirmationOptions) {
        setSmsEnabled(customization.confirmationOptions.sms);
        setEmailEnabled(customization.confirmationOptions.email);
        setReminderTime(customization.confirmationOptions.reminderTime);
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
      return response.json();
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
      pinColors: editedPinColors,
      quickActions,
      customStatuses,
      statusLabels,
      appointmentTypes,
      confirmationOptions: {
        sms: smsEnabled,
        email: emailEnabled,
        reminderTime
      }
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
          <Button variant="outline" onClick={() => window.location.href = "/customize-message-templates"}>
            Message Templates
          </Button>
          <Button onClick={handleSaveSettings} disabled={saveCustomizationMutation.isPending}>
            {saveCustomizationMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-3 md:grid-cols-none h-auto">
          <TabsTrigger value="appearance" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Settings className="mr-2 h-4 w-4" />
            Appearance
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
                  <Select disabled={!isPro}>
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
                  <Select disabled={!isPro}>
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
              <div>
                <h3 className="text-base font-semibold mb-3">Customize Default Status Labels</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Default Status</TableHead>
                      <TableHead>Custom Label</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {CONTACT_STATUSES.map(status => (
                      <TableRow key={status}>
                        <TableCell className="font-medium">
                          {status.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          {editingStatus === status ? (
                            <Input 
                              value={statusLabels[status] || status.replace(/_/g, ' ')}
                              onChange={(e) => setStatusLabels({
                                ...statusLabels,
                                [status]: e.target.value
                              })}
                              autoFocus
                              className="w-full"
                            />
                          ) : (
                            <span>{statusLabels[status] || status.replace(/_/g, ' ')}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingStatus === status ? (
                            <div className="flex space-x-1">
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
                            </div>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setEditingStatus(status)}
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="border-t pt-5">
                <h3 className="text-base font-semibold mb-3">Custom Statuses</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {customStatuses.map(status => (
                    <Badge key={status} variant="outline" className="text-sm flex items-center gap-1">
                      {status}
                      <button 
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => setCustomStatuses(customStatuses.filter(s => s !== status))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="New status name..." 
                    value={newStatus} 
                    onChange={e => setNewStatus(e.target.value)}
                    disabled={!isPro && customStatuses.length >= 3}
                  />
                  <Button 
                    onClick={handleAddCustomStatus}
                    disabled={!newStatus || (!isPro && customStatuses.length >= 3)}
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
                  {appointmentTypes.map(type => (
                    <div key={type} className="flex items-center justify-between p-2 border rounded">
                      <span>{type}</span>
                      <Button
                        variant="ghost" 
                        size="icon"
                        onClick={() => setAppointmentTypes(appointmentTypes.filter(t => t !== type))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        
        {/* Map Pins Tab */}
        <TabsContent value="map-pins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pin Color Settings</CardTitle>
              <CardDescription>
                Customize the colors of pins on the map based on contact status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="w-24">Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...CONTACT_STATUSES, ...customStatuses].map(status => (
                      <TableRow key={status}>
                        <TableCell className="font-medium">
                          {status.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={editedPinColors[status] || PIN_COLORS[0]} 
                            onValueChange={color => updatePinColor(status, color)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PIN_COLORS.map(color => (
                                <SelectItem key={color} value={color}>
                                  <div className="flex items-center">
                                    <div 
                                      className="w-4 h-4 rounded-full mr-2" 
                                      style={{ backgroundColor: color }}
                                    />
                                    {color.charAt(0).toUpperCase() + color.slice(1)}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <div 
                              className="w-6 h-6 rounded-full" 
                              style={{ backgroundColor: editedPinColors[status] || PIN_COLORS[0] }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                  <Label htmlFor="click-and-hold" className="flex items-center gap-2">
                    <span>Enable click and hold for form</span>
                    {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <Switch 
                    id="click-and-hold" 
                    defaultChecked={true}
                    disabled={!isPro}
                  />
                </div>
                
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