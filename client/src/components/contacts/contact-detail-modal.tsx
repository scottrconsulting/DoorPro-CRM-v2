import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { getStatusBadgeConfig } from "@/lib/status-helpers";
import { cn } from "@/lib/utils";
import { 
  Contact, 
  Visit, 
  InsertVisit, 
  Sale, 
  InsertSale,
  Task,
  InsertTask,
  Document,
  InsertDocument,
  InsertSchedule,
  Schedule
} from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  CheckSquare, 
  File,
  Phone,
  Mail,
  Video,
  Upload,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// US States for dropdown
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

interface ContactDetailModalProps {
  contactId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactDetailModal({
  contactId,
  isOpen,
  onClose,
}: ContactDetailModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpReason, setFollowUpReason] = useState("follow_up");
  
  // Active tab state - ensure it's initialized with a valid value
  const [activeTab, setActiveTab] = useState<string>("notes");
  
  // Sale state
  const [saleAmount, setSaleAmount] = useState("");
  const [saleProduct, setSaleProduct] = useState("");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saleStatus, setSaleStatus] = useState("completed");
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");
  const [saleNotes, setSaleNotes] = useState("");
  
  // Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [taskPriority, setTaskPriority] = useState("medium");
  
  // Document state
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState("general");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  
  // Edit contact state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: isOpen,
  });

  // Fetch visit history
  const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({
    queryKey: [`/api/contacts/${contactId}/visits`],
    enabled: isOpen,
  });
  
  // Fetch sales
  const { data: sales = [], isLoading: isLoadingSales } = useQuery<Sale[]>({
    queryKey: [`/api/contacts/${contactId}/sales`],
    enabled: isOpen && activeTab === "sales",
  });
  
  // Fetch tasks
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: [`/api/contacts/${contactId}/tasks`],
    enabled: isOpen && activeTab === "tasks",
  });
  
  // Fetch documents
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: [`/api/contacts/${contactId}/documents`],
    enabled: isOpen && activeTab === "documents",
  });
  
  // Fetch schedules for this contact
  const { data: contactSchedules = [], isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
    enabled: isOpen && activeTab === "schedule",
    select: (data) => {
      // Filter schedules with contactIds including this contact
      return data.filter(schedule => 
        schedule.contactIds && 
        schedule.contactIds.includes(contactId)
      );
    }
  });

  // Add visit mutation
  const addVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/visits`, visitData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/visits`] });
      setNote("");
      toast({
        title: "Note added",
        description: "Your note was successfully added",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add note",
        description: "There was an error adding your note",
        variant: "destructive",
      });
    },
  });

  // Schedule follow-up mutation
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async (scheduleData: InsertSchedule) => {
      const res = await apiRequest("POST", "/api/schedules", scheduleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Follow-up scheduled",
        description: "Your follow-up was successfully scheduled",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to schedule follow-up",
        description: "There was an error scheduling your follow-up",
        variant: "destructive",
      });
    },
  });
  
  // Add sale mutation
  const addSaleMutation = useMutation({
    mutationFn: async (saleData: InsertSale) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/sales`, saleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/sales`] });
      // Reset form
      setSaleAmount("");
      setSaleProduct("");
      setSaleDate(format(new Date(), "yyyy-MM-dd"));
      setSaleStatus("completed");
      setSalePaymentMethod("cash");
      setSaleNotes("");
      
      toast({
        title: "Sale recorded",
        description: "The sale was successfully recorded",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to record sale",
        description: "There was an error recording the sale",
        variant: "destructive",
      });
    },
  });
  
  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (taskData: InsertTask) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/tasks`, taskData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
      // Reset form
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate(format(new Date(), "yyyy-MM-dd"));
      setTaskPriority("medium");
      
      toast({
        title: "Task created",
        description: "The task was successfully created",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create task",
        description: "There was an error creating the task",
        variant: "destructive",
      });
    },
  });
  
  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
      toast({
        title: "Task completed",
        description: "The task was marked as completed",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to complete task",
        description: "There was an error completing the task",
        variant: "destructive",
      });
    },
  });
  
  // Delete schedule functionality
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [showDeleteScheduleDialog, setShowDeleteScheduleDialog] = useState(false);
  
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${scheduleId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule deleted",
        description: "The schedule item has been deleted",
      });
      setShowDeleteScheduleDialog(false);
      setScheduleToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting schedule",
        description: "There was an error deleting the schedule. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle delete schedule
  const handleDeleteSchedule = (scheduleId: number) => {
    setScheduleToDelete(scheduleId);
    setShowDeleteScheduleDialog(true);
  };
  
  // Confirm delete schedule
  const confirmDeleteSchedule = () => {
    if (scheduleToDelete) {
      deleteScheduleMutation.mutate(scheduleToDelete);
    }
  };

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (documentData: FormData) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/documents`, documentData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/documents`] });
      // Reset form
      setDocumentName("");
      setDocumentCategory("general");
      setDocumentDescription("");
      setDocumentFile(null);
      
      toast({
        title: "Document uploaded",
        description: "The document was successfully uploaded",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to upload document",
        description: "There was an error uploading the document",
        variant: "destructive",
      });
    },
  });

  // Visit mutation for recording visit history
  const recordVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/visits`, visitData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/visits`] });
    },
    onError: (error) => {
      console.error("Failed to create visit record", error);
    }
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, contactData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
      setIsEditMode(false);
      
      toast({
        title: "Contact updated",
        description: "The contact was successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update contact",
        description: "There was an error updating the contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/contacts/${contactId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      // Close the modal
      onClose();
      
      toast({
        title: "Contact deleted",
        description: "The contact was successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete contact",
        description: "There was an error deleting the contact",
        variant: "destructive",
      });
    },
  });

  // Reset edit form when contact data changes
  useEffect(() => {
    if (contact) {
      setEditName(contact.fullName);
      setEditAddress(contact.address);
      setEditCity(contact.city || "");
      setEditState(contact.state || "");
      setEditZipCode(contact.zipCode || "");
      setEditPhone(contact.phone || "");
      setEditEmail(contact.email || "");
      setEditStatus(contact.status);
    }
  }, [contact]);

  // Handle address change (reset geocoding)
  const handleAddressChange = (value: string) => {
    setEditAddress(value);
  };

  const handleEditButtonClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    // Reset form to original values
    if (contact) {
      setEditName(contact.fullName);
      setEditAddress(contact.address);
      setEditCity(contact.city || "");
      setEditState(contact.state || "");
      setEditZipCode(contact.zipCode || "");
      setEditPhone(contact.phone || "");
      setEditEmail(contact.email || "");
      setEditStatus(contact.status);
    }
    setIsEditMode(false);
  };

  const handleSaveEditedContact = async () => {
    // Get geocoding data for the address
    let newLat = null;
    let newLng = null;
    
    try {
      const fullAddress = `${editAddress}, ${editCity}, ${editState} ${editZipCode}`;
      const geocodeResult = await geocodeAddress(fullAddress);
      if (geocodeResult) {
        newLat = geocodeResult.lat;
        newLng = geocodeResult.lng;
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    }
    
    const contactData = {
      fullName: editName,
      address: editAddress,
      city: editCity,
      state: editState,
      zipCode: editZipCode,
      phone: editPhone,
      email: editEmail,
      status: editStatus,
      ...(newLat && newLng ? { latitude: newLat, longitude: newLng } : {}),
    };
    
    updateContactMutation.mutate(contactData);
  };

  // Handle note submission
  const handleNoteSubmit = () => {
    if (!note.trim()) return;
    
    const visitData: InsertVisit = {
      contactId,
      type: "note",
      notes: note,
      timestamp: new Date().toISOString(),
    };
    
    addVisitMutation.mutate(visitData);
  };

  // Handle follow-up scheduling
  const handleScheduleFollowUp = () => {
    const [year, month, day] = followUpDate.split('-').map(n => parseInt(n));
    const [hour, minute] = followUpTime.split(':').map(n => parseInt(n));
    
    const startDateTime = new Date(Date.UTC(year, month - 1, day, hour, minute));
    const endDateTime = new Date(startDateTime);
    endDateTime.setHours(endDateTime.getHours() + 1);
    
    // Prepare schedule data
    const scheduleData: InsertSchedule = {
      title: `Follow-up with ${contact?.fullName}`,
      type: followUpReason,
      userId: contact?.userId || 0,  // Assuming current user is the contact owner
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      contactIds: [contactId],
      location: contact?.address,
    };
    
    scheduleFollowUpMutation.mutate(scheduleData);
    
    // Also record this as a visit
    const visitData: InsertVisit = {
      contactId,
      type: "follow_up_scheduled",
      notes: `Follow-up scheduled for ${format(startDateTime, "MMM d, yyyy h:mm a")}`,
      timestamp: new Date().toISOString(),
    };
    
    recordVisitMutation.mutate(visitData);
  };

  // Handle sale submission
  const handleSaleSubmit = () => {
    if (!saleAmount || !saleProduct) return;
    
    const [year, month, day] = saleDate.split('-').map(n => parseInt(n));
    const saleDateTime = new Date(Date.UTC(year, month - 1, day));
    
    const saleData: InsertSale = {
      contactId,
      amount: parseFloat(saleAmount),
      product: saleProduct,
      date: saleDateTime.toISOString(),
      status: saleStatus,
      paymentMethod: salePaymentMethod,
      notes: saleNotes,
    };
    
    addSaleMutation.mutate(saleData);
    
    // Also record this as a visit
    const visitData: InsertVisit = {
      contactId,
      type: "sale",
      notes: `Sale recorded: $${saleAmount} - ${saleProduct}`,
      timestamp: new Date().toISOString(),
    };
    
    recordVisitMutation.mutate(visitData);
  };

  // Handle task submission
  const handleTaskSubmit = () => {
    if (!taskTitle) return;
    
    const [year, month, day] = taskDueDate.split('-').map(n => parseInt(n));
    const dueDateTime = new Date(Date.UTC(year, month - 1, day));
    
    const taskData: InsertTask = {
      contactId,
      title: taskTitle,
      description: taskDescription,
      dueDate: dueDateTime.toISOString(),
      priority: taskPriority,
      status: "pending",
    };
    
    addTaskMutation.mutate(taskData);
  };

  // Handle document upload
  const handleDocumentUpload = () => {
    if (!documentName || !documentFile) return;
    
    const formData = new FormData();
    formData.append("name", documentName);
    formData.append("category", documentCategory);
    formData.append("description", documentDescription || "");
    formData.append("file", documentFile);
    
    uploadDocumentMutation.mutate(formData);
  };

  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="p-6 text-center">
            <h3 className="font-semibold text-xl">Contact Not Found</h3>
            <p className="mt-2 text-neutral-600">The requested contact could not be found.</p>
            <Button className="mt-4" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Get badge styles based on status
  const statusConfig = getStatusBadgeConfig(contact.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto px-0">
        <div className="px-6 pb-2 pt-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">{contact.fullName}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge 
                  className={cn(
                    "h-6",
                    statusConfig.bgColor,
                    statusConfig.textColor
                  )}
                >
                  {statusConfig.label}
                </Badge>
                
                {contact.lastVisited && (
                  <Badge variant="outline" className="text-neutral-600 border-neutral-300">
                    Last visited: {formatDistanceToNow(new Date(contact.lastVisited), { addSuffix: true })}
                  </Badge>
                )}
                
                {contact.source && (
                  <Badge variant="outline" className="text-neutral-600 border-neutral-300">
                    Source: {contact.source}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Contact info sidebar - 1/3 width on large screens, full width on small */}
            <div className="lg:w-1/3 space-y-6">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 mt-0.5 text-neutral-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-neutral-700 mb-0.5">Address</p>
                        <a 
                          href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline block"
                        >
                          {contact.address}
                          {contact.city && `, ${contact.city}`}
                          {contact.state && `, ${contact.state}`}
                          {contact.zipCode && ` ${contact.zipCode}`}
                        </a>
                      </div>
                    </div>
                    
                    {contact.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-neutral-700 mb-0.5">Phone</p>
                          <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {contact.email && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm text-neutral-700 mb-0.5">Email</p>
                          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                            {contact.email}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {contact.notes && (
                    <div className="px-4 py-3 border-t border-neutral-200">
                      <p className="font-medium text-sm text-neutral-700 mb-1">Notes</p>
                      <p className="text-sm text-neutral-600">{contact.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Main content area - 2/3 width on large screens, full width on small */}
            <div className="lg:w-2/3">
              <Tabs defaultValue="notes" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="notes">
                    <FileText className="h-4 w-4 mr-2" />
                    Notes & History
                  </TabsTrigger>
                  <TabsTrigger value="schedule">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </TabsTrigger>
                  <TabsTrigger value="sales">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Sales
                  </TabsTrigger>
                  <TabsTrigger value="tasks">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    <File className="h-4 w-4 mr-2" />
                    Documents
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="notes">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact History</CardTitle>
                      <CardDescription>Recent interactions and notes for this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Add Note form */}
                      <div className="space-y-3">
                        <Label htmlFor="note">Add a Note</Label>
                        <Textarea 
                          id="note" 
                          placeholder="Enter your note..." 
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="min-h-20"
                        />
                        <Button 
                          className="w-full sm:w-auto mt-2" 
                          onClick={handleNoteSubmit}
                          disabled={!note.trim() || addVisitMutation.isPending}
                        >
                          {addVisitMutation.isPending ? "Adding..." : "Add Note"}
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="text-lg font-medium">Schedule a Follow-up</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="followUpDate">Date</Label>
                            <Input 
                              id="followUpDate"
                              type="date"
                              value={followUpDate}
                              onChange={(e) => setFollowUpDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="followUpTime">Time</Label>
                            <Input 
                              id="followUpTime"
                              type="time"
                              value={followUpTime}
                              onChange={(e) => setFollowUpTime(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="followUpReason">Reason</Label>
                          <Select value={followUpReason} onValueChange={setFollowUpReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="follow_up">General Follow-up</SelectItem>
                              <SelectItem value="appointment">Appointment</SelectItem>
                              <SelectItem value="presentation">Presentation</SelectItem>
                              <SelectItem value="demo">Product Demo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={handleScheduleFollowUp}
                          disabled={scheduleFollowUpMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {scheduleFollowUpMutation.isPending ? "Scheduling..." : "Schedule Follow-up"}
                        </Button>
                      </div>
                      
                      {/* Visit history timeline */}
                      {visits.length > 0 && (
                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">History Timeline</h3>
                          <div className="space-y-4">
                            {visits
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                              .map((visit) => (
                                <div key={visit.id} className="border-l-2 border-neutral-300 pl-4 pb-4 relative">
                                  <div className="w-3 h-3 rounded-full bg-neutral-400 absolute -left-[7px] top-0"></div>
                                  <div className="text-sm text-neutral-500 mb-1">
                                    {format(new Date(visit.timestamp), "MMM d, yyyy")} at {format(new Date(visit.timestamp), "h:mm a")}
                                  </div>
                                  <div className="font-medium mb-1">
                                    {visit.type === "note" && "Note Added"}
                                    {visit.type === "visit" && "In-Person Visit"}
                                    {visit.type === "call" && "Phone Call"}
                                    {visit.type === "email" && "Email Sent"}
                                    {visit.type === "follow_up_scheduled" && "Follow-up Scheduled"}
                                    {visit.type === "sale" && "Sale Completed"}
                                  </div>
                                  {visit.notes && <div className="text-neutral-700">{visit.notes}</div>}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {isLoadingVisits && (
                        <div className="flex justify-center my-6">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      
                      {!isLoadingVisits && visits.length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          <p>No history recorded yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="schedule">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upcoming Schedule</CardTitle>
                      <CardDescription>View and manage scheduled appointments and follow-ups</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {contactSchedules
                          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          .map((schedule) => (
                            <div 
                              key={schedule.id} 
                              className={cn(
                                "border-l-4 px-3 py-2 rounded-r-md relative shadow-sm",
                                schedule.type === "route" && "border-blue-500 bg-blue-50",
                                (schedule.type === "follow_up" || schedule.type === "follow-up") && "border-green-500 bg-green-50",
                                schedule.type === "appointment" && "border-yellow-500 bg-yellow-50",
                                schedule.type === "presentation" && "border-purple-500 bg-purple-50"
                              )}
                            >
                              {/* Delete button */}
                              <button 
                                className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 focus:outline-none z-10"
                                onClick={() => handleDeleteSchedule(schedule.id)}
                                aria-label="Delete schedule item"
                              >
                                <span className="material-icons text-sm">delete</span>
                              </button>
                              
                              <div className="pr-6"> {/* Added padding right to make room for delete button */}
                                <div className="font-medium">
                                  {schedule.title}
                                </div>
                                <div className="text-xs text-neutral-600 mb-1">
                                  {format(new Date(schedule.startTime), "MMM d, yyyy")} • {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                                </div>
                                {schedule.location && (
                                  <div className="flex items-center text-sm text-neutral-600">
                                    <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <a 
                                      href={`https://maps.google.com/?q=${encodeURIComponent(schedule.location)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="truncate text-blue-600 hover:underline"
                                    >
                                      {schedule.location}
                                    </a>
                                  </div>
                                )}
                                {schedule.description && (
                                  <div className="mt-1 text-sm">{schedule.description}</div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                        {isLoadingSchedules && (
                          <div className="flex justify-center my-6">
                            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                          </div>
                        )}
                        
                        {!isLoadingSchedules && contactSchedules.length === 0 && (
                          <div className="text-center py-8 text-neutral-500">
                            <p>No scheduled appointments or follow-ups</p>
                            <p className="text-sm mt-1">Use the "Schedule a Follow-up" section in the Notes tab to add one</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="sales">
                  <Card>
                    <CardHeader>
                      <CardTitle>Sales</CardTitle>
                      <CardDescription>Record and track sales for this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Add Sale form */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="saleProduct">Product/Service</Label>
                            <Input 
                              id="saleProduct"
                              value={saleProduct}
                              onChange={(e) => setSaleProduct(e.target.value)}
                              placeholder="e.g. Premium Package"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="saleAmount">Amount ($)</Label>
                            <Input 
                              id="saleAmount"
                              type="number"
                              step="0.01"
                              value={saleAmount}
                              onChange={(e) => setSaleAmount(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="saleDate">Sale Date</Label>
                            <Input 
                              id="saleDate"
                              type="date"
                              value={saleDate}
                              onChange={(e) => setSaleDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="saleStatus">Status</Label>
                            <Select value={saleStatus} onValueChange={setSaleStatus}>
                              <SelectTrigger id="saleStatus">
                                <SelectValue placeholder="Select a status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="salePaymentMethod">Payment Method</Label>
                            <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                              <SelectTrigger id="salePaymentMethod">
                                <SelectValue placeholder="Select a method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="credit_card">Credit Card</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="saleNotes">Notes (Optional)</Label>
                          <Textarea 
                            id="saleNotes"
                            value={saleNotes}
                            onChange={(e) => setSaleNotes(e.target.value)}
                            placeholder="Any additional details about this sale..."
                          />
                        </div>
                        
                        <Button 
                          onClick={handleSaleSubmit}
                          disabled={!saleProduct || !saleAmount || addSaleMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {addSaleMutation.isPending ? "Recording..." : "Record Sale"}
                        </Button>
                      </div>
                      
                      {/* Sales history */}
                      {sales.length > 0 && (
                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">Sales History</h3>
                          <div className="space-y-4">
                            {sales
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((sale) => (
                                <div key={sale.id} className="border p-4 rounded-md">
                                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                    <div className="font-medium">{sale.product}</div>
                                    <div className="font-bold text-lg">${parseFloat(sale.amount.toString()).toFixed(2)}</div>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                                    <div className="text-neutral-600">
                                      {format(new Date(sale.date), "MMM d, yyyy")}
                                    </div>
                                    <div>
                                      <Badge 
                                        className={cn(
                                          sale.status === 'completed' && "bg-green-100 text-green-800",
                                          sale.status === 'pending' && "bg-yellow-100 text-yellow-800",
                                          sale.status === 'cancelled' && "bg-red-100 text-red-800"
                                        )}
                                      >
                                        {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                                      </Badge>
                                    </div>
                                    <div className="text-neutral-600">
                                      {sale.paymentMethod.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                    </div>
                                  </div>
                                  {sale.notes && <div className="text-sm text-neutral-600">{sale.notes}</div>}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {isLoadingSales && (
                        <div className="flex justify-center my-6">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      
                      {!isLoadingSales && sales.length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          <p>No sales recorded</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="tasks">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tasks</CardTitle>
                      <CardDescription>Manage tasks related to this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Add Task form */}
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label htmlFor="taskTitle">Task Title</Label>
                          <Input 
                            id="taskTitle"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder="e.g. Follow up on proposal"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="taskDueDate">Due Date</Label>
                            <Input 
                              id="taskDueDate"
                              type="date"
                              value={taskDueDate}
                              onChange={(e) => setTaskDueDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="taskPriority">Priority</Label>
                            <Select value={taskPriority} onValueChange={setTaskPriority}>
                              <SelectTrigger id="taskPriority">
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="taskDescription">Description (Optional)</Label>
                          <Textarea 
                            id="taskDescription"
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            placeholder="Additional details about this task..."
                          />
                        </div>
                        
                        <Button 
                          onClick={handleTaskSubmit}
                          disabled={!taskTitle || addTaskMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {addTaskMutation.isPending ? "Creating..." : "Create Task"}
                        </Button>
                      </div>
                      
                      {/* Task list */}
                      {tasks.length > 0 && (
                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">Task List</h3>
                          <div className="space-y-3">
                            {tasks
                              .sort((a, b) => {
                                // First sort by status (pending first)
                                if (a.status === 'pending' && b.status !== 'pending') return -1;
                                if (a.status !== 'pending' && b.status === 'pending') return 1;
                                // Then sort by date (earlier first)
                                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                              })
                              .map((task) => (
                                <div key={task.id} className="flex p-3 border rounded-md gap-3 relative">
                                  {task.status === 'completed' ? (
                                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                                      <CheckSquare className="h-4 w-4" />
                                    </div>
                                  ) : (
                                    <button 
                                      className="h-6 w-6 rounded-full bg-white border-2 border-neutral-300 flex items-center justify-center text-white hover:border-primary flex-shrink-0"
                                      onClick={() => completeTaskMutation.mutate(task.id)}
                                      disabled={completeTaskMutation.isPending}
                                      aria-label="Mark as completed"
                                    ></button>
                                  )}
                                  <div className="flex-1">
                                    <div className="flex flex-wrap justify-between gap-2">
                                      <div className={cn(
                                        "font-medium",
                                        task.status === 'completed' && "line-through text-neutral-500"
                                      )}>
                                        {task.title}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          className={cn(
                                            "text-xs",
                                            task.priority === 'low' && "bg-blue-100 text-blue-800",
                                            task.priority === 'medium' && "bg-yellow-100 text-yellow-800",
                                            task.priority === 'high' && "bg-red-100 text-red-800"
                                          )}
                                        >
                                          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                        </Badge>
                                        <span className="text-xs text-neutral-500">
                                          Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                                        </span>
                                      </div>
                                    </div>
                                    {task.description && (
                                      <div className={cn(
                                        "text-sm mt-1",
                                        task.status === 'completed' ? "text-neutral-400" : "text-neutral-600"
                                      )}>
                                        {task.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {isLoadingTasks && (
                        <div className="flex justify-center my-6">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      
                      {!isLoadingTasks && tasks.length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          <p>No tasks created yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="documents">
                  <Card>
                    <CardHeader>
                      <CardTitle>Documents</CardTitle>
                      <CardDescription>Upload and manage documents related to this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Document upload form */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="documentName">Document Name</Label>
                            <Input 
                              id="documentName"
                              value={documentName}
                              onChange={(e) => setDocumentName(e.target.value)}
                              placeholder="e.g. Sales Contract"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="documentCategory">Category</Label>
                            <Select value={documentCategory} onValueChange={setDocumentCategory}>
                              <SelectTrigger id="documentCategory">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="contract">Contract</SelectItem>
                                <SelectItem value="proposal">Proposal</SelectItem>
                                <SelectItem value="invoice">Invoice</SelectItem>
                                <SelectItem value="receipt">Receipt</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="documentDescription">Description (Optional)</Label>
                          <Textarea 
                            id="documentDescription"
                            value={documentDescription}
                            onChange={(e) => setDocumentDescription(e.target.value)}
                            placeholder="Additional information about this document..."
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <Label htmlFor="documentFile">Upload File</Label>
                          <Input 
                            id="documentFile"
                            type="file"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setDocumentFile(e.target.files[0]);
                              }
                            }}
                            className="py-1.5"
                          />
                        </div>
                        
                        <Button 
                          onClick={handleDocumentUpload}
                          disabled={!documentName || !documentFile || uploadDocumentMutation.isPending}
                          className="w-full sm:w-auto flex items-center"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
                        </Button>
                      </div>
                      
                      {/* Document list */}
                      {documents.length > 0 && (
                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">Uploaded Documents</h3>
                          <div className="space-y-3">
                            {documents
                              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                              .map((document) => (
                                <div key={document.id} className="p-3 border rounded-md">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                      <div className="h-10 w-10 rounded bg-neutral-100 flex items-center justify-center text-neutral-500 flex-shrink-0">
                                        <File className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <div className="font-medium">{document.name}</div>
                                        <div className="flex items-center text-sm text-neutral-500 mt-0.5">
                                          <Badge variant="outline" className="text-xs mr-2">
                                            {document.category.charAt(0).toUpperCase() + document.category.slice(1)}
                                          </Badge>
                                          <span>{format(new Date(document.createdAt), "MMM d, yyyy")}</span>
                                        </div>
                                        {document.description && (
                                          <div className="text-sm text-neutral-600 mt-1">{document.description}</div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <a 
                                      href={`/api/documents/${document.id}/download`}
                                      className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                                      download
                                    >
                                      <ArrowRight className="h-4 w-4 mr-1" />
                                      Download
                                    </a>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {isLoadingDocuments && (
                        <div className="flex justify-center my-6">
                          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      
                      {!isLoadingDocuments && documents.length === 0 && (
                        <div className="text-center py-8 text-neutral-500">
                          <p>No documents uploaded yet</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {isEditMode ? (
          <div className="p-6 border-t">
            <h3 className="font-semibold text-xl mb-6">Edit Contact</h3>
            <div className="space-y-6">
              <div>
                <Label htmlFor="editName" className="text-base font-medium">Full Name</Label>
                <Input 
                  id="editName" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="mt-2 h-11 text-base"
                />
              </div>
              
              <div>
                <Label htmlFor="editAddress" className="text-base font-medium">Street Address</Label>
                <Input 
                  id="editAddress" 
                  value={editAddress} 
                  onChange={(e) => handleAddressChange(e.target.value)} 
                  className="mt-2 h-11 text-base"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="editCity" className="text-base font-medium">City</Label>
                  <Input 
                    id="editCity" 
                    value={editCity} 
                    onChange={(e) => setEditCity(e.target.value)} 
                    className="mt-2 h-11 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="editState" className="text-base font-medium">State</Label>
                  <Select value={editState} onValueChange={setEditState}>
                    <SelectTrigger id="editState" className="mt-2 h-11 text-base">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="editZipCode" className="text-base font-medium">ZIP Code</Label>
                  <Input 
                    id="editZipCode" 
                    value={editZipCode} 
                    onChange={(e) => setEditZipCode(e.target.value)} 
                    className="mt-2 h-11 text-base"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="editPhone" className="text-base font-medium">Phone Number</Label>
                  <Input 
                    id="editPhone" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)} 
                    className="mt-2 h-11 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="editEmail" className="text-base font-medium">Email Address</Label>
                  <Input 
                    id="editEmail" 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    className="mt-2 h-11 text-base"
                    type="email"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="editStatus" className="text-base font-medium">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="editStatus" className="mt-2 h-11 text-base">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Contact</SelectItem>
                    <SelectItem value="not_home">Not Home</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="appointment">Appointment Set</SelectItem>
                    <SelectItem value="presentation">Presentation Done</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-wrap gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleCancelEdit}
                  className="h-11 px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveEditedContact}
                  disabled={updateContactMutation.isPending}
                  className="h-11 px-6"
                >
                  {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-neutral-200 px-6 py-4 flex justify-between">
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                className="flex items-center h-10"
                onClick={handleEditButtonClick}
              >
                <span className="material-icons text-sm mr-2">edit</span>
                Edit Contact
              </Button>
              <Button 
                variant="outline" 
                className="flex items-center h-10"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ${contact.fullName}?`)) {
                    deleteContactMutation.mutate();
                  }
                }}
                disabled={deleteContactMutation.isPending}
              >
                <span className="material-icons text-sm mr-2">delete</span>
                {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
            <Button className="h-10" onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}