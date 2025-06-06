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
import { getStatusBadgeConfig } from "@/lib/status-helpers";
import { format, parseISO } from "date-fns";
import { X, Edit, MapPin, Phone, Mail, CalendarClock, DollarSign, FileText } from "lucide-react";
import { ContactForm } from "./contact-form";

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
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  // Sale form state
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [saleProduct, setSaleProduct] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [saleStatus, setSaleStatus] = useState("completed");
  const [salePaymentMethod, setSalePaymentMethod] = useState("Unknown");

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [taskPriority, setTaskPriority] = useState("medium");

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

  // Add note mutation - creates a visit record for tracking history
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

  // Update contact notes mutation
  const updateContactNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/contacts/${id}`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    },
    onError: (error) => {
      console.error("Error updating contact notes:", error);
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
      setFollowUpTitle("");
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

  // Record sale mutation
  const recordSaleMutation = useMutation({
    mutationFn: async (data: InsertSale) => {
      const response = await apiRequest("POST", "/api/sales", data);
      return response.json();
    },
    onSuccess: () => {
      // Reset form fields
      setSaleAmount("");
      setSaleProduct("");
      setSaleNotes("");
      setSaleDate(format(new Date(), "yyyy-MM-dd"));
      setSaleStatus("completed");
      setSalePaymentMethod("Unknown");
      setShowSaleForm(false);

      // Invalidate sales queries to update UI
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/sales`] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });

      toast({
        title: "Sale recorded",
        description: "The sale has been recorded successfully",
      });

      // Switch to the sales tab to show the new sale
      setActiveTab("sales");
    },
    onError: (error) => {
      console.error("Error recording sale:", error);
      toast({
        title: "Error",
        description: "Failed to record sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      // Reset form fields
      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate(format(new Date(), "yyyy-MM-dd"));
      setTaskPriority("medium");
      setShowTaskForm(false);

      // Invalidate tasks queries to update UI
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      toast({
        title: "Task created",
        description: "Your task has been created successfully",
      });

      // Switch to the tasks tab to show the new task
      setActiveTab("tasks");
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      toast({
        title: "Task completed",
        description: "Task marked as completed successfully",
      });
    },
    onError: (error) => {
      console.error("Error completing task:", error);
      toast({
        title: "Error",
        description: "Failed to complete the task. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully",
      });
    },
    onError: (error) => {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete the task. Please try again.",
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

    // Create a visit record for history tracking
    addNoteMutation.mutate({
      contactId,
      userId: user.id,
      visitType: "note",
      notes: note,
      outcome: "neutral",
      followUpNeeded: false,
      visitDate: new Date(),
    });

    // Also update the contact's notes field
    // Append the new note to existing notes (if any)
    const timestamp = format(new Date(), "MMM d, yyyy h:mm a");
    const newNoteWithTimestamp = `[${timestamp}] ${note}`;

    const updatedNotes = contact?.notes 
      ? `${contact.notes}\n\n${newNoteWithTimestamp}`
      : newNoteWithTimestamp;

    // Update the contact record with the combined notes
    updateContactNotesMutation.mutate({
      id: contactId,
      notes: updatedNotes
    });
  };

  // Schedule a follow-up
  const handleScheduleFollowUp = () => {
    if (!user?.id || !contactId) return;

    // Validate title field
    if (!followUpTitle.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a title for the follow-up",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = new Date(`${followUpDate}T${followUpTime}`);
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 30);

    createScheduleMutation.mutate({
      userId: user.id,
      title: followUpTitle,
      description: followUpReason || `Check back with contact`,
      startTime: startDateTime,
      endTime: endDateTime,
      type: "follow_up",
      location: contact?.address || "",
      reminderSent: false,
      contactIds: [contactId],
    });
  };

  // Handle sale submission
  const handleRecordSale = () => {
    if (!user?.id || !contactId) return;

    // Validate form fields
    if (!saleAmount || !saleProduct) {
      toast({
        title: "Missing information",
        description: "Please provide both amount and product details",
        variant: "destructive",
      });
      return;
    }

    // Convert amount to number
    const amount = parseFloat(saleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid sale amount",
        variant: "destructive",
      });
      return;
    }

    // Create the sale record
    recordSaleMutation.mutate({
      contactId,
      userId: user.id,
      amount,
      product: saleProduct,
      saleDate: new Date(saleDate),
      status: saleStatus,
      paymentMethod: salePaymentMethod,
      notes: saleNotes,
    });
  };

  // Handle task creation - simplified approach
  const handleCreateTask = () => {
    if (!user?.id || !contactId) return;

    // Validate form fields
    if (!taskTitle) {
      toast({
        title: "Missing information",
        description: "Please provide a task title",
        variant: "destructive",
      });
      return;
    }

    // Simple task object with just the essentials
    const newTask = {
      contactId: contactId,
      userId: user.id,
      title: taskTitle,
      description: taskDescription || "",
      status: "pending",
      priority: taskPriority || "medium",
      completed: false
    };

    // Convert the string date to a proper Date object
    if (taskDueDate) {
      try {
        // Create a Date object from the input value (yyyy-MM-dd)
        const [year, month, day] = taskDueDate.split('-').map(Number);
        // Note: JS months are 0-based
        const dateObj = new Date(year, month - 1, day, 12, 0, 0);
        console.log(`Creating Date from ${taskDueDate}:`, dateObj);

        // @ts-ignore - this will be a proper Date object now
        newTask.dueDate = dateObj;
      } catch (e) {
        console.error("Error converting date:", e);
        // Create a default date (tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(12, 0, 0, 0);
        // @ts-ignore
        newTask.dueDate = tomorrow;
      }
    }

    console.log("Creating task:", newTask);

    createTaskMutation.mutate(newTask, {
      onSuccess: () => {
        toast({
          title: "Task created",
          description: "Task has been added successfully",
        });

        // Reset form fields
        setTaskTitle("");
        setTaskDescription("");
        setTaskDueDate("");
        setTaskPriority("medium");

        // Refresh the tasks list
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/tasks`] });
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      },
      onError: (error) => {
        console.error("Failed to create task:", error);
        toast({
          title: "Error",
          description: "Failed to create task. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  // Handle completing a task
  const handleCompleteTask = (taskId: number) => {
    if (!taskId) return;
    completeTaskMutation.mutate(taskId);
  };

  // Handle deleting a task
  const handleDeleteTask = (taskId: number) => {
    if (!taskId) return;
    deleteTaskMutation.mutate(taskId);
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
            <Badge className={`${getStatusBadgeConfig(contact.status).bg} ${getStatusBadgeConfig(contact.status).text}`}>
              {getStatusBadgeConfig(contact.status).label}
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
                <TabsList className="grid grid-cols-4 mb-4 w-full">
                  <TabsTrigger value="notes" className="px-2 text-xs md:text-sm">History</TabsTrigger>
                  <TabsTrigger value="schedule" className="px-2 text-xs md:text-sm">Schedule</TabsTrigger>
                  <TabsTrigger value="sales" className="px-2 text-xs md:text-sm">Sales</TabsTrigger>
                  <TabsTrigger value="tasks" className="px-2 text-xs md:text-sm">Tasks</TabsTrigger>
                </TabsList>

                {/* History Tab */}
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
                    <div>
                      <Label htmlFor="followup-title">Title</Label>
                      <Input 
                        id="followup-title" 
                        type="text" 
                        placeholder="Follow-up title..." 
                        value={followUpTitle} 
                        onChange={(e) => setFollowUpTitle(e.target.value)} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
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
                    <div className="mt-3">
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setActiveTab("sales");
                          setShowSaleForm(true);
                        }}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Record Sale
                      </Button>
                    </div>

                    {/* Sale Form */}
                    {showSaleForm && (
                      <div className="p-4 border border-green-200 bg-green-50 rounded-md space-y-3">
                        <h4 className="font-medium text-green-700">Record Sale Details</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="sale-amount">Amount ($)</Label>
                            <Input
                              id="sale-amount"
                              type="text"
                              placeholder="0.00"
                              value={saleAmount}
                              onChange={(e) => setSaleAmount(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="sale-date">Sale Date</Label>
                            <Input
                              id="sale-date"
                              type="date"
                              value={saleDate}
                              onChange={(e) => setSaleDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="sale-product">Product/Service</Label>
                          <Input
                            id="sale-product"
                            type="text"
                            placeholder="What was sold?"
                            value={saleProduct}
                            onChange={(e) => setSaleProduct(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="sale-notes">Notes (Optional)</Label>
                          <Textarea
                            id="sale-notes"
                            placeholder="Additional sale details..."
                            value={saleNotes}
                            onChange={(e) => setSaleNotes(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowSaleForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleRecordSale}
                            disabled={recordSaleMutation.isPending}
                          >
                            {recordSaleMutation.isPending ? "Saving..." : "Save Sale"}
                          </Button>
                        </div>
                      </div>
                    )}

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
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setActiveTab("tasks");
                          setShowTaskForm(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Add Task
                      </Button>
                    </div>

                    {/* Task Creation Form */}
                    {showTaskForm && (
                      <div className="p-4 border border-blue-200 bg-blue-50 rounded-md space-y-3">
                        <h4 className="font-medium text-blue-700">Create New Task</h4>

                        <div>
                          <Label htmlFor="task-title">Title</Label>
                          <Input
                            id="task-title"
                            placeholder="Task title..."
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                          />
                        </div>

                        <div>
                          <Label htmlFor="task-description">Description</Label>
                          <Textarea
                            id="task-description"
                            placeholder="Task description..."
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="task-due-date">Due Date</Label>
                            <Input
                              id="task-due-date"
                              type="date"
                              value={taskDueDate}
                              onChange={(e) => setTaskDueDate(e.target.value)}
                            />
                          </div>

                          <div>
                            <Label htmlFor="task-priority">Priority</Label>
                            <select
                              id="task-priority"
                              value={taskPriority}
                              onChange={(e) => setTaskPriority(e.target.value)}
                              className="w-full h-10 px-3 py-2 rounded-md border border-input"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowTaskForm(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateTask}
                            disabled={createTaskMutation.isPending}
                          >
                            {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {tasks.length > 0 ? (
                        tasks.map((task) => (
                          <div 
                            key={task.id} 
                            className="p-3 border border-gray-200 rounded-md"
                          >
                            <div className="flex justify-between">
                              <span className="font-medium">{task.title}</span>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={task.completed ? "default" : "secondary"} 
                                  className={`text-xs ${task.completed ? "bg-green-100 text-green-800" : ""}`}
                                >
                                  {task.completed ? "Completed" : "Pending"}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex justify-between items-center mt-1">
                              <div className="text-xs text-gray-500">
                                Due: {task.dueDate && format(new Date(task.dueDate), "MMM d, yyyy")}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {task.priority ? (task.priority.charAt(0).toUpperCase() + task.priority.slice(1)) : "Medium"} Priority
                              </Badge>
                            </div>

                            {task.description && <p className="text-sm mt-1">{task.description}</p>}

                            <div className="flex justify-end mt-2 gap-2">
                              {!task.completed && (
                                <Button 
```text
                                  size="sm" variant="outline" 
                                  className="px-2 py-1 h-8 text-xs"
                                  onClick={() => handleCompleteTask(task.id)}
                                >
                                  Mark Complete
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="px-2 py-1 h-8 text-xs text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                Delete
                              </Button>
                            </div>
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
          onSuccess={handleEditSuccess}
          initialContact={contact}
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