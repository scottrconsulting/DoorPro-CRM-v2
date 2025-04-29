import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Contact, 
  Visit, 
  InsertVisit,
  Sale,
  InsertSale,
  Document,
  InsertDocument,
  Task,
  InsertTask
} from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import { X, Edit, MapPin, Phone, Mail, CalendarClock, DollarSign, FileText } from "lucide-react";
import ContactForm from "./contact-form";

interface ContactCardProps {
  contactId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactCard({ contactId, isOpen, onClose }: ContactCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("notes");
  const [note, setNote] = useState("");
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpReason, setFollowUpReason] = useState("");
  
  // Get contact details
  const { data: contact, isLoading, isError } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: contactId > 0 && isOpen,
  });

  // Get contact visits
  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: [`/api/contacts/${contactId}/visits`],
    enabled: contactId > 0 && isOpen,
  });

  // Get contact sales
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: [`/api/contacts/${contactId}/sales`],
    enabled: contactId > 0 && isOpen && activeTab === "sales",
  });

  // Get contact documents
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/contacts/${contactId}/documents`],
    enabled: contactId > 0 && isOpen && activeTab === "documents",
  });

  // Get contact tasks
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/contacts/${contactId}/tasks`],
    enabled: contactId > 0 && isOpen && activeTab === "tasks",
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (data: InsertVisit) => {
      const response = await apiRequest("POST", "/api/visits", data);
      return response.json();
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/visits`] });
      toast({
        title: "Note added",
        description: "Your note has been saved successfully",
      });
    },
    onError: (error) => {
      console.error("Error adding note:", error);
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create follow-up schedule
  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/schedules", data);
      return response.json();
    },
    onSuccess: () => {
      setFollowUpDate(format(new Date(), "yyyy-MM-dd"));
      setFollowUpTime("10:00");
      setFollowUpReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Follow-up scheduled",
        description: "Your follow-up has been scheduled successfully",
      });
    },
    onError: (error) => {
      console.error("Error scheduling follow-up:", error);
      toast({
        title: "Error",
        description: "Failed to schedule follow-up. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
      return id;
    },
    onSuccess: () => {
      toast({
        title: "Contact deleted",
        description: "The contact has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onClose();
    },
    onError: (error) => {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: "Failed to delete contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle adding a note
  const handleAddNote = () => {
    if (!note.trim()) {
      toast({
        title: "Empty note",
        description: "Please enter a note before saving",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id || !contactId) return;

    addNoteMutation.mutate({
      contactId,
      userId: user.id,
      visitType: "note",
      notes: note,
      outcome: "neutral",
      followUpNeeded: false,
      visitDate: new Date(),
    });
  };

  // Schedule a follow-up
  const handleScheduleFollowUp = () => {
    if (!user?.id || !contactId) return;

    const startDateTime = new Date(`${followUpDate}T${followUpTime}`);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30);

    createScheduleMutation.mutate({
      userId: user.id,
      title: `Follow-up with ${contact?.fullName}`,
      description: followUpReason || `Check back with contact`,
      startTime: startDateTime,
      endTime: endDateTime,
      type: "follow_up",
      location: contact?.address || "",
      reminderSent: false,
      contactIds: [contactId],
    });
  };

  // Handle contact edit
  const handleEditSuccess = (updatedContact: Contact) => {
    setShowEditForm(false);
    queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
  };

  // Format status for display
  const formatStatus = (status: string) => {
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked': return 'bg-blue-100 text-blue-800';
      case 'not_home': return 'bg-yellow-100 text-yellow-800';
      case 'no_answer': return 'bg-pink-100 text-pink-800';
      case 'not_interested': return 'bg-red-100 text-red-800';
      case 'check_back': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'presented': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <div className="flex justify-center items-center h-40">
            <div className="loader">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isError || !contact) {
    return (
      <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent>
          <div className="text-center py-4">
            <h3 className="text-lg font-medium">Error</h3>
            <p className="text-sm text-gray-600 mt-2">
              Unable to load contact information. Please try again.
            </p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogTitle className="text-xl font-bold">{contact.fullName}</DialogTitle>
          
          {/* Status badge */}
          <div className="mb-4">
            <Badge className={getStatusBadge(contact.status)}>
              {formatStatus(contact.status)}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-4">
              {/* Contact information */}
              <div className="space-y-3">
                <h3 className="font-medium text-lg">Address</h3>
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 mt-1 mr-2 text-gray-500" />
                  <div>
                    <p className="text-sm">{contact.address}</p>
                    {contact.city && contact.state && (
                      <p className="text-sm text-gray-600">
                        {contact.city}, {contact.state} {contact.zipCode}
                      </p>
                    )}
                  </div>
                </div>
                
                {contact.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    <p className="text-sm">{contact.phone}</p>
                  </div>
                )}
                
                {contact.email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    <p className="text-sm">{contact.email}</p>
                  </div>
                )}
              </div>
              
              {/* Notes section */}
              <div>
                <h3 className="font-medium">Notes</h3>
                <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">
                  {contact.notes || "No notes available."}
                </p>
              </div>
              
              {/* Quick add note */}
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Add a Note</h4>
                <Textarea 
                  placeholder="Enter your note..." 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  className="h-24"
                />
                <Button 
                  onClick={handleAddNote} 
                  className="mt-2"
                  size="sm"
                >
                  Add Note
                </Button>
              </div>
            </div>
            
            <div className="md:col-span-2">
              <Tabs defaultValue="notes" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="notes">Notes & History</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                  <TabsTrigger value="sales">Sales</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>
                
                {/* Notes & History Tab */}
                <TabsContent value="notes">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Contact History</h3>
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {visits.length > 0 ? (
                        visits.map((visit) => (
                          <div 
                            key={visit.id} 
                            className="p-3 border border-gray-200 rounded-md"
                          >
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">
                                {visit.visitDate && format(new Date(visit.visitDate), "MMM d, yyyy h:mm a")}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {visit.visitType?.split("_").map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(" ")}
                              </Badge>
                            </div>
                            <p className="text-sm mt-1">{visit.notes}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No history available for this contact.</p>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                {/* Schedule Tab */}
                <TabsContent value="schedule">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Schedule a Follow-up</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="followup-date">Date</Label>
                        <Input 
                          id="followup-date" 
                          type="date" 
                          value={followUpDate} 
                          onChange={(e) => setFollowUpDate(e.target.value)} 
                        />
                      </div>
                      <div>
                        <Label htmlFor="followup-time">Time</Label>
                        <Input 
                          id="followup-time" 
                          type="time" 
                          value={followUpTime} 
                          onChange={(e) => setFollowUpTime(e.target.value)} 
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="followup-reason">Reason</Label>
                      <Textarea 
                        id="followup-reason" 
                        placeholder="Reason for follow-up..." 
                        value={followUpReason} 
                        onChange={(e) => setFollowUpReason(e.target.value)} 
                      />
                    </div>
                    <Button onClick={handleScheduleFollowUp}>
                      <CalendarClock className="h-4 w-4 mr-2" />
                      Schedule Follow-up
                    </Button>
                  </div>
                </TabsContent>
                
                {/* Sales Tab */}
                <TabsContent value="sales">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Sales</h3>
                      <Button size="sm" variant="outline">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Record Sale
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {sales.length > 0 ? (
                        sales.map((sale) => (
                          <div 
                            key={sale.id} 
                            className="p-3 border border-gray-200 rounded-md"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">{sale.product}</span>
                              <span className="font-bold">${sale.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-gray-500">
                                {sale.saleDate && format(new Date(sale.saleDate), "MMM d, yyyy")}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {sale.status || "Completed"}
                              </Badge>
                            </div>
                            {sale.notes && <p className="text-sm mt-1">{sale.notes}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No sales recorded for this contact.</p>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                {/* Tasks Tab */}
                <TabsContent value="tasks">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Tasks</h3>
                      <Button size="sm" variant="outline">
                        <FileText className="h-4 w-4 mr-1" />
                        Add Task
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {tasks.length > 0 ? (
                        tasks.map((task) => (
                          <div 
                            key={task.id} 
                            className="p-3 border border-gray-200 rounded-md"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">{task.title}</span>
                              <Badge 
                                variant={task.completed ? "default" : "secondary"} 
                                className={`text-xs ${task.completed ? "bg-green-100 text-green-800" : ""}`}
                              >
                                {task.completed ? "Completed" : "Pending"}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Due: {task.dueDate && format(new Date(task.dueDate), "MMM d, yyyy")}
                            </div>
                            {task.description && <p className="text-sm mt-1">{task.description}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No tasks associated with this contact.</p>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          
          {/* Footer with buttons */}
          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <div className="flex gap-2">
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete Contact
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowEditForm(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Contact
              </Button>
            </div>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Contact Form */}
      {contact && (
        <ContactForm
          isOpen={showEditForm}
          onClose={() => setShowEditForm(false)}
          initialContact={contact}
          onSuccess={handleEditSuccess}
          isEditMode={true}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (contact) {
                  deleteContactMutation.mutate(contact.id);
                }
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}