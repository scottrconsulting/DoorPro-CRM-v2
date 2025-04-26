import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MessageTemplate {
  id?: number;
  userId: number;
  type: string; // "email" or "text"
  name: string;
  subject?: string; // Only for email
  body: string;
  isDefault: boolean;
  isHtml?: boolean; // Only for email
}

export default function CustomizeMessageTemplates() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("text");
  
  // Text message template state
  const [textTemplates, setTextTemplates] = useState<MessageTemplate[]>([]);
  const [newTextTemplate, setNewTextTemplate] = useState<MessageTemplate>({
    userId: 0,
    type: "text",
    name: "",
    body: "",
    isDefault: false
  });
  
  // Email template state
  const [emailTemplates, setEmailTemplates] = useState<MessageTemplate[]>([]);
  const [newEmailTemplate, setNewEmailTemplate] = useState<MessageTemplate>({
    userId: 0,
    type: "email",
    name: "",
    subject: "",
    body: "",
    isDefault: false,
    isHtml: true
  });
  
  // Get user's existing templates
  const { data: templates, isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
    onSuccess: (data) => {
      const textMessages = data.filter(template => template.type === "text");
      const emailMessages = data.filter(template => template.type === "email");
      setTextTemplates(textMessages);
      setEmailTemplates(emailMessages);
    }
  });
  
  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: MessageTemplate) => {
      const res = await apiRequest("POST", "/api/message-templates", templateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template saved",
        description: "Your message template has been saved successfully",
      });
      
      // Reset form
      if (activeTab === "text") {
        setNewTextTemplate({
          userId: 0,
          type: "text",
          name: "",
          body: "",
          isDefault: false
        });
      } else {
        setNewEmailTemplate({
          userId: 0,
          type: "email",
          name: "",
          subject: "",
          body: "",
          isDefault: false,
          isHtml: true
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error saving template",
        description: "There was a problem saving your template",
        variant: "destructive",
      });
    },
  });
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, templateData }: { id: number, templateData: MessageTemplate }) => {
      const res = await apiRequest("PATCH", `/api/message-templates/${id}`, templateData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template updated",
        description: "Your message template has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating template",
        description: "There was a problem updating your template",
        variant: "destructive",
      });
    },
  });
  
  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/message-templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({
        title: "Template deleted",
        description: "Your message template has been deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting template",
        description: "There was a problem deleting your template",
        variant: "destructive",
      });
    },
  });
  
  // Handle text template form change
  const handleTextTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewTextTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle email template form change
  const handleEmailTemplateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewEmailTemplate(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Create a new template
  const handleCreateTemplate = () => {
    const templateData = activeTab === "text" ? newTextTemplate : newEmailTemplate;
    createTemplateMutation.mutate({
      ...templateData,
      userId: 1 // This should be the actual userId from auth
    });
  };
  
  // Set a template as default
  const handleSetDefault = (id: number, type: string) => {
    const templates = type === "text" ? textTemplates : emailTemplates;
    const template = templates.find(t => t.id === id);
    
    if (template) {
      updateTemplateMutation.mutate({
        id,
        templateData: {
          ...template,
          isDefault: true
        }
      });
      
      // Set all other templates of this type to not default
      templates.forEach(t => {
        if (t.id !== id && t.isDefault) {
          updateTemplateMutation.mutate({
            id: t.id!,
            templateData: {
              ...t,
              isDefault: false
            }
          });
        }
      });
    }
  };
  
  // Delete a template
  const handleDeleteTemplate = (id: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplateMutation.mutate(id);
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Customize Message Templates</h1>
      </div>
      
      <Tabs defaultValue="text" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="text">Text Messages</TabsTrigger>
          <TabsTrigger value="email">Email Messages</TabsTrigger>
        </TabsList>
        
        <TabsContent value="text">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create new text template */}
            <Card>
              <CardHeader>
                <CardTitle>New Text Message Template</CardTitle>
                <CardDescription>
                  Create a new template for text message confirmations and reminders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textName">Template Name</Label>
                  <Input
                    id="textName"
                    name="name"
                    value={newTextTemplate.name}
                    onChange={handleTextTemplateChange}
                    placeholder="Appointment Confirmation"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="textBody">Message Text</Label>
                  <Textarea
                    id="textBody"
                    name="body"
                    value={newTextTemplate.body}
                    onChange={handleTextTemplateChange}
                    placeholder="Hi {name}, your appointment is scheduled for {date} at {time}. Reply Y to confirm or N to reschedule."
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {"{name}"}, {"{date}"}, {"{time}"}, {"{address}"} as placeholders that will be replaced with actual values.
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="textDefault"
                    checked={newTextTemplate.isDefault}
                    onCheckedChange={(checked) => {
                      setNewTextTemplate(prev => ({
                        ...prev,
                        isDefault: checked
                      }));
                    }}
                  />
                  <Label htmlFor="textDefault">Set as default template</Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending}>
                  {createTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Existing text templates */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saved Templates</h3>
              {isLoading ? (
                <div className="flex justify-center my-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              ) : textTemplates.length > 0 ? (
                textTemplates.map(template => (
                  <Card key={template.id} className={template.isDefault ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.isDefault && (
                          <span className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">Default</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{template.body}</p>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      {!template.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefault(template.id!, "text")}
                        >
                          Set as Default
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id!)}
                      >
                        Delete
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground">No saved text templates yet.</p>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="email">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create new email template */}
            <Card>
              <CardHeader>
                <CardTitle>New Email Template</CardTitle>
                <CardDescription>
                  Create a new template for email confirmations and reminders with rich formatting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emailName">Template Name</Label>
                  <Input
                    id="emailName"
                    name="name"
                    value={newEmailTemplate.name}
                    onChange={handleEmailTemplateChange}
                    placeholder="Appointment Confirmation"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="emailSubject">Email Subject</Label>
                  <Input
                    id="emailSubject"
                    name="subject"
                    value={newEmailTemplate.subject}
                    onChange={handleEmailTemplateChange}
                    placeholder="Your appointment confirmation"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="emailBody">Email Body</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isHtml"
                        checked={newEmailTemplate.isHtml}
                        onCheckedChange={(checked) => {
                          setNewEmailTemplate(prev => ({
                            ...prev,
                            isHtml: checked
                          }));
                        }}
                      />
                      <Label htmlFor="isHtml" className="text-xs">HTML Format</Label>
                    </div>
                  </div>
                  <Textarea
                    id="emailBody"
                    name="body"
                    value={newEmailTemplate.body}
                    onChange={handleEmailTemplateChange}
                    placeholder={newEmailTemplate.isHtml ? 
                      "<h2>Hello {name},</h2><p>Your appointment is scheduled for <strong>{date}</strong> at <strong>{time}</strong>.</p>" : 
                      "Hello {name},\n\nYour appointment is scheduled for {date} at {time}."
                    }
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use {"{name}"}, {"{date}"}, {"{time}"}, {"{address}"} as placeholders that will be replaced with actual values.
                    {newEmailTemplate.isHtml && " You can use HTML tags like <strong>, <p>, <ul>, etc. for formatting."}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="emailDefault"
                    checked={newEmailTemplate.isDefault}
                    onCheckedChange={(checked) => {
                      setNewEmailTemplate(prev => ({
                        ...prev,
                        isDefault: checked
                      }));
                    }}
                  />
                  <Label htmlFor="emailDefault">Set as default template</Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending}>
                  {createTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </CardFooter>
            </Card>
            
            {/* Existing email templates */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saved Templates</h3>
              {isLoading ? (
                <div className="flex justify-center my-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              ) : emailTemplates.length > 0 ? (
                emailTemplates.map(template => (
                  <Card key={template.id} className={template.isDefault ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex space-x-2">
                          {template.isHtml && (
                            <span className="bg-blue-100 text-blue-800 text-xs py-1 px-2 rounded-full">HTML</span>
                          )}
                          {template.isDefault && (
                            <span className="bg-primary/10 text-primary text-xs py-1 px-2 rounded-full">Default</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Subject: {template.subject}</p>
                    </CardHeader>
                    <CardContent>
                      {template.isHtml ? (
                        <div className="border p-3 rounded bg-gray-50 max-h-40 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: template.body }} />
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{template.body}</p>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      {!template.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefault(template.id!, "email")}
                        >
                          Set as Default
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id!)}
                      >
                        Delete
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <p className="text-muted-foreground">No saved email templates yet.</p>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}