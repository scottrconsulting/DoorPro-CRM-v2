import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { MessageTemplate } from "@shared/schema";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, Check, X, Info, Lock } from "lucide-react";

export default function CustomizeMessageTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPro = user?.role === "pro" || user?.role === "admin";
  
  // State for message templates
  const [activeTab, setActiveTab] = useState("sms");
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    subject: "",
    content: "",
    type: activeTab as "sms" | "email"
  });
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  
  // Fetch message templates
  const { data: templates = [], isLoading, refetch } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
    queryFn: async ({ queryKey }) => {
      const response = await apiRequest("GET", queryKey[0] as string);
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!user
  });
  
  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: Partial<MessageTemplate>) => {
      if (template.id) {
        // Update existing template
        const response = await apiRequest(
          "PUT", 
          `/api/message-templates/${template.id}`,
          template
        );
        return response.json();
      } else {
        // Create new template
        const response = await apiRequest(
          "POST", 
          "/api/message-templates",
          template
        );
        return response.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Template Saved",
        description: "Your message template has been saved.",
      });
      setEditingTemplate(null);
      setIsAddingTemplate(false);
      setNewTemplate({
        name: "",
        subject: "",
        content: "",
        type: activeTab as "sms" | "email"
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error Saving Template",
        description: `An error occurred: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await apiRequest(
        "DELETE", 
        `/api/message-templates/${templateId}`
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Template Deleted",
        description: "The message template has been deleted.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error Deleting Template",
        description: `An error occurred: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Set template as default mutation
  const setDefaultTemplateMutation = useMutation({
    mutationFn: async ({ templateId, type }: { templateId: number, type: string }) => {
      const response = await apiRequest(
        "PUT", 
        `/api/message-templates/${templateId}/set-default`,
        { type }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Default Template Updated",
        description: "Your default template has been updated.",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error Setting Default",
        description: `An error occurred: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handle template actions
  const handleSaveTemplate = (template: Partial<MessageTemplate>) => {
    saveTemplateMutation.mutate(template);
  };
  
  const handleDeleteTemplate = (templateId: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate(templateId);
    }
  };
  
  const handleSetDefault = (templateId: number, type: string) => {
    setDefaultTemplateMutation.mutate({ templateId, type });
  };
  
  // Filter templates by type
  const filteredTemplates = templates.filter(template => template.type === activeTab);
  
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Message Templates</h2>
          <p className="text-muted-foreground">
            Create and manage templates for SMS and email communications
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link href="/customize">
            <Button variant="outline">Back to Customize</Button>
          </Link>
          <Button 
            onClick={() => {
              setIsAddingTemplate(true);
              setNewTemplate({
                ...newTemplate,
                type: activeTab as "sms" | "email"
              });
            }}
            disabled={!isPro && filteredTemplates.length >= 3}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Template
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-2 md:grid-cols-none h-auto">
          <TabsTrigger value="sms" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            SMS Templates
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            Email Templates
          </TabsTrigger>
        </TabsList>
        
        {/* SMS Templates Tab */}
        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMS Templates</CardTitle>
              <CardDescription>
                Create and manage templates for SMS messages sent to contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {isAddingTemplate && activeTab === "sms" && (
                    <Card className="border-primary/50 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">New SMS Template</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-name">Template Name</Label>
                          <Input 
                            id="template-name"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                            placeholder="E.g., Appointment Reminder"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="template-content">Message Content</Label>
                          <div className="text-xs text-muted-foreground mb-1">
                            Use variables like {"{first_name}"}, {"{address}"}, {"{date}"}, etc.
                          </div>
                          <Textarea 
                            id="template-content"
                            value={newTemplate.content}
                            onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                            placeholder="Hi {first_name}, just confirming your appointment on {date} at {time}. Reply YES to confirm."
                            rows={4}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="make-default"
                              checked={false}
                              onCheckedChange={() => {}}
                            />
                            <Label htmlFor="make-default">Set as default SMS template</Label>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsAddingTemplate(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleSaveTemplate({
                                ...newTemplate,
                                type: "sms",
                                isDefault: false
                              })}
                              disabled={!newTemplate.name || !newTemplate.content}
                            >
                              Save Template
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {filteredTemplates.length === 0 && !isAddingTemplate ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">You don't have any SMS templates yet.</p>
                      <Button 
                        onClick={() => {
                          setIsAddingTemplate(true);
                          setNewTemplate({
                            ...newTemplate,
                            type: "sms"
                          });
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create Your First Template
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTemplates.map(template => (
                        <Card key={template.id} className={template.isDefault ? "border-primary shadow-sm" : ""}>
                          <CardHeader className="pb-2 flex flex-row items-start justify-between">
                            <div>
                              <CardTitle className="text-lg flex items-center">
                                {template.name}
                                {template.isDefault && (
                                  <Badge className="ml-2 bg-primary text-primary-foreground">Default</Badge>
                                )}
                              </CardTitle>
                            </div>
                            <div className="flex space-x-1">
                              {!template.isDefault && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleSetDefault(template.id, template.type)}
                                  title="Set as default"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m19 9-7 7-7-7"></path></svg>
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingTemplate(template.id)}
                                title="Edit template"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-destructive"
                                title="Delete template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {editingTemplate === template.id ? (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-name-${template.id}`}>Template Name</Label>
                                  <Input 
                                    id={`edit-name-${template.id}`}
                                    value={template.name}
                                    onChange={(e) => {
                                      const updatedTemplates = templates.map(t => 
                                        t.id === template.id ? {...t, name: e.target.value} : t
                                      );
                                      queryClient.setQueryData(["/api/message-templates"], updatedTemplates);
                                    }}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-content-${template.id}`}>Message Content</Label>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    Use variables like {"{first_name}"}, {"{address}"}, {"{date}"}, etc.
                                  </div>
                                  <Textarea 
                                    id={`edit-content-${template.id}`}
                                    value={template.content}
                                    onChange={(e) => {
                                      const updatedTemplates = templates.map(t => 
                                        t.id === template.id ? {...t, content: e.target.value} : t
                                      );
                                      queryClient.setQueryData(["/api/message-templates"], updatedTemplates);
                                    }}
                                    rows={4}
                                  />
                                </div>
                                
                                <div className="flex justify-end space-x-2 pt-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setEditingTemplate(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      const editedTemplate = templates.find(t => t.id === template.id);
                                      if (editedTemplate) {
                                        handleSaveTemplate(editedTemplate);
                                      }
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm whitespace-pre-wrap">{template.content}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {!isAddingTemplate && filteredTemplates.length > 0 && filteredTemplates.length < (isPro ? 10 : 3) && (
                    <div className="flex justify-center">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setIsAddingTemplate(true);
                          setNewTemplate({
                            ...newTemplate,
                            type: "sms"
                          });
                        }}
                        disabled={!isPro && filteredTemplates.length >= 3}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Another Template
                      </Button>
                    </div>
                  )}
                  
                  {!isPro && filteredTemplates.length >= 3 && (
                    <div className="bg-muted p-4 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground flex items-center justify-center">
                        <Lock className="h-4 w-4 mr-2" /> 
                        Free accounts are limited to 3 templates. Upgrade to Pro for unlimited templates.
                      </p>
                      <Link href="/upgrade">
                        <Button className="mt-2" variant="default">
                          Upgrade to Pro
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Email Templates Tab */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                Create and manage templates for emails sent to contacts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {isAddingTemplate && activeTab === "email" && (
                    <Card className="border-primary/50 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">New Email Template</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="template-name">Template Name</Label>
                          <Input 
                            id="template-name"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                            placeholder="E.g., Welcome Email"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="template-subject">Email Subject</Label>
                          <Input 
                            id="template-subject"
                            value={newTemplate.subject || ""}
                            onChange={(e) => setNewTemplate({...newTemplate, subject: e.target.value})}
                            placeholder="E.g., Welcome to our service!"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="template-content">Email Content</Label>
                          <div className="text-xs text-muted-foreground mb-1">
                            Use variables like {"{first_name}"}, {"{address}"}, {"{date}"}, etc.
                          </div>
                          <Textarea 
                            id="template-content"
                            value={newTemplate.content}
                            onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                            placeholder="Dear {first_name},\n\nThank you for your interest in our service. We're excited to work with you.\n\nBest regards,\nYour Name"
                            rows={8}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="make-default"
                              checked={false}
                              onCheckedChange={() => {}}
                            />
                            <Label htmlFor="make-default">Set as default email template</Label>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setIsAddingTemplate(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleSaveTemplate({
                                ...newTemplate,
                                type: "email",
                                isDefault: false
                              })}
                              disabled={!newTemplate.name || !newTemplate.subject || !newTemplate.content}
                            >
                              Save Template
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {filteredTemplates.length === 0 && !isAddingTemplate ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">You don't have any email templates yet.</p>
                      <Button 
                        onClick={() => {
                          setIsAddingTemplate(true);
                          setNewTemplate({
                            ...newTemplate,
                            type: "email"
                          });
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Create Your First Template
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTemplates.map(template => (
                        <Card key={template.id} className={template.isDefault ? "border-primary shadow-sm" : ""}>
                          <CardHeader className="pb-2 flex flex-row items-start justify-between">
                            <div>
                              <CardTitle className="text-lg flex items-center">
                                {template.name}
                                {template.isDefault && (
                                  <Badge className="ml-2 bg-primary text-primary-foreground">Default</Badge>
                                )}
                              </CardTitle>
                              <CardDescription>{template.subject}</CardDescription>
                            </div>
                            <div className="flex space-x-1">
                              {!template.isDefault && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleSetDefault(template.id, template.type)}
                                  title="Set as default"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m19 9-7 7-7-7"></path></svg>
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingTemplate(template.id)}
                                title="Edit template"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-destructive"
                                title="Delete template"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {editingTemplate === template.id ? (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-name-${template.id}`}>Template Name</Label>
                                  <Input 
                                    id={`edit-name-${template.id}`}
                                    value={template.name}
                                    onChange={(e) => {
                                      const updatedTemplates = templates.map(t => 
                                        t.id === template.id ? {...t, name: e.target.value} : t
                                      );
                                      queryClient.setQueryData(["/api/message-templates"], updatedTemplates);
                                    }}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-subject-${template.id}`}>Email Subject</Label>
                                  <Input 
                                    id={`edit-subject-${template.id}`}
                                    value={template.subject || ""}
                                    onChange={(e) => {
                                      const updatedTemplates = templates.map(t => 
                                        t.id === template.id ? {...t, subject: e.target.value} : t
                                      );
                                      queryClient.setQueryData(["/api/message-templates"], updatedTemplates);
                                    }}
                                  />
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-content-${template.id}`}>Email Content</Label>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    Use variables like {"{first_name}"}, {"{address}"}, {"{date}"}, etc.
                                  </div>
                                  <Textarea 
                                    id={`edit-content-${template.id}`}
                                    value={template.content}
                                    onChange={(e) => {
                                      const updatedTemplates = templates.map(t => 
                                        t.id === template.id ? {...t, content: e.target.value} : t
                                      );
                                      queryClient.setQueryData(["/api/message-templates"], updatedTemplates);
                                    }}
                                    rows={8}
                                  />
                                </div>
                                
                                <div className="flex justify-end space-x-2 pt-2">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setEditingTemplate(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      const editedTemplate = templates.find(t => t.id === template.id);
                                      if (editedTemplate) {
                                        handleSaveTemplate(editedTemplate);
                                      }
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm whitespace-pre-wrap">{template.content}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {!isAddingTemplate && filteredTemplates.length > 0 && filteredTemplates.length < (isPro ? 10 : 3) && (
                    <div className="flex justify-center">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setIsAddingTemplate(true);
                          setNewTemplate({
                            ...newTemplate,
                            type: "email"
                          });
                        }}
                        disabled={!isPro && filteredTemplates.length >= 3}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Add Another Template
                      </Button>
                    </div>
                  )}
                  
                  {!isPro && filteredTemplates.length >= 3 && (
                    <div className="bg-muted p-4 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground flex items-center justify-center">
                        <Lock className="h-4 w-4 mr-2" /> 
                        Free accounts are limited to 3 templates. Upgrade to Pro for unlimited templates.
                      </p>
                      <Link href="/upgrade">
                        <Button className="mt-2" variant="default">
                          Upgrade to Pro
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}