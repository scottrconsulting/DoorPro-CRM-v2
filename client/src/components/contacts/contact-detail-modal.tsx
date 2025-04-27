import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { 
  Contact, 
  Visit, 
  InsertVisit, 
  Sale, 
  InsertSale,
  Task,
  InsertTask,
  Document,
  InsertDocument
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
import { useToast } from "@/hooks/use-toast";

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
    mutationFn: async (scheduleData: any) => {
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
      visitDate: new Date().toISOString(),
    });
  };

  // Handle schedule follow-up
  const handleScheduleFollowUp = () => {
    const startTime = new Date(`${followUpDate}T${followUpTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    scheduleFollowUpMutation.mutate({
      userId: contact?.userId || 0,
      title: `Follow-up with ${contact?.fullName}`,
      description: `${followUpReason} at ${contact?.address}`,
      startTime,
      endTime,
      type: "follow_up",
      contactIds: [contactId],
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
      status: "pending",
    });
  };
  
  // Handle edit contact
  const handleEditButtonClick = () => {
    setIsEditMode(true);
  };
  
  // Handle save edited contact
  const handleSaveEditedContact = () => {
    if (!editName.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter a name for the contact",
        variant: "destructive",
      });
      return;
    }
    
    if (!editAddress.trim()) {
      toast({
        title: "Address is required",
        description: "Please enter an address for the contact",
        variant: "destructive",
      });
      return;
    }
    
    updateContactMutation.mutate({
      fullName: editName,
      address: editAddress,
      city: editCity || null,
      state: editState || null,
      zipCode: editZipCode || null,
      phone: editPhone || null,
      email: editEmail || null,
      status: editStatus,
    });
  };
  
  // Helper to auto-populate address components when address changes
  const handleAddressChange = async (newAddress: string) => {
    setEditAddress(newAddress);
    
    try {
      // Only attempt geocoding if the address has enough content
      if (newAddress.trim().length > 5) {
        const geocoded = await geocodeAddress(newAddress);
        if (geocoded) {
          // Auto-populate city, state, and zip code fields
          if (geocoded.city) {
            setEditCity(geocoded.city);
          }
          if (geocoded.state) {
            setEditState(geocoded.state);
          }
          if (geocoded.zipCode) {
            setEditZipCode(geocoded.zipCode);
          }
        }
      }
    } catch (error) {
      console.error("Error geocoding address:", error);
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Generate status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      interested: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Interested",
      },
      not_interested: {
        bg: "bg-red-100",
        text: "text-red-800",
        label: "Not interested",
      },
      converted: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Converted",
      },
      considering: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Considering",
      },
    };

    const { bg, text, label } = config[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Get visit type badge
  const getVisitTypeBadge = (type: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      initial: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Initial Visit",
      },
      follow_up: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Follow-up",
      },
      note: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Note",
      },
    };

    const { bg, text, label } = config[type] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: type,
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Loading state
  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Loading contact details...</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Contact not found</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>The requested contact could not be found.</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle>Contact Details</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 p-4 pb-20">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/3 mb-4 md:mb-0">
              <div className="bg-neutral-100 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="h-16 w-16 bg-primary text-white rounded-full flex items-center justify-center">
                    <span className="material-icons text-2xl">person</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-neutral-800">{contact.fullName}</h3>
                    <p className="text-sm text-neutral-600">
                      Added {timeFromNow(contact.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-neutral-500 mb-1">Contact Info</div>
                  <div className="text-sm mb-2">
                    <span className="material-icons text-xs align-text-bottom mr-1">home</span>
                    {contact.address}
                    {contact.city || contact.state ? (
                      <div className="ml-5 mt-1 text-xs text-neutral-600">
                        {contact.city ? `${contact.city}, ` : ''}
                        {contact.state || ''} 
                        {contact.zipCode ? ` ${contact.zipCode}` : ''}
                      </div>
                    ) : null}
                  </div>
                  {contact.phone && (
                    <div className="text-sm mb-2">
                      <span className="material-icons text-xs align-text-bottom mr-1">phone</span>
                      {contact.phone}
                    </div>
                  )}
                  {contact.email && (
                    <div className="text-sm">
                      <span className="material-icons text-xs align-text-bottom mr-1">email</span>
                      {contact.email}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-neutral-500 mb-1">Status</div>
                  {getStatusBadge(contact.status)}
                </div>
              </div>
            </div>

            <div className="md:w-2/3 md:pl-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4 grid grid-cols-5 w-full">
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
                        className="w-full"
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
                      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200">
                        {visits
                          .sort((a, b) => 
                            new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                          )
                          .map((visit) => (
                            <div key={visit.id} className="p-3">
                              <div className="flex justify-between items-start">
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
                              <p className="text-sm text-neutral-600 mt-1">{visit.notes}</p>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="refunded">Refunded</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="salePaymentMethod">Payment Method</Label>
                        <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
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
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button 
                        onClick={handleSaveSale}
                        disabled={addSaleMutation.isPending}
                      >
                        {addSaleMutation.isPending ? "Recording..." : "Record Sale"}
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-neutral-800">Sales History</h3>
                    {isLoadingSales ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : sales.length === 0 ? (
                      <div className="border border-neutral-200 rounded-lg p-4 text-center">
                        <p className="text-neutral-500">No sales recorded yet</p>
                      </div>
                    ) : (
                      <div className="border border-neutral-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-neutral-200">
                          <thead className="bg-neutral-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-neutral-200">
                            {sales.map((sale) => (
                              <tr key={sale.id}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-700">
                                  {format(new Date(sale.saleDate), "MMM d, yyyy")}
                                </td>
                                <td className="px-4 py-2 text-sm text-neutral-700">{sale.product}</td>
                                <td className="px-4 py-2 text-sm text-neutral-700 font-medium">{formatCurrency(sale.amount)}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <Badge
                                    variant={
                                      sale.status === "completed" ? "default" :
                                      sale.status === "pending" ? "outline" :
                                      "destructive"
                                    }
                                    className="text-xs"
                                  >
                                    {sale.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                {/* Tasks Tab */}
                <TabsContent value="tasks" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Add Task</CardTitle>
                      <CardDescription>Schedule follow-up tasks related to this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="taskTitle">Task Title</Label>
                        <Input
                          id="taskTitle"
                          placeholder="What needs to be done?"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="taskDescription">Description</Label>
                        <Textarea
                          id="taskDescription"
                          placeholder="Add task details"
                          value={taskDescription}
                          onChange={(e) => setTaskDescription(e.target.value)}
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
                            <SelectTrigger>
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
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-neutral-800">Open Tasks</h3>
                    {isLoadingTasks ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : tasks.filter(task => !task.completed).length === 0 ? (
                      <div className="border border-neutral-200 rounded-lg p-4 text-center">
                        <p className="text-neutral-500">No open tasks</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tasks
                          .filter(task => !task.completed)
                          .sort((a, b) => 
                            (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0)
                          )
                          .map((task) => (
                            <div key={task.id} className="border border-neutral-200 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-base font-medium flex items-center">
                                    <span 
                                      className={`h-2 w-2 rounded-full mr-2 ${
                                        task.priority === 'high' ? 'bg-red-500' :
                                        task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                      }`}
                                    ></span>
                                    {task.title}
                                  </div>
                                  <div className="text-xs text-neutral-500 mt-1">
                                    Due: {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "No due date"}
                                  </div>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => completeTaskMutation.mutate(task.id)}
                                  disabled={completeTaskMutation.isPending}
                                >
                                  Complete
                                </Button>
                              </div>
                              {task.description && (
                                <p className="text-sm text-neutral-600 mt-2">{task.description}</p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                {/* Documents Tab */}
                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Upload Document</CardTitle>
                      <CardDescription>Store important files related to this contact</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="documentName">Document Name</Label>
                          <Input
                            id="documentName"
                            placeholder="Contract.pdf"
                            value={documentName}
                            onChange={(e) => setDocumentName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="documentCategory">Category</Label>
                          <Select value={documentCategory} onValueChange={setDocumentCategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="invoice">Invoice</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="id">ID Document</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="documentDescription">Description</Label>
                        <Textarea
                          id="documentDescription"
                          placeholder="Brief description of this document"
                          value={documentDescription}
                          onChange={(e) => setDocumentDescription(e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="documentFile">File</Label>
                        <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center hover:bg-neutral-50 transition-colors">
                          <Upload className="mx-auto h-8 w-8 text-neutral-400" />
                          <p className="mt-2 text-sm text-neutral-600">
                            Drag and drop a file, or click to browse
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            PDF, DOCX, XLSX, JPG, PNG up to 10MB
                          </p>
                          <Input
                            id="documentFile"
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setDocumentFile(e.target.files[0]);
                                setDocumentName(e.target.files[0].name);
                              }
                            }}
                          />
                          <Button 
                            variant="outline" 
                            className="mt-2" 
                            onClick={() => document.getElementById('documentFile')?.click()}
                          >
                            Select File
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button disabled>
                        Upload Document
                      </Button>
                    </CardFooter>
                  </Card>
                  
                  <div className="space-y-2">
                    <h3 className="font-medium text-neutral-800">Documents</h3>
                    {isLoadingDocuments ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="border border-neutral-200 rounded-lg p-4 text-center">
                        <p className="text-neutral-500">No documents uploaded yet</p>
                      </div>
                    ) : (
                      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200">
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-3 flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="mr-3 text-neutral-500">
                                {doc.fileType?.includes('pdf') ? (
                                  <FileText className="h-8 w-8" />
                                ) : doc.fileType?.includes('image') ? (
                                  <FileText className="h-8 w-8" />
                                ) : (
                                  <File className="h-8 w-8" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{doc.fileName}</p>
                                <p className="text-xs text-neutral-500">
                                  {format(new Date(doc.uploadDate), "MMM d, yyyy")} • {doc.category}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <span className="material-icons text-neutral-500 text-sm">download</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {isEditMode ? (
          <div className="border-t border-neutral-200 p-4">
            <h3 className="font-medium text-lg mb-4">Edit Contact</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Full Name</Label>
                <Input 
                  id="editName" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="editAddress">Street Address</Label>
                <Input 
                  id="editAddress" 
                  value={editAddress} 
                  onChange={(e) => handleAddressChange(e.target.value)} 
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="editCity">City</Label>
                  <Input 
                    id="editCity" 
                    value={editCity} 
                    onChange={(e) => setEditCity(e.target.value)} 
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editState">State</Label>
                  <Select value={editState} onValueChange={setEditState}>
                    <SelectTrigger id="editState" className="mt-1">
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
                  <Label htmlFor="editZipCode">Zip Code</Label>
                  <Input 
                    id="editZipCode" 
                    value={editZipCode} 
                    onChange={(e) => setEditZipCode(e.target.value)} 
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input 
                    id="editPhone" 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)} 
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editEmail">Email</Label>
                  <Input 
                    id="editEmail" 
                    value={editEmail} 
                    onChange={(e) => setEditEmail(e.target.value)} 
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="editStatus">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="editStatus" className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_visited">Not visited</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="not_interested">Not interested</SelectItem>
                    <SelectItem value="considering">Considering</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="no_soliciting">No soliciting</SelectItem>
                    <SelectItem value="call_back">Call back</SelectItem>
                    <SelectItem value="appointment_scheduled">Appointment scheduled</SelectItem>
                    <SelectItem value="no_answer">No answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditMode(false)}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEditedContact}
                  disabled={updateContactMutation.isPending}
                >
                  {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-t border-neutral-200 px-4 py-3 flex justify-between">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center"
                onClick={handleEditButtonClick}
              >
                <span className="material-icons text-sm mr-1">edit</span>
                Edit Contact
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ${contact.fullName}?`)) {
                    deleteContactMutation.mutate();
                  }
                }}
                disabled={deleteContactMutation.isPending}
              >
                <span className="material-icons text-sm mr-1">delete</span>
                {deleteContactMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
