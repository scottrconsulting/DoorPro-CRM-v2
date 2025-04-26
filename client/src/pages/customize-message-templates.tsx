import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  Check,
  Code,
  Edit,
  Eye,
  FileText,
  Info,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

interface MessageTemplateFormData {
  id?: number;
  name: string;
  type: "email" | "text";
  subject?: string;
  body: string;
  isDefault: boolean;
  isHtml?: boolean;
}

export default function CustomizeMessageTemplates() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPro = user?.role === "pro" || user?.role === "admin";
  
  // State for template management
  const [activeTab, setActiveTab] = useState<"email" | "text">("text");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplateFormData | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  
  // Fetch user's message templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
    staleTime: 60000,
    enabled: !!user
  });
  
  // Create default templates if needed
  useEffect(() => {
    if (templates.length === 0 && isPro && !isLoadingTemplates) {
      // Create default text template
      if (templates.filter(template => template.type === 'text').length === 0) {
        createTemplate({
          name: "Welcome Message",
          type: "text",
          body: "Hello {{name}}, thank you for your interest! We'll be following up with more information soon.",
          isDefault: true
        });
      }
      
      // Create default email template
      if (templates.filter(template => template.type === 'email').length === 0) {
        createTemplate({
          name: "Welcome Email",
          type: "email",
          subject: "Thank you for your interest!",
          body: "<h2>Hello {{name}},</h2><p>Thank you for your interest in our products/services! We'll be following up with more information soon.</p><p>Best regards,<br>{{user}}</p>",
          isDefault: true,
          isHtml: true
        });
      }
    }
  }, [templates, isPro, isLoadingTemplates]);

  // Filter templates by type
  const textTemplates = Array.isArray(templates) ? templates.filter(template => template.type === 'text') : [];
  const emailTemplates = Array.isArray(templates) ? templates.filter(template => template.type === 'email') : [];
  
  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: MessageTemplateFormData) => {
      const res = await apiRequest("POST", "/api/message-templates", templateData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template created",
        description: "Your message template has been created successfully.",
      });
      setIsFormOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, templateData }: { id: number, templateData: Partial<MessageTemplateFormData> }) => {
      const res = await apiRequest("PUT", `/api/message-templates/${id}`, templateData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template updated",
        description: "Your message template has been updated successfully.",
      });
      setIsFormOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/message-templates/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template deleted",
        description: "Your message template has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setDeleteTemplateId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Helper function to create new template
  const createTemplate = (templateData: MessageTemplateFormData) => {
    createTemplateMutation.mutate(templateData);
  };
  
  // Helper function to update existing template
  const updateTemplate = (id: number, templateData: Partial<MessageTemplateFormData>) => {
    updateTemplateMutation.mutate({ id, templateData });
  };
  
  // Helper function to delete template
  const deleteTemplate = (id: number) => {
    deleteTemplateMutation.mutate(id);
  };
  
  // Helper function to set a template as default
  const setAsDefault = (template: MessageTemplate) => {
    if (template.isDefault === true) return; // Already default
    
    updateTemplate(template.id, { isDefault: true });
  };
  
  // Open form to create a new template
  const openNewTemplateForm = () => {
    setEditingTemplate({
      name: "",
      type: activeTab,
      subject: activeTab === "email" ? "" : undefined,
      body: "",
      isDefault: false,
      isHtml: activeTab === "email" ? true : undefined,
    });
    setIsFormOpen(true);
  };
  
  // Open form to edit an existing template
  const openEditTemplateForm = (template: MessageTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      type: template.type as "email" | "text",
      subject: template.subject || undefined,
      body: template.body,
      isDefault: template.isDefault === null ? false : template.isDefault,
      isHtml: template.isHtml === null ? undefined : template.isHtml,
    });
    setIsFormOpen(true);
  };
  
  // Open preview dialog for a template
  const openPreviewDialog = (template: MessageTemplate) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (id: number) => {
    setDeleteTemplateId(id);
    setIsDeleteDialogOpen(true);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTemplate) return;
    
    // Validate form
    if (!editingTemplate.name.trim()) {
      toast({
        title: "Invalid form",
        description: "Template name is required.",
        variant: "destructive",
      });
      return;
    }
    
    if (!editingTemplate.body.trim()) {
      toast({
        title: "Invalid form",
        description: "Template body is required.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingTemplate.type === "email" && !editingTemplate.subject?.trim()) {
      toast({
        title: "Invalid form",
        description: "Email subject is required.",
        variant: "destructive",
      });
      return;
    }
    
    // Basic HTML validation for email templates with HTML
    if (editingTemplate.type === "email" && editingTemplate.isHtml && !editingTemplate.body.includes('<')) {
      toast({
        title: "Invalid HTML",
        description: "HTML templates must contain valid HTML markup.",
        variant: "destructive",
      });
      return;
    }
    
    if (editingTemplate.id) {
      // Update existing template
      updateTemplate(editingTemplate.id, editingTemplate);
    } else {
      // Create new template
      createTemplate(editingTemplate);
    }
  };
  
  // Check if user has reached the template limit (for free accounts)
  const hasReachedTemplateLimit = !isPro && templates.length >= 3;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground">
            Create and manage your message templates for email and text communications.
          </p>
        </div>
        
        {!isPro && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Badge variant="outline" className="ml-2 gap-1 py-1 border-yellow-500">
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="text-yellow-700">Free Plan: {templates.length}/3 templates</span>
                  </Badge>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Free plan allows up to 3 message templates total.</p>
                <p>Upgrade to Pro for unlimited templates.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "email" | "text")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="text" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Text Messages</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Email Messages</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="text" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Text Message Templates</CardTitle>
                <CardDescription>
                  Manage templates for text messages sent to contacts.
                </CardDescription>
              </div>
              <Button 
                onClick={openNewTemplateForm}
                disabled={hasReachedTemplateLimit}
                className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Template</span>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : textTemplates.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/20">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <h3 className="text-lg font-medium">No text templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first text message template to get started.
                  </p>
                  <Button 
                    onClick={openNewTemplateForm}
                    disabled={hasReachedTemplateLimit}
                    className="flex items-center gap-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    <span>Add Template</span>
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Name</TableHead>
                        <TableHead>Message Preview</TableHead>
                        <TableHead className="w-[100px] text-center">Default</TableHead>
                        <TableHead className="w-[150px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {textTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {template.body.length > 80 
                              ? template.body.substring(0, 80) + "..." 
                              : template.body}
                          </TableCell>
                          <TableCell className="text-center">
                            {template.isDefault ? (
                              <Badge variant="default" className="gap-1">
                                <Star className="h-3 w-3" />
                                <span>Default</span>
                              </Badge>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setAsDefault(template)}
                                className="text-xs"
                              >
                                Set default
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openPreviewDialog(template)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditTemplateForm(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openDeleteDialog(template.id)}
                              disabled={template.isDefault}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Message Templates</CardTitle>
                <CardDescription>
                  Manage templates for emails sent to contacts.
                </CardDescription>
              </div>
              <Button 
                onClick={openNewTemplateForm}
                disabled={hasReachedTemplateLimit}
                className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Add Template</span>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingTemplates ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              ) : emailTemplates.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/20">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <h3 className="text-lg font-medium">No email templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first email template to get started.
                  </p>
                  <Button 
                    onClick={openNewTemplateForm}
                    disabled={hasReachedTemplateLimit}
                    className="flex items-center gap-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    <span>Add Template</span>
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Name</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="w-[80px] text-center">HTML</TableHead>
                        <TableHead className="w-[100px] text-center">Default</TableHead>
                        <TableHead className="w-[150px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailTemplates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {template.subject && (
                              template.subject.length > 50 
                                ? template.subject.substring(0, 50) + "..." 
                                : template.subject
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {template.isHtml ? (
                              <Badge variant="outline" className="bg-blue-50 border-blue-200">
                                <Code className="h-3 w-3 text-blue-500 mr-1" />
                                <span className="text-blue-700">HTML</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 border-gray-200">
                                <FileText className="h-3 w-3 text-gray-500 mr-1" />
                                <span className="text-gray-700">Text</span>
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {template.isDefault ? (
                              <Badge variant="default" className="gap-1">
                                <Star className="h-3 w-3" />
                                <span>Default</span>
                              </Badge>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setAsDefault(template)}
                                className="text-xs"
                              >
                                Set default
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openPreviewDialog(template)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openEditTemplateForm(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => openDeleteDialog(template.id)}
                              disabled={template.isDefault}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Template form dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? 'Edit Message Template' : 'Create Message Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate?.type === 'email' 
                ? 'Create or edit an email template to send to your contacts.' 
                : 'Create or edit a text message template to send to your contacts.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input 
                    id="name" 
                    value={editingTemplate?.name || ''} 
                    onChange={e => setEditingTemplate(prev => prev ? {...prev, name: e.target.value} : null)}
                    placeholder="Enter template name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="type">Template Type</Label>
                  <Select 
                    disabled={!!editingTemplate?.id} // Can't change type of existing template
                    value={editingTemplate?.type || 'text'} 
                    onValueChange={value => setEditingTemplate(prev => prev ? {...prev, type: value as "email" | "text"} : null)}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select template type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Message</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {editingTemplate?.type === 'email' && (
                  <div>
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input 
                      id="subject" 
                      value={editingTemplate?.subject || ''} 
                      onChange={e => setEditingTemplate(prev => prev ? {...prev, subject: e.target.value} : null)}
                      placeholder="Enter email subject"
                    />
                  </div>
                )}
                
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="isDefault" className="flex items-center gap-2">
                      Set as Default Template
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      This template will be used by default for {editingTemplate?.type} messages.
                    </span>
                  </div>
                  <Switch 
                    id="isDefault" 
                    checked={editingTemplate?.isDefault || false} 
                    onCheckedChange={checked => setEditingTemplate(prev => prev ? {...prev, isDefault: checked} : null)}
                  />
                </div>
                
                {editingTemplate?.type === 'email' && (
                  <div className="flex items-center justify-between space-x-2">
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor="isHtml" className="flex items-center gap-2">
                        Use HTML Formatting
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        Enable HTML formatting for rich email content.
                      </span>
                    </div>
                    <Switch 
                      id="isHtml" 
                      checked={editingTemplate?.isHtml || false} 
                      onCheckedChange={checked => setEditingTemplate(prev => prev ? {...prev, isHtml: checked} : null)}
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="body">Message Body</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Badge variant="outline" className="gap-1">
                              <Info className="h-3.5 w-3.5" />
                              <span>Variables</span>
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="font-semibold mb-1">Available variables:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li><code>{"{{name}}"}</code> - Contact's name</li>
                            <li><code>{"{{address}}"}</code> - Contact's address</li>
                            <li><code>{"{{date}}"}</code> - Current date</li>
                            <li><code>{"{{time}}"}</code> - Appointment time (if applicable)</li>
                            <li><code>{"{{user}}"}</code> - Your name</li>
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea 
                    id="body" 
                    value={editingTemplate?.body || ''} 
                    onChange={e => setEditingTemplate(prev => prev ? {...prev, body: e.target.value} : null)}
                    placeholder={editingTemplate?.type === 'email' && editingTemplate?.isHtml
                      ? '<h2>Hello {{name}},</h2><p>Your message here...</p>'
                      : 'Hello {{name}}, your message here...'
                    }
                    className="min-h-[200px] font-mono"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-1">
                {editingTemplate?.id ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Template preview dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Template Preview: {previewTemplate?.name}</span>
              <Badge variant={previewTemplate?.type === 'email' ? 'default' : 'secondary'} className="ml-2">
                {previewTemplate?.type === 'email' ? 'Email' : 'Text Message'}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              This is how your message will appear when sent to contacts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {previewTemplate?.type === 'email' && (
              <div>
                <Label className="text-sm text-muted-foreground">Subject:</Label>
                <div className="p-3 border rounded-md bg-muted/20">
                  {previewTemplate?.subject}
                </div>
              </div>
            )}
            
            <div>
              <Label className="text-sm text-muted-foreground">Body:</Label>
              {previewTemplate?.type === 'email' && previewTemplate?.isHtml ? (
                <div className="p-4 border rounded-md bg-white overflow-auto max-h-[300px]">
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
                </div>
              ) : (
                <div className="p-4 border rounded-md bg-muted/20 whitespace-pre-wrap">
                  {previewTemplate?.body}
                </div>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Note: Variables like <code>{"{{name}}"}</code> will be replaced with actual values when sent.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
            {previewTemplate && (
              <Button variant="outline" onClick={() => {
                openEditTemplateForm(previewTemplate);
                setIsPreviewOpen(false);
              }}>
                Edit Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              message template and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplateId && deleteTemplate(deleteTemplateId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}