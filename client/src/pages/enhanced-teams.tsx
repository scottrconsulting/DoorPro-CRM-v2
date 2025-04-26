import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { 
  Loader2, 
  Plus, 
  Users, 
  UserPlus, 
  UserX, 
  Building2, 
  ClipboardList, 
  CreditCard,
  Mail,
  ShieldCheck,
  BellRing,
  Settings,
  UserCog,
  MessageSquare,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useLocation } from "wouter";

// Define schemas for form validation
const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

const newMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  fullName: z.string().min(1, "Full name is required"),
  title: z.string().optional(),
  role: z.enum(["admin", "manager", "user"]), // Access level
  sendWelcomeEmail: z.boolean().default(true),
});

type Team = {
  id: number;
  name: string;
  description: string | null;
  managerId: number;
  createdAt: string;
  updatedAt: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'canceled' | 'unpaid';
};

type TeamMember = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  title?: string;
  teamId: number | null;
  isManager: boolean;
  status: 'active' | 'pending' | 'inactive';
  createdAt: string;
};

function TeamCard({ team, onMembersClick }: { team: Team, onMembersClick: (teamId: number) => void }) {
  const { toast } = useToast();
  
  const { data: members = [], isLoading: loadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/teams', team.id, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/teams/${team.id}/members`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to fetch team members`);
      }
      return res.json();
    },
  });
  
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      await apiRequest('DELETE', `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({
        title: "Team deleted",
        description: "The team has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete team",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this team? This will also remove all team members.')) {
      deleteTeamMutation.mutate(id);
    }
  };

  return (
    <Card className="shadow-sm hover:shadow transition-all">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>{team.name}</CardTitle>
          </div>
        </div>
        <CardDescription>
          {team.description || "No description provided"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p>Created: {new Date(team.createdAt).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center">
            <Users className="h-4 w-4 text-muted-foreground mr-2" />
            <span className="text-sm">
              {loadingMembers ? (
                <Loader2 className="h-3 w-3 animate-spin inline-block" />
              ) : (
                `${members.length} Member${members.length !== 1 ? 's' : ''}`
              )}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => onMembersClick(team.id)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Manage Team
        </Button>
        <Button variant="destructive" size="sm" onClick={() => handleDelete(team.id)}>
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}

function CreateTeamDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof teamSchema>>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  
  const createTeamMutation = useMutation({
    mutationFn: async (data: z.infer<typeof teamSchema>) => {
      const res = await apiRequest('POST', '/api/teams', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      setOpen(false);
      form.reset();
      toast({
        title: "Team created",
        description: "Your team has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create team",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof teamSchema>) => {
    createTeamMutation.mutate(data);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto" aria-label="Create Team">
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a team to better organize your sales representatives and assign territories.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter team name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter team description" 
                      className="resize-none" 
                      {...field} 
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={createTeamMutation.isPending}
              >
                {createTeamMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Team
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ teamId, open, setOpen }: { teamId: number | null, open: boolean, setOpen: (open: boolean) => void }) {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof newMemberSchema>>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: {
      email: "",
      fullName: "",
      title: "",
      role: "user",
      sendWelcomeEmail: true,
    },
  });
  
  const addMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof newMemberSchema>) => {
      if (!teamId) throw new Error("Team ID is required");
      
      // In a real implementation this would handle billing too
      const res = await apiRequest('POST', `/api/teams/${teamId}/members/invite`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
      setOpen(false);
      form.reset();
      toast({
        title: "Invitation sent",
        description: "An invitation has been sent to the new team member",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof newMemberSchema>) => {
    addMemberMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Add a new member to your team. They'll receive an invitation email to set up their account.
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-sm">
              <div className="flex items-center">
                <CreditCard className="h-4 w-4 mr-2" />
                <span>You will be charged $25/month for each additional team member.</span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="team.member@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Sales Representative" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Level</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center">
                          <ShieldCheck className="h-4 w-4 mr-2 text-amber-500" />
                          <span>Admin</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center">
                          <UserCog className="h-4 w-4 mr-2 text-blue-500" />
                          <span>Manager</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-green-500" />
                          <span>Regular User</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sendWelcomeEmail"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Send Welcome Email</FormLabel>
                    <FormDescription>
                      Send an email with account setup instructions
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
            
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={addMemberMutation.isPending}
              >
                {addMemberMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Add Member
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TeamMembersManager({ teamId }: { teamId: number | null }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const [subscriptionInProgress, setSubscriptionInProgress] = useState(false);
  
  // Fetch team details
  const { data: team, isLoading: isLoadingTeam } = useQuery<Team>({
    queryKey: ['/api/teams', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const res = await fetch(`/api/teams/${teamId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to fetch team: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!teamId && !!user,
  });
  
  // Fetch team members
  const { data: members = [], isLoading: isLoadingMembers } = useQuery<TeamMember[]>({
    queryKey: ['/api/teams', teamId, 'members'],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}/members`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`Failed to fetch team members: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!teamId && !!user,
  });
  
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest('DELETE', `/api/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
      toast({
        title: "Member removed",
        description: "User has been removed from the team",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    },
  });
  
  const resendInviteMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest('POST', `/api/teams/${teamId}/members/resend-invite`, { email });
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "The invitation has been resent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });
  
  const sendPushNotificationMutation = useMutation({
    mutationFn: async (data: { userIds: number[], message: string, priority: 'normal' | 'urgent' }) => {
      await apiRequest('POST', `/api/teams/${teamId}/notifications`, data);
    },
    onSuccess: () => {
      toast({
        title: "Notification sent",
        description: "Your notification has been sent to the selected team members",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    },
  });
  
  const handleRemoveMember = (userId: number) => {
    if (window.confirm('Are you sure you want to remove this member from the team? Their monthly subscription will be canceled.')) {
      removeMemberMutation.mutate(userId);
    }
  };
  
  const handleResendInvite = (email: string) => {
    resendInviteMutation.mutate(email);
  };
  
  // For the send notification functionality
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationPriority, setNotificationPriority] = useState<'normal' | 'urgent'>('normal');
  
  const toggleMemberSelection = (userId: number) => {
    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };
  
  const handleSendNotification = () => {
    if (notificationMessage.trim() === "") {
      toast({
        title: "Error",
        description: "Notification message cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedMembers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one team member",
        variant: "destructive",
      });
      return;
    }
    
    sendPushNotificationMutation.mutate({
      userIds: selectedMembers,
      message: notificationMessage,
      priority: notificationPriority
    });
    
    // Reset after sending
    setNotificationMessage("");
    setSelectedMembers([]);
    setNotificationPriority('normal');
  };
  
  const handleSelectAllMembers = () => {
    if (selectedMembers.length === members.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(member => member.id));
    }
  };
  
  // Subscription handling
  const subscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!teamId) throw new Error("Team ID is required");
      
      const res = await apiRequest('POST', `/api/teams/${teamId}/subscription`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId] });
      
      // If we got a clientSecret back, we need to handle Stripe payment
      if (data.clientSecret) {
        setSubscriptionInProgress(true);
        // Redirect to payment page or open a dialog
        window.location.href = `/subscription/checkout?client_secret=${data.clientSecret}&subscription_id=${data.subscriptionId}`;
      } else {
        toast({
          title: "Subscription updated",
          description: "Your team subscription has been updated",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });
  
  const handleManageSubscription = () => {
    if (team?.stripeSubscriptionId && team?.subscriptionStatus === 'active') {
      // Redirect to Stripe customer portal to manage existing subscription
      window.location.href = `/api/teams/${teamId}/subscription/portal`;
    } else {
      // Create new subscription
      subscriptionMutation.mutate();
    }
  };
  
  if (!teamId) return null;
  
  if (isLoadingTeam) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{team?.name}</h2>
          <p className="text-muted-foreground">{team?.description || "No description"}</p>
        </div>
        <Button onClick={() => setAddMemberDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="members" className="flex items-center justify-center">
            <Users className="h-4 w-4 mr-2" />
            <span>Members</span>
            <Badge variant="outline" className="ml-2">{members.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center justify-center">
            <BellRing className="h-4 w-4 mr-2" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center justify-center">
            <Settings className="h-4 w-4 mr-2" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="members" className="border rounded-md mt-4">
          <div className="p-2 bg-muted font-medium border-b flex items-center justify-between">
            <span>Team Members</span>
            <div className="text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''} ($25/month per member)
            </div>
          </div>
          
          {isLoadingMembers ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No members in this team yet</p>
              <Button variant="outline" onClick={() => setAddMemberDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Team Member
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 p-3 bg-muted/50 text-sm font-medium text-muted-foreground">
                <div className="col-span-4">Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Actions</div>
              </div>
              
              {members.map(member => (
                <div key={member.id} className="grid grid-cols-12 p-3 items-center">
                  <div className="col-span-4">
                    <div className="font-medium">{member.fullName}</div>
                    {member.title && (
                      <div className="text-xs text-muted-foreground">{member.title}</div>
                    )}
                  </div>
                  <div className="col-span-3 text-sm truncate">{member.email}</div>
                  <div className="col-span-2">
                    {member.role === 'admin' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {member.role === 'manager' && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <UserCog className="h-3 w-3 mr-1" />
                        Manager
                      </Badge>
                    )}
                    {member.role === 'user' && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Users className="h-3 w-3 mr-1" />
                        User
                      </Badge>
                    )}
                  </div>
                  <div className="col-span-2">
                    {member.status === 'active' && (
                      <div className="flex items-center text-sm text-green-600">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        Active
                      </div>
                    )}
                    {member.status === 'pending' && (
                      <div className="flex items-center text-sm text-amber-600">
                        <div className="h-2 w-2 rounded-full bg-amber-500 mr-2"></div>
                        Pending
                      </div>
                    )}
                    {member.status === 'inactive' && (
                      <div className="flex items-center text-sm text-neutral-600">
                        <div className="h-2 w-2 rounded-full bg-neutral-500 mr-2"></div>
                        Inactive
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end space-x-1">
                    {member.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleResendInvite(member.email)}
                        className="h-8 w-8 p-0" 
                        title="Resend invitation"
                      >
                        <Mail className="h-4 w-4 text-amber-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Remove member"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="notifications" className="border rounded-md mt-4 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Send Team Notification</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Send important updates or alerts to selected team members
              </p>
              
              <div className="space-y-4">
                <div className="border rounded-md">
                  <div className="p-3 bg-muted font-medium border-b flex justify-between items-center">
                    <span>Select Recipients</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllMembers}
                    >
                      {selectedMembers.length === members.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {members.map(member => (
                      <div key={member.id} className="p-3 flex items-center">
                        <input
                          type="checkbox"
                          id={`member-${member.id}`}
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => toggleMemberSelection(member.id)}
                          className="h-4 w-4 rounded border-neutral-300 mr-3"
                        />
                        <label htmlFor={`member-${member.id}`} className="flex-1 cursor-pointer">
                          <div className="font-medium">{member.fullName}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </label>
                        <div>
                          {member.status === 'active' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-neutral-100 text-neutral-700 border-neutral-200">
                              {member.status === 'pending' ? 'Pending' : 'Inactive'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Message</label>
                  <Textarea
                    placeholder="Enter your notification message here..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    className="resize-none h-24"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="priority-normal"
                        name="priority"
                        value="normal"
                        checked={notificationPriority === 'normal'}
                        onChange={() => setNotificationPriority('normal')}
                        className="h-4 w-4 border-neutral-300 mr-2"
                      />
                      <label htmlFor="priority-normal" className="cursor-pointer">Normal</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="priority-urgent"
                        name="priority"
                        value="urgent"
                        checked={notificationPriority === 'urgent'}
                        onChange={() => setNotificationPriority('urgent')}
                        className="h-4 w-4 border-neutral-300 mr-2"
                      />
                      <label htmlFor="priority-urgent" className="cursor-pointer text-red-600 font-medium">Urgent</label>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={handleSendNotification}
                  disabled={selectedMembers.length === 0 || notificationMessage.trim() === '' || sendPushNotificationMutation.isPending}
                >
                  {sendPushNotificationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <BellRing className="h-4 w-4 mr-2" />
                  )}
                  Send Notification
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Recent Notifications</h3>
              <div className="border rounded-md divide-y">
                <div className="p-3 text-center text-sm text-muted-foreground">
                  No recent notifications
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="border rounded-md mt-4 p-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Team Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">Team Conversations</div>
                    <div className="text-sm text-muted-foreground">Enable chat between team members</div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">Activity Tracking</div>
                    <div className="text-sm text-muted-foreground">Record team member activities</div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">Email Notifications</div>
                    <div className="text-sm text-muted-foreground">Send email notifications for important events</div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Billing Summary</h3>
              <div className="p-4 border rounded-md bg-muted/30">
                <div className="flex justify-between items-center mb-4">
                  <div className="font-medium">Current Plan</div>
                  <Badge>Pro</Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Base subscription</span>
                    <span>$50.00/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Team members ({members.length} × $25.00)</span>
                    <span>${members.length * 25}.00/month</span>
                  </div>
                  <div className="border-t pt-2 mt-2 font-medium">
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span>${50 + members.length * 25}.00/month</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => handleManageSubscription()}
                  disabled={subscriptionMutation.isPending}
                >
                  {subscriptionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {team?.stripeSubscriptionId && team?.subscriptionStatus === 'active'
                    ? 'Manage Subscription'
                    : 'Activate Subscription'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <AddMemberDialog 
        teamId={teamId} 
        open={addMemberDialogOpen} 
        setOpen={setAddMemberDialogOpen} 
      />
    </div>
  );
}

export default function Teams() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  
  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const res = await fetch('/api/teams', { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized - Please log in");
        }
        throw new Error(`Failed to fetch teams: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!user && (user.role === 'pro' || user.role === 'admin'), // Only fetch if user is authenticated and has pro access
  });
  
  const openTeamManager = (teamId: number) => {
    setSelectedTeamId(teamId);
  };
  
  if (user?.role !== 'pro' && user?.role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-4">Pro Feature</h2>
          <p className="mb-6">Team management is a Pro feature. Upgrade your account to access this functionality.</p>
          <Button onClick={() => navigate("/upgrade")}>Upgrade to Pro</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 space-y-6">
      {selectedTeamId ? (
        <div className="space-y-6">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedTeamId(null)}
              className="mr-2"
            >
              ← Back
            </Button>
          </div>
          
          <TeamMembersManager teamId={selectedTeamId} />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Teams</h1>
              <p className="text-muted-foreground">Manage your sales teams and members</p>
            </div>
            <CreateTeamDialog />
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : teams?.length === 0 ? (
            <Card className="p-8 text-center">
              <CardHeader>
                <CardTitle>No Teams Found</CardTitle>
                <CardDescription>
                  You don't have any teams yet. Create your first team to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="mt-4" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Create Team"]')?.click()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams?.map(team => (
                <TeamCard key={team.id} team={team} onMembersClick={openTeamManager} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}