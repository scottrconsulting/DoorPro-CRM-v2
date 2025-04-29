import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress, IGeocodingResult } from "@/lib/maps";
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
  ClipboardList,
  MapPin
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
        description: "Your document was successfully uploaded",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to upload document",
        description: "There was an error uploading your document",
        variant: "destructive",
      });
    },
  });

  // Import IGeocodingResult from maps.ts
  // Edit contact mutation
  const editContactMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contactId}`, contactData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setActiveTab("notes"); // Switch back to notes tab after edit

      toast({
        title: "Contact updated",
        description: "The contact information was successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update contact",
        description: "There was an error updating the contact information",
        variant: "destructive",
      });
    },
  });

  // Initialize edit form with contact data when it loads
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

  // Handle note form submission
  const handleNoteSubmit = async () => {
    if (!note.trim()) return;

    const visitData: InsertVisit = {
      contactId,
      userId: 1, // TODO: Get from auth context
      visitType: "note",
      notes: note,
      visitDate: new Date(),
    };

    addVisitMutation.mutate(visitData);
  };

  // Handle follow-up scheduling
  const handleScheduleFollowUp = async () => {
    const [year, month, day] = followUpDate.split('-').map(Number);
    const [hour, minute] = followUpTime.split(':').map(Number);

    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    // Add a visit record
    const visitData: InsertVisit = {
      contactId,
      userId: 1, // TODO: Get from auth context
      visitType: "follow_up_scheduled",
      notes: `Follow-up scheduled for ${format(startDate, "MMM d, yyyy 'at' h:mm a")}`,
      visitDate: new Date(),
    };

    addVisitMutation.mutate(visitData);

    // Schedule the follow-up
    const scheduleData: InsertSchedule = {
      title: `Follow-up with ${contact?.fullName}`,
      type: followUpReason,
      userId: 1, // TODO: Get from auth context
      startTime: startDate,
      endTime: endDate,
      location: contact?.address,
      description: note || undefined,
      contactIds: [contactId],
    };

    scheduleFollowUpMutation.mutate(scheduleData);
  };

  // Handle sale form submission
  const handleSaleSubmit = async () => {
    if (!saleProduct || !saleAmount) return;

    // Create a proper Date object from the selected date
    const selectedDate = new Date(saleDate + "T00:00:00");
    
    const saleData: InsertSale = {
      contactId,
      saleDate: selectedDate, // Send as Date object, server will handle conversion
      status: saleStatus,
      userId: 1, // TODO: Get from auth context
      amount: parseFloat(saleAmount),
      product: saleProduct,
      notes: saleNotes || null,
      paymentMethod: salePaymentMethod,
    };

    // Also add a visit record
    const visitData: InsertVisit = {
      contactId,
      userId: 1, // TODO: Get from auth context
      visitType: "sale",
      notes: `Sale recorded: ${saleProduct} for $${parseFloat(saleAmount).toFixed(2)}`,
      visitDate: new Date(),
    };

    try {
      console.log("Recording sale with date:", selectedDate);
      addVisitMutation.mutate(visitData);
      addSaleMutation.mutate(saleData);
    } catch (error) {
      console.error("Error recording sale:", error);
    }
  };

  // Handle task form submission
  const handleTaskSubmit = async () => {
    if (!taskTitle) return;

    const taskData: InsertTask = {
      contactId,
      userId: 1, // TODO: Get from auth context
      title: taskTitle,
      description: taskDescription || null,
      dueDate: new Date(taskDueDate),
      priority: taskPriority,
      status: "pending",
    };

    addTaskMutation.mutate(taskData);
  };

  // Handle document upload
  const handleDocumentUpload = async () => {
    if (!documentName || !documentFile) return;

    const formData = new FormData();
    formData.append("file", documentFile);
    formData.append("name", documentName);
    formData.append("category", documentCategory);
    formData.append("description", documentDescription || "");

    uploadDocumentMutation.mutate(formData);
  };

  // Handle document file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setDocumentFile(e.target.files[0]);
    }
  };

  // Handle edit contact form submission
  const handleEditContactSubmit = async () => {
    if (!editName || !editAddress) return;

    const contactData: Partial<Contact> = {
      fullName: editName,
      address: editAddress,
      city: editCity || null,
      state: editState || null,
      zipCode: editZipCode || null,
      phone: editPhone || null,
      email: editEmail || null,
      status: editStatus,
    };

    // If location data is provided, attempt to geocode
    if (contactData.address) {
      try {
        const geocodeResult: IGeocodingResult = await geocodeAddress(`${contactData.address}, ${contactData.city || ""}, ${contactData.state || ""} ${contactData.zipCode || ""}`);
        if (geocodeResult && geocodeResult.lat && geocodeResult.lng) {
          contactData.latitude = geocodeResult.lat;
          contactData.longitude = geocodeResult.lng;
        }
      } catch (error) {
        console.error("Failed to geocode address", error);
      }
    }

    editContactMutation.mutate(contactData);
  };

  // Enable cancel edit mode
  const handleCancelEdit = () => {
    // Switch back to notes tab
    setActiveTab("notes");
    
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
  };

  // Format address for display
  const getFormattedAddress = (contact: Contact): string => {
    const parts = [contact.address];
    if (contact.city) parts.push(contact.city);
    if (contact.state) {
      if (contact.zipCode) {
        parts.push(`${contact.state} ${contact.zipCode}`);
      } else {
        parts.push(contact.state);
      }
    } else if (contact.zipCode) {
      parts.push(contact.zipCode);
    }
    return parts.join(', ');
  };

  // Get status configuration for badges
  const statusConfig = contact ? getStatusBadgeConfig(contact.status) : { bg: "", text: "", label: "" };

  if (!isOpen) return null;

  // Loading state
  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <div className="flex justify-center items-center flex-grow">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-xl font-semibold mb-2">Contact Not Found</div>
            <p className="text-neutral-600">The contact you're looking for could not be found.</p>
            <Button className="mt-4" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Placeholder for delete function - needs proper implementation
  const handleContactDelete = (contact: Contact) => {
    //Implementation to delete contact goes here.
    console.log("Deleting contact:", contact);
    alert("Contact deleted - placeholder function"); // Replace with actual delete logic
  };

  let selectedContact = contact; // Assuming 'contact' is available in this scope

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="mb-4 relative">
          <div className="flex items-start justify-between">
            <div className="w-full pr-6">
              <DialogTitle className="text-xl sm:text-2xl font-bold break-words">{contact.fullName}</DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge 
                  className={cn(
                    "h-6",
                    statusConfig.bg,
                    statusConfig.text
                  )}
                >
                  {statusConfig.label}
                </Badge>

                {/* Last visit badge - commented out until lastVisited field is properly integrated
                {contact.lastVisited && (
                  <Badge variant="outline" className="text-neutral-600 border-neutral-300 text-xs">
                    Last: {formatDistanceToNow(new Date(contact.lastVisited), { addSuffix: true })}
                  </Badge>
                )}
                */}

                {contact.source && (
                  <Badge variant="outline" className="text-neutral-600 border-neutral-300 text-xs">
                    {contact.source}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-0 sm:px-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Contact info - full width on mobile, 1/3 on large screens */}
            <div className="lg:w-1/3 space-y-4">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-neutral-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-neutral-700 mb-0.5">Address</p>
                        <a 
                          href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline block text-sm break-words"
                        >
                          {contact.address}
                          {contact.city && `, ${contact.city}`}
                          {contact.state && `, ${contact.state}`}
                          {contact.zipCode && ` ${contact.zipCode}`}
                        </a>
                      </div>
                    </div>

                    {contact.phone && (
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-neutral-700 mb-0.5">Phone</p>
                          <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline text-sm break-words">
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {contact.email && (
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-neutral-700 mb-0.5">Email</p>
                          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm break-words">
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
                <TabsList className="mb-4 w-full overflow-x-auto flex justify-start no-scrollbar">
                  <TabsTrigger value="notes" className="flex-shrink-0">
                    <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline">Notes</span>
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="flex-shrink-0">
                    <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline">Schedule</span>
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="flex-shrink-0">
                    <DollarSign className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline">Sales</span>
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-shrink-0">
                    <CheckSquare className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline">Tasks</span>
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex-shrink-0">
                    <File className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline">Files</span>
                  </TabsTrigger>
                  <TabsTrigger value="edit" className="flex-shrink-0 ml-auto">
                    <span className="material-icons text-base mr-1 sm:mr-2">edit</span>
                    <span className="sm:inline">Edit Contact</span>
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
                              .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                              .map((visit) => (
                                <div key={visit.id} className="border-l-2 border-neutral-300 pl-4 pb-4 relative">
                                  <div className="w-3 h-3 rounded-full bg-neutral-400 absolute -left-[7px] top-0"></div>
                                  <div className="text-sm text-neutral-500 mb-1">
                                    {format(new Date(visit.visitDate), "MMM d, yyyy")} at {format(new Date(visit.visitDate), "h:mm a")}
                                  </div>
                                  <div className="font-medium mb-1">
                                    {visit.visitType === "note" && "Note Added"}
                                    {visit.visitType === "visit" && "In-Person Visit"}
                                    {visit.visitType === "call" && "Phone Call"}
                                    {visit.visitType === "email" && "Email Sent"}
                                    {visit.visitType === "follow_up_scheduled" && "Follow-up Scheduled"}
                                    {visit.visitType === "sale" && "Sale Completed"}
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
                                (schedule.type === "follow_up" || schedule.type === "follow_up") && "border-green-500 bg-green-50",
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
                      {/* Add Sale form - Simplified for mobile */}
                      <div className="space-y-3">
                        {/* Product and Amount responsive layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <Label htmlFor="saleProduct">Product</Label>
                            <Input 
                              id="saleProduct"
                              value={saleProduct}
                              onChange={(e) => setSaleProduct(e.target.value)}
                              placeholder="e.g. Premium Package"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="saleAmount">Amount</Label>
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

                        {/* Date and Payment Method - responsive grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="saleDate">Date</Label>
                            <Input 
                              id="saleDate"
                              type="date"
                              value={saleDate}
                              onChange={(e) => setSaleDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="salePaymentMethod">Payment Method</Label>
                            <Select value={salePaymentMethod} onValueChange={setSalePaymentMethod}>
                              <SelectTrigger id="salePaymentMethod" className="h-10">
                                <SelectValue placeholder="Select method" />
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
                        
                        {/* Status as a separate row with buttons for quick selection */}
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Button 
                              type="button"
                              size="sm"
                              variant={saleStatus === "completed" ? "default" : "outline"}
                              className={`flex-1 min-w-[80px] ${saleStatus === "completed" ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => setSaleStatus("completed")}
                            >
                              Completed
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={saleStatus === "pending" ? "default" : "outline"}
                              className={`flex-1 min-w-[80px] ${saleStatus === "pending" ? "bg-yellow-600 hover:bg-yellow-700" : ""}`}
                              onClick={() => setSaleStatus("pending")}
                            >
                              Pending
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={saleStatus === "cancelled" ? "default" : "outline"}
                              className={`flex-1 min-w-[80px] ${saleStatus === "cancelled" ? "bg-red-600 hover:bg-red-700" : ""}`}
                              onClick={() => setSaleStatus("cancelled")}
                            >
                              Cancelled
                            </Button>
                          </div>
                        </div>

                        {/* Optional Notes */}
                        <div className="space-y-1">
                          <Label htmlFor="saleNotes" className="flex items-center">
                            <span>Notes</span>
                            <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                          </Label>
                          <Textarea 
                            id="saleNotes"
                            value={saleNotes}
                            onChange={(e) => setSaleNotes(e.target.value)}
                            placeholder="Any additional details about this sale..."
                            className="h-20"
                          />
                        </div>

                        {/* Prominent Record Sale Button */}
                        <Button 
                          onClick={handleSaleSubmit}
                          disabled={!saleProduct || !saleAmount || addSaleMutation.isPending}
                          className="w-full mt-2"
                          size="lg"
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
                              .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
                              .map((sale) => (
                                <div key={sale.id} className="border p-4 rounded-md">
                                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                    <div className="font-medium">{sale.product}</div>
                                    <div className="font-bold text-lg">${parseFloat(sale.amount.toString()).toFixed(2)}</div>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-2">
                                    <div className="text-neutral-600">
                                      {format(new Date(sale.saleDate), "MMM d, yyyy")}
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
                                      {sale.paymentMethod && sale.paymentMethod.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
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
                      {/* Add Task form - Mobile friendly */}
                      <div className="space-y-3">
                        {/* Task Title - Full Width */}
                        <div className="space-y-1">
                          <Label htmlFor="taskTitle">Task Title</Label>
                          <Input 
                            id="taskTitle"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder="e.g. Follow up on proposal"
                          />
                        </div>

                        {/* Due Date - Full width on mobile, half on larger screens */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="taskDueDate">Due Date</Label>
                            <Input 
                              id="taskDueDate"
                              type="date"
                              value={taskDueDate}
                              onChange={(e) => setTaskDueDate(e.target.value)}
                            />
                          </div>
                          
                          {/* Priority - Responsive buttons */}
                          <div className="space-y-1">
                            <Label htmlFor="taskPriority">Priority</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Button 
                                type="button"
                                size="sm"
                                variant={taskPriority === "low" ? "default" : "outline"}
                                className={`flex-1 min-w-[60px] ${taskPriority === "low" ? "bg-green-600 hover:bg-green-700" : ""}`}
                                onClick={() => setTaskPriority("low")}
                              >
                                Low
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={taskPriority === "medium" ? "default" : "outline"}
                                className={`flex-1 min-w-[60px] ${taskPriority === "medium" ? "bg-yellow-600 hover:bg-yellow-700" : ""}`}
                                onClick={() => setTaskPriority("medium")}
                              >
                                Medium
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={taskPriority === "high" ? "default" : "outline"}
                                className={`flex-1 min-w-[60px] ${taskPriority === "high" ? "bg-red-600 hover:bg-red-700" : ""}`}
                                onClick={() => setTaskPriority("high")}
                              >
                                High
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Optional Description */}
                        <div className="space-y-1">
                          <Label htmlFor="taskDescription" className="flex items-center">
                            <span>Description</span>
                            <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                          </Label>
                          <Textarea 
                            id="taskDescription"
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            placeholder="Additional details about this task..."
                            className="h-20"
                          />
                        </div>

                        {/* Create Task Button */}
                        <Button 
                          onClick={handleTaskSubmit}
                          disabled={!taskTitle || addTaskMutation.isPending}
                          className="w-full mt-2"
                          size="lg"
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
                                if (a.dueDate && b.dueDate) {
                                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                }
                                return 0;
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
                                          {task.priority && task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                        </Badge>
                                        <span className="text-xs text-neutral-500">
                                          {task.dueDate && `Due: ${format(new Date(task.dueDate), "MMM d, yyyy")}`}
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
                      {/* Document upload form - Mobile friendly */}
                      <div className="space-y-3">
                        {/* Document Name - Full Width */}
                        <div className="space-y-1">
                          <Label htmlFor="documentName">Document Name</Label>
                          <Input 
                            id="documentName"
                            value={documentName}
                            onChange={(e) => setDocumentName(e.target.value)}
                            placeholder="e.g. Sales Contract"
                          />
                        </div>
                        
                        {/* Category with button selection */}
                        <div className="space-y-1">
                          <Label htmlFor="documentCategory">Category</Label>
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            {[
                              {value: 'contract', label: 'Contract'},
                              {value: 'proposal', label: 'Proposal'},
                              {value: 'invoice', label: 'Invoice'},
                              {value: 'receipt', label: 'Receipt'},
                              {value: 'form', label: 'Form'},
                              {value: 'general', label: 'General'}
                            ].map((category) => (
                              <Button 
                                key={category.value}
                                type="button"
                                size="sm"
                                variant={documentCategory === category.value ? "default" : "outline"}
                                className={`text-xs ${documentCategory === category.value ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                onClick={() => setDocumentCategory(category.value)}
                              >
                                {category.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        {/* File Upload */}
                        <div className="space-y-1 mt-3">
                          <Label htmlFor="documentFile" className="block">Upload File</Label>
                          <div className="mt-1 flex items-center">
                            <Label 
                              htmlFor="documentFile" 
                              className="flex-1 cursor-pointer border rounded-md p-3 text-center bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                              <Upload className="h-4 w-4" />
                              {documentFile ? documentFile.name : "Choose a file"}
                            </Label>
                            <Input 
                              id="documentFile"
                              type="file"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </div>
                        </div>
                        
                        {/* Optional Description */}
                        <div className="space-y-1 mt-2">
                          <Label htmlFor="documentDescription" className="flex items-center">
                            <span>Description</span>
                            <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                          </Label>
                          <Textarea 
                            id="documentDescription"
                            value={documentDescription}
                            onChange={(e) => setDocumentDescription(e.target.value)}
                            placeholder="Additional details about this document..."
                            className="h-20"
                          />
                        </div>
                        
                        {/* Upload Button */}
                        <Button 
                          onClick={handleDocumentUpload}
                          disabled={!documentName || !documentFile || uploadDocumentMutation.isPending}
                          className="w-full mt-3"
                          size="lg"
                        >
                          {uploadDocumentMutation.isPending ? (
                            <span className="flex items-center justify-center">
                              <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-r-transparent rounded-full"></span>
                              Uploading...
                            </span>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Document
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Document list */}
                      {documents.length > 0 && (
                        <div className="space-y-4 mt-8">
                          <h3 className="text-lg font-medium">Uploaded Documents</h3>
                          <div className="space-y-3">
                            {documents
                              .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
                              .map((document) => (
                                <div key={document.id} className="flex items-start p-3 border rounded-md gap-3">
                                  <div className="h-9 w-9 rounded bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                    <File className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap justify-between items-start gap-2">
                                      <div>
                                        <div className="font-medium text-blue-600 hover:underline truncate">
                                          <a href={document.filePath} target="_blank" rel="noopener noreferrer">
                                            {document.fileName}
                                          </a>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {document.category && (
                                            <Badge variant="outline">
                                              {document.category.charAt(0).toUpperCase() + document.category.slice(1)}
                                            </Badge>
                                          )}
                                          <span className="text-xs text-neutral-500">
                                            Uploaded: {format(new Date(document.uploadDate), "MMM d, yyyy")}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {document.description && (
                                      <div className="text-sm text-neutral-600 mt-1">{document.description}</div>
                                    )}
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

                {/* Edit Contact Tab */}
                <TabsContent value="edit">
                  <Card>
                    <CardHeader>
                      <CardTitle>Edit Contact</CardTitle>
                      <CardDescription>Update contact information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Contact Name */}
                      <div className="space-y-1">
                        <Label htmlFor="editName">Full Name</Label>
                        <Input 
                          id="editName"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Contact's full name"
                        />
                      </div>

                      {/* Contact Address - Full width */}
                      <div className="space-y-1">
                        <Label htmlFor="editAddress">Street Address</Label>
                        <Input 
                          id="editAddress"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          placeholder="Street address"
                        />
                      </div>
                      
                      {/* City, State and Zip in a responsive grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="editCity">City</Label>
                          <Input 
                            id="editCity"
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                            placeholder="City"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="editState">State</Label>
                          <Select 
                            value={editState} 
                            onValueChange={setEditState}
                          >
                            <SelectTrigger id="editState">
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
                        <div className="space-y-1">
                          <Label htmlFor="editZipCode">Zip Code</Label>
                          <Input 
                            id="editZipCode"
                            value={editZipCode}
                            onChange={(e) => setEditZipCode(e.target.value)}
                            placeholder="Zip Code"
                          />
                        </div>
                      </div>

                      {/* Contact Phone and Email in a responsive grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                          <Label htmlFor="editPhone">Phone</Label>
                          <Input 
                            id="editPhone"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone number"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="editEmail">Email</Label>
                          <Input 
                            id="editEmail"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="Email address"
                          />
                        </div>
                      </div>

                      {/* Status */}
                      <div className="space-y-1 pt-2">
                        <Label htmlFor="editStatus">Contact Status</Label>
                        <Select 
                          value={editStatus} 
                          onValueChange={setEditStatus}
                        >
                          <SelectTrigger id="editStatus">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_contact">No Contact Yet</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="not_interested">Not Interested</SelectItem>
                            <SelectItem value="no_soliciting">No Soliciting</SelectItem>
                            <SelectItem value="check_back">Check Back Later</SelectItem>
                            <SelectItem value="presented">Presented</SelectItem>
                            <SelectItem value="booked">Booked</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                            <SelectItem value="no_answer">No Answer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Button Group */}
                      <div className="flex justify-between pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleEditContactSubmit}
                          disabled={!editName || !editAddress || editContactMutation.isPending}
                        >
                          {editContactMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Dialog footer for basic actions */}
        <div className="flex flex-wrap justify-between gap-2 mt-8">
          <div className="flex gap-2">
            <Button 
              variant="destructive"
              onClick={() => {
                if (contact) {
                  handleContactDelete(contact);
                  onClose();
                }
              }}
            >
              Delete Contact
            </Button>
          </div>
          <Button className="h-10" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}