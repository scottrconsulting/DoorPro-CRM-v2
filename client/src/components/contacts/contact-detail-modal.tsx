import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { getStatusBadgeConfig } from "@/lib/status-helpers";
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
  InsertSchedule
} from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    mutationFn: async (scheduleData: any) => { // Using any temporarily until we fix imports
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
  
  // Upload document mutation (placeholder for now)
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
  
  // Create visit mutation
  const createVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", "/api/visits", visitData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
    },
    onError: (error) => {
      console.error("Failed to create visit record", error);
    }
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      const res = await apiRequest("PUT", `/api/contacts/${contactId}`, contactData);
      return res.json();
    },
    onSuccess: (updatedContact) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      // Create a visit record when a contact is updated
      if (contact && updatedContact.status !== contact.status) {
        // Status has changed, log a visit
        createVisitMutation.mutate({
          contactId: contactId,
          userId: contact.userId,
          visitType: "follow_up",
          visitDate: new Date(),
          notes: `Status changed from ${contact.status} to ${updatedContact.status}`,
          outcome: updatedContact.status
        });
      }
      
      setIsEditMode(false);
      toast({
        title: "Contact updated",
        description: "Contact information was successfully updated",
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
      const res = await apiRequest("DELETE", `/api/contacts/${contactId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact was successfully deleted",
      });
      onClose(); // Close the modal after deletion
    },
    onError: (error) => {
      toast({
        title: "Failed to delete contact",
        description: "There was an error deleting the contact",
        variant: "destructive",
      });
    },
  });
  
  // Initialize edit form when contact data is loaded
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

  // Format date
  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  };

  // Format time from now
  const timeFromNow = (date: string | Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  // Handle save note
  const handleSaveNote = () => {
    if (!note.trim()) {
      toast({
        title: "Note cannot be empty",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    addVisitMutation.mutate({
      contactId,
      userId: contact?.userId || 0,
      visitType: "note",
      notes: note,
      visitDate: new Date(),
    });
  };

  // Handle schedule follow-up
  const handleScheduleFollowUp = () => {
    const startTime = new Date(`${followUpDate}T${followUpTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    // Create schedule data in the expected format
    scheduleFollowUpMutation.mutate({
      userId: contact?.userId || 0,
      title: `Follow-up with ${contact?.fullName}`,
      description: `${followUpReason} at ${contact?.address}`,
      startTime: startTime.toISOString(), // Convert Date objects to ISO strings
      endTime: endTime.toISOString(),     // Convert Date objects to ISO strings
      type: "follow_up",
      location: contact?.address || "",
      contactIds: [contactId],
      reminderSent: false,
      // We're not setting reminder time or confirmation methods as those features are hidden
    });
  };
  
  // Handle save sale
  const handleSaveSale = () => {
    if (!saleProduct.trim() || !saleAmount) {
      toast({
        title: "Required fields missing",
        description: "Please enter a product name and amount",
        variant: "destructive",
      });
      return;
    }
    
    addSaleMutation.mutate({
      contactId,
      userId: contact?.userId || 0,
      amount: parseFloat(saleAmount),
      product: saleProduct,
      saleDate: new Date(saleDate),
      status: saleStatus,
      paymentMethod: salePaymentMethod,
      notes: saleNotes,
    });
  };
  
  // Handle save task
  const handleSaveTask = () => {
    if (!taskTitle.trim()) {
      toast({
        title: "Task title is required",
        description: "Please enter a title for the task",
        variant: "destructive",
      });
      return;
    }
    
    addTaskMutation.mutate({
      contactId,
      userId: contact?.userId || 0,
      title: taskTitle,
      description: taskDescription,
      dueDate: new Date(taskDueDate),
      priority: taskPriority,
      status: "open",
    });
  };
  
  // Handle file selection for document upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setDocumentFile(e.target.files[0]);
    }
  };
  
  // Handle document upload
  const handleUploadDocument = () => {
    if (!documentName.trim() || !documentFile) {
      toast({
        title: "Required fields missing",
        description: "Please enter a document name and select a file",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("file", documentFile);
    formData.append("name", documentName);
    formData.append("category", documentCategory);
    formData.append("description", documentDescription);
    formData.append("userId", contact?.userId.toString() || "0");
    formData.append("contactId", contactId.toString());
    
    uploadDocumentMutation.mutate(formData);
  };
  
  // Handle edit button click
  const handleEditButtonClick = () => {
    setIsEditMode(true);
  };
  
  // Handle address change and auto-fill city, state, zip
  const handleAddressChange = (address: string) => {
    setEditAddress(address);
    
    // Auto-fill city, state, zip using geocoding (simplified)
    if (address.trim().length > 10) {
      geocodeAddress(address)
        .then((result) => {
          if (result) {
            setEditCity(result.city || editCity);
            setEditState(result.state || editState);
            setEditZipCode(result.zipCode || editZipCode);
          }
        })
        .catch((error) => {
          console.error("Geocoding error:", error);
        });
    }
  };
  
  // Handle save contact changes
  const handleSaveEditedContact = () => {
    if (!editName.trim() || !editAddress.trim()) {
      toast({
        title: "Required fields missing",
        description: "Please enter a name and address",
        variant: "destructive",
      });
      return;
    }
    
    updateContactMutation.mutate({
      fullName: editName,
      address: editAddress,
      city: editCity,
      state: editState,
      zipCode: editZipCode,
      phone: editPhone,
      email: editEmail,
      status: editStatus,
    });
  };
  
  // Status badge with color
  const getStatusBadge = (status: string) => {
    const config = getStatusBadgeConfig(status);
    return (
      <Badge 
        className="text-xs"
        variant="outline"
      >
        {config.label}
      </Badge>
    );
  };
  
  // Visit type badge
  const getVisitTypeBadge = (type: string) => {
    const badgeMap: Record<string, { label: string, variant: "default" | "outline" | "secondary" }> = {
      "initial": { label: "First Contact", variant: "secondary" },
      "follow_up": { label: "Follow-up", variant: "default" },
      "note": { label: "Note", variant: "outline" },
    };
    
    const config = badgeMap[type] || { label: "Note", variant: "outline" };
    
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loading contact details...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contact not found</DialogTitle>
          </DialogHeader>
          <p className="py-6 text-center">The requested contact could not be found.</p>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-xl">Contact Details</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 p-0">
          {/* Contact Info Header Section - Full Width */}
          <div className="bg-neutral-100 p-8 border-b">
            <div className="flex items-center">
              <div className="h-24 w-24 bg-primary text-white rounded-full flex items-center justify-center">
                <span className="material-icons text-4xl">person</span>
              </div>
              <div className="ml-6">
                <h2 className="font-bold text-2xl text-neutral-800">{contact.fullName}</h2>
                <div className="flex items-center mt-2">
                  <span className="text-neutral-600">Added {timeFromNow(contact.createdAt)}</span>
                  <div className="mx-4">•</div>
                  <div>{getStatusBadge(contact.status)}</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div>
                <div className="text-base font-medium text-neutral-600 mb-2">Address</div>
                <div className="flex items-start">
                  <span className="material-icons mt-1 mr-2 text-neutral-500">home</span>
                  <div>
                    <div className="text-base font-medium">{contact.address}</div>
                    {contact.city || contact.state ? (
                      <div className="text-base text-neutral-700">
                        {contact.city ? `${contact.city}, ` : ''}
                        {contact.state || ''} 
                        {contact.zipCode ? ` ${contact.zipCode}` : ''}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              
              {contact.phone && (
                <div>
                  <div className="text-base font-medium text-neutral-600 mb-2">Phone</div>
                  <div className="flex items-center">
                    <span className="material-icons mr-2 text-neutral-500">phone</span>
                    <span className="text-base">{contact.phone}</span>
                  </div>
                </div>
              )}
              
              {contact.email && (
                <div>
                  <div className="text-base font-medium text-neutral-600 mb-2">Email</div>
                  <div className="flex items-center">
                    <span className="material-icons mr-2 text-neutral-500">email</span>
                    <span className="text-base">{contact.email}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Tabs Section */}
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid grid-cols-5 w-full">
                <TabsTrigger value="notes" className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="sales" className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Sales
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex items-center">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center">
                  <File className="h-4 w-4 mr-2" />
                  Documents
                </TabsTrigger>
              </TabsList>
                
              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-neutral-800">Add Note</h3>
                  </div>
                  <div className="border border-neutral-200 rounded-lg p-3">
                    <Textarea
                      className="w-full min-h-[100px] resize-y"
                      rows={4}
                      placeholder="Add notes about this contact..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        onClick={handleSaveNote}
                        disabled={addVisitMutation.isPending}
                        size="sm"
                      >
                        {addVisitMutation.isPending ? "Saving..." : "Save Note"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-neutral-800">Visit History</h3>
                  </div>
                  {isLoadingVisits ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="border border-neutral-200 rounded-lg p-4 text-center">
                      <p className="text-neutral-500">No visit history yet</p>
                    </div>
                  ) : (
                    <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200 max-h-[400px] overflow-y-auto">
                      {visits
                        .sort((a, b) => 
                          new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                        )
                        .map((visit) => (
                          <div key={visit.id} className="p-4 hover:bg-neutral-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="text-sm font-medium">
                                  {visit.visitType === "initial" ? "First Contact" : 
                                   visit.visitType === "follow_up" ? "Follow-up Visit" : 
                                   "Note"}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {formatDate(visit.visitDate)}
                                </div>
                              </div>
                              {getVisitTypeBadge(visit.visitType)}
                            </div>
                            <p className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{visit.notes}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule Follow-up</CardTitle>
                    <CardDescription>Arrange a meeting or call with this contact</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="scheduleDate">Date</Label>
                        <Input
                          id="scheduleDate"
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="scheduleTime">Time</Label>
                        <Input
                          id="scheduleTime"
                          type="time"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="scheduleType">Type</Label>
                      <Select value={followUpReason} onValueChange={setFollowUpReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select meeting type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product_presentation">Product Presentation</SelectItem>
                          <SelectItem value="follow_up">Follow-up Call</SelectItem>
                          <SelectItem value="video_call">Video Call</SelectItem>
                          <SelectItem value="contract_signing">Contract Signing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      onClick={handleScheduleFollowUp}
                      disabled={scheduleFollowUpMutation.isPending}
                    >
                      {scheduleFollowUpMutation.isPending ? "Scheduling..." : "Schedule Follow-up"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Sales Tab */}
              <TabsContent value="sales" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Record a Sale</CardTitle>
                    <CardDescription>Track purchases and sales information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="saleProduct">Product/Service</Label>
                        <Input
                          id="saleProduct"
                          placeholder="Product or service name"
                          value={saleProduct}
                          onChange={(e) => setSaleProduct(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="saleAmount">Amount</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5">$</span>
                          <Input
                            id="saleAmount"
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="pl-8"
                            value={saleAmount}
                            onChange={(e) => setSaleAmount(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="saleDate">Sale Date</Label>
                        <Input
                          id="saleDate"
                          type="date"
                          value={saleDate}
                          onChange={(e) => setSaleDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="saleStatus">Status</Label>
                        <Select value={saleStatus} onValueChange={setSaleStatus}>
                          <SelectTrigger id="saleStatus">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="canceled">Canceled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="salePaymentMethod">Payment Method</Label>
                      <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                        <SelectTrigger id="salePaymentMethod">
                          <SelectValue placeholder="Select payment method" />
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
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="saleNotes">Notes</Label>
                      <Textarea
                        id="saleNotes"
                        placeholder="Additional notes about this sale"
                        value={saleNotes}
                        onChange={(e) => setSaleNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      onClick={handleSaveSale}
                      disabled={addSaleMutation.isPending}
                    >
                      {addSaleMutation.isPending ? "Saving..." : "Record Sale"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Create Task</CardTitle>
                    <CardDescription>Add a task related to this contact</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="taskTitle">Title</Label>
                      <Input
                        id="taskTitle"
                        placeholder="Task title"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="taskDescription">Description</Label>
                      <Textarea
                        id="taskDescription"
                        placeholder="Task description"
                        value={taskDescription}
                        onChange={(e) => setTaskDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="taskDueDate">Due Date</Label>
                        <Input
                          id="taskDueDate"
                          type="date"
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
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
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      onClick={handleSaveTask}
                      disabled={addTaskMutation.isPending}
                    >
                      {addTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Document</CardTitle>
                    <CardDescription>Attach documents related to this contact</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="documentName">Document Name</Label>
                      <Input
                        id="documentName"
                        placeholder="Document name"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="documentCategory">Category</Label>
                      <Select value={documentCategory} onValueChange={setDocumentCategory}>
                        <SelectTrigger id="documentCategory">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="documentDescription">Description</Label>
                      <Textarea
                        id="documentDescription"
                        placeholder="Document description"
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="documentFile">File</Label>
                      <Input
                        id="documentFile"
                        type="file"
                        onChange={handleFileSelect}
                        className="pt-1.5"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      onClick={handleUploadDocument}
                      disabled={uploadDocumentMutation.isPending}
                    >
                      {uploadDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
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
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="editZipCode" className="text-base font-medium">Zip Code</Label>
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
                  <Label htmlFor="editPhone" className="text-base font-medium">Phone</Label>
                  <Input 
                    id="editPhone" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)} 
                    className="mt-2 h-11 text-base"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editEmail" className="text-base font-medium">Email</Label>
                  <Input 
                    id="editEmail" 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    className="mt-2 h-11 text-base"
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
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="presented">Presented</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="check_back">Check Back</SelectItem>
                    <SelectItem value="no_soliciting">No Soliciting</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditMode(false)}
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