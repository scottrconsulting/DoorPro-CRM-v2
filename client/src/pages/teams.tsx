import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, Plus, Users, UserPlus, UserX, Building2, ClipboardList } from "lucide-react";
import { useLocation } from "wouter";

// Define schemas for form validation
const teamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

const memberSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

type Team = {
  id: number;
  name: string;
  description: string | null;
  managerId: number;
  createdAt: string;
  updatedAt: string;
};

type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  teamId: number | null;
  isManager: boolean;
  createdAt: string;
};

function TeamCard({ team, onMembersClick }: { team: Team, onMembersClick: (teamId: number) => void }) {
  const { toast } = useToast();
  
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
    if (window.confirm('Are you sure you want to delete this team?')) {
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
        <div className="text-sm text-muted-foreground">
          <p>Created: {new Date(team.createdAt).toLocaleDateString()}</p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => onMembersClick(team.id)}>
          <Users className="h-4 w-4 mr-2" />
          Manage Members
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
        <Button className="ml-auto">
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

function TeamMembersDialog({ teamId, open, setOpen }: { teamId: number | null, open: boolean, setOpen: (open: boolean) => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      username: "",
    },
  });
  
  // Fetch team details
  const { data: team, isLoading: isLoadingTeam } = useQuery<Team>({
    queryKey: ['/api/teams', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const res = await fetch(`/api/teams/${teamId}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized - Please log in");
        }
        throw new Error(`Failed to fetch team: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!teamId && !!user && (user.role === 'pro' || user.role === 'admin'),
  });
  
  // Fetch team members
  const { data: members = [], isLoading: isLoadingMembers } = useQuery<User[]>({
    queryKey: ['/api/teams', teamId, 'members'],
    queryFn: async () => {
      if (!teamId) return [];
      const res = await fetch(`/api/teams/${teamId}/members`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Unauthorized - Please log in");
        }
        throw new Error(`Failed to fetch team members: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!teamId && !!user && (user.role === 'pro' || user.role === 'admin'),
  });
  
  const addMemberMutation = useMutation({
    mutationFn: async (data: { username: string }) => {
      // First, fetch the user by username
      const userRes = await fetch(`/api/users/search?username=${encodeURIComponent(data.username)}`, { credentials: "include" });
      if (!userRes.ok) {
        if (userRes.status === 404) {
          throw new Error('User not found');
        }
        if (userRes.status === 401) {
          throw new Error('Unauthorized - Please log in');
        }
        throw new Error('Failed to find user');
      }
      
      const user = await userRes.json();
      
      // Then add the user to the team
      const res = await apiRequest('POST', `/api/teams/${teamId}/members`, { userId: user.id });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
      form.reset();
      toast({
        title: "Member added",
        description: "User has been added to the team",
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
  
  const onSubmit = (data: z.infer<typeof memberSchema>) => {
    addMemberMutation.mutate(data);
  };
  
  const handleRemoveMember = (userId: number) => {
    if (window.confirm('Are you sure you want to remove this member from the team?')) {
      removeMemberMutation.mutate(userId);
    }
  };
  
  if (!teamId) return null;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isLoadingTeam ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </div>
            ) : (
              <>Team Members: {team?.name}</>
            )}
          </DialogTitle>
          <DialogDescription>
            Manage team members and their roles.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex space-x-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder="Username to add" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                disabled={addMemberMutation.isPending}
                size="sm"
              >
                {addMemberMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Add
              </Button>
            </form>
          </Form>
          
          <div className="border rounded-md">
            <div className="p-2 bg-muted font-medium border-b">
              Team Members
            </div>
            <div className="divide-y">
              {isLoadingMembers ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : members?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No members in this team yet
                </div>
              ) : (
                members?.map(member => (
                  <div key={member.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{member.fullName}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Teams() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  
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
  
  const openMembersDialog = (teamId: number) => {
    setSelectedTeamId(teamId);
    setMembersDialogOpen(true);
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
            <TeamCard key={team.id} team={team} onMembersClick={openMembersDialog} />
          ))}
        </div>
      )}
      
      <TeamMembersDialog 
        teamId={selectedTeamId} 
        open={membersDialogOpen} 
        setOpen={setMembersDialogOpen} 
      />
    </div>
  );
}