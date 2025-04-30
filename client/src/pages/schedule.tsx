import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Schedule, InsertSchedule, Contact, Task } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, set } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import ContactCard from "@/components/contacts/contact-card";
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
import { useTour } from "@/contexts/tour-context";
import CustomTour from "@/components/tour/custom-tour";
import { customScheduleTourSteps } from "@/tours/custom-schedule-tour-steps";

export default function SchedulePage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [debugVisible, setDebugVisible] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleType, setScheduleType] = useState("appointment");
  const [location, setLocation] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sendReminder, setSendReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState("1_hour");
  const [confirmationMethod, setConfirmationMethod] = useState("email");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactSortField, setContactSortField] = useState<string>("fullName");
  const [contactSortDirection, setContactSortDirection] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<'today' | 'upcoming' | 'all'>('upcoming');
  
  // Debug info - log auth status and user object
  useEffect(() => {
    console.log("Auth Debug - Schedule Page:", {
      isAuthenticated,
      authLoading,
      user,
      hasToken: !!localStorage.getItem('doorpro_auth_token')
    });
  }, [isAuthenticated, authLoading, user]);
  
  // Added for contact details and navigation
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [showContactDetail, setShowContactDetail] = useState(false);
  const [navigationAddress, setNavigationAddress] = useState<string | null>(null);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  
  // Clear form function
  const clearForm = () => {
    setTitle("");
    setDescription("");
    setStartTime("09:00");
    setEndTime("10:00");
    setScheduleType("appointment");
    setLocation("");
    setSelectedContacts([]);
    setSendReminder(false);
    setReminderTime("1_hour");
    setConfirmationMethod("email");
    setShowAddForm(false);
  };

  // Fetch schedules with advanced options for better refresh
  const { 
    data: schedules = [], 
    isLoading: schedulesLoading,
    refetch: refetchSchedules
  } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
  
  // Fetch tasks
  const {
    data: tasks = [],
    isLoading: tasksLoading,
    refetch: refetchTasks
  } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
  
  // Combined loading state
  const isLoading = schedulesLoading || tasksLoading;
  
  // Fetch contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Convert tasks to a schedule-like format for display
  const convertedTasks = tasks.map(task => ({
    id: task.id,
    userId: task.userId,
    title: task.title,
    description: task.description || "",
    startTime: task.dueDate || new Date(), // Ensure there's always a valid date
    endTime: task.dueDate || new Date(), // Tasks don't have end time, so we use the same value
    type: "task",
    location: "",
    reminderSent: false,
    confirmationStatus: task.completed ? "completed" : "pending",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    contactIds: task.contactId ? [task.contactId] : [],
    isTask: true, // Add a flag to identify as task for rendering
    priority: task.priority || "medium",
    completed: task.completed || false,
    contactId: task.contactId // Keep original contactId for task-specific operations
  }));
  
  // Combine schedules and tasks
  const combinedItems = [...schedules, ...convertedTasks];
  
  // Group schedules and tasks by date - using the date in local timezone for display
  const schedulesByDate = combinedItems.reduce((acc, item) => {
    // For debugging, log the item to see the dates
    console.log('Schedule/Task Processing:', { 
      id: item.id, 
      title: item.title,
      type: item.type,
      isTask: 'isTask' in item,
      rawStartTime: item.startTime,
      isoString: new Date(item.startTime).toISOString(),
      localDate: new Date(item.startTime).toString(),
      fixedIsoLocalDate: new Date(item.startTime).toLocaleDateString()
    });
    
    // Extract the date directly from the ISO string but preserving the intended date
    // This is critical to handle timezone shifts correctly
    const scheduleDateStr = item.startTime.toString();
    
    // First try to extract the date part from an ISO string if it has the format
    let intendedDate;
    if (typeof scheduleDateStr === 'string' && scheduleDateStr.includes('T')) {
      // Extract YYYY-MM-DD from ISO string to ensure we display the proper date
      const datePart = scheduleDateStr.split('T')[0];
      intendedDate = new Date(datePart + 'T00:00:00');
    } else {
      // Fallback if not in expected format
      intendedDate = new Date(item.startTime);
    }
    
    const dateString = format(intendedDate, "yyyy-MM-dd");
    console.log(`Item ${item.id} (${item.title}) - Using date: ${dateString}`);
    
    if (!acc[dateString]) {
      acc[dateString] = [];
    }
    acc[dateString].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Today's date in YYYY-MM-DD format
  const today = new Date();
  const todayString = format(today, "yyyy-MM-dd");
  
  // Function to check if a date is upcoming (today or future)
  const isDateUpcoming = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };
  
  // Sort dates chronologically
  const sortedDates = Object.keys(schedulesByDate).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });
  
  // Filter dates based on view mode
  const filteredDates = sortedDates.filter(date => {
    if (viewMode === 'today') {
      return date === todayString;
    } else if (viewMode === 'upcoming') {
      return isDateUpcoming(date);
    }
    return true; // 'all' view shows everything
  });

  // Calculate reminder time using local time
  const calculateReminderTime = (startDateTime: Date): Date => {
    // Clone the date to avoid modifying the original
    const reminder = new Date(startDateTime.getTime());
    
    switch (reminderTime) {
      case "15_min":
        reminder.setMinutes(reminder.getMinutes() - 15);
        break;
      case "30_min":
        reminder.setMinutes(reminder.getMinutes() - 30);
        break;
      case "1_hour":
        reminder.setHours(reminder.getHours() - 1);
        break;
      case "2_hours":
        reminder.setHours(reminder.getHours() - 2);
        break;
      case "1_day":
        reminder.setDate(reminder.getDate() - 1);
        break;
      default:
        reminder.setHours(reminder.getHours() - 1);
    }
    
    console.log('Reminder Time:', {
      original: startDateTime.toString(),
      originalISO: startDateTime.toISOString(),
      reminder: reminder.toString(),
      reminderISO: reminder.toISOString(),
      timeOption: reminderTime
    });
    
    return reminder;
  };

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: InsertSchedule) => {
      console.log("Sending schedule data to API:", scheduleData);
      try {
        const res = await apiRequest("POST", "/api/schedules", scheduleData);
        const data = await res.json();
        console.log("API response:", data);
        return data;
      } catch (err) {
        console.error("Failed to create schedule:", err);
        throw err;
      }
    },
    onSuccess: async (data) => {
      console.log("Schedule created successfully:", data);
      
      // Force an immediate refetch to ensure the UI is up to date
      await refetchSchedules();
      
      // Also invalidate the query cache to ensure future fetches are fresh
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      toast({
        title: "Schedule created",
        description: "Your schedule has been created successfully",
      });
      
      clearForm();
      
      // After a brief delay, refetch again to make absolutely sure we have the latest data
      setTimeout(() => {
        refetchSchedules();
      }, 1000);
    },
    onError: (error) => {
      console.error("Schedule creation error:", error);
      toast({
        title: "Error creating schedule",
        description: "There was an error creating your schedule. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!isAuthenticated || !user || !user.id) {
      console.error("User authentication issue:", {
        isAuthenticated,
        user,
        tokenExists: !!localStorage.getItem('doorpro_auth_token')
      });
      
      toast({
        title: "Authentication Required",
        description: "Please make sure you're logged in before creating a schedule",
        variant: "destructive",
      });
      
      // Try to refresh authentication if token exists but user data is missing
      if (!!localStorage.getItem('doorpro_auth_token') && (!user || !isAuthenticated)) {
        toast({
          title: "Refreshing authentication",
          description: "Trying to reconnect your session...",
        });
        
        // Force page reload to reestablish auth
        window.location.reload();
      }
      return;
    }
    
    if (!selectedDate) {
      toast({
        title: "Date required",
        description: "Please select a date for your schedule",
        variant: "destructive",
      });
      return;
    }
    
    // Extract the year, month, and day from the selected date using local time
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    
    // Parse hours and minutes from time strings
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    
    // Create a new date in local time first
    const startDateTime = new Date(year, month, day, startHours, startMinutes, 0);
    
    // Create default end time 30 minutes after start if not provided
    let endDateTime;
    
    if (endTime) {
      const [endHours, endMinutes] = endTime.split(":").map(Number);
      endDateTime = new Date(year, month, day, endHours, endMinutes, 0);
      
      // Validate time if end time is provided
      if (endDateTime <= startDateTime) {
        // Just set end time to 30 minutes after start
        endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(startDateTime.getMinutes() + 30);
      }
    } else {
      // Default to 30 minutes after start
      endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(startDateTime.getMinutes() + 30);
    }
    
    // Log more detailed date values for debugging
    console.log('Schedule Page - Detailed Date Debug:', { 
      selectedDate: selectedDate.toString(),
      startTime,
      endTime,
      startDateTime: startDateTime.toString(),
      startDateTimeISO: startDateTime.toISOString(),
      endDateTime: endDateTime.toString(),
      endDateTimeISO: endDateTime.toISOString(),
      userId: user?.id || 0
    });
    
    // Calculate reminder time (if enabled)
    let reminderTimeValue = undefined;
    if (sendReminder) {
      reminderTimeValue = calculateReminderTime(startDateTime);
    }
    
    // Create ISO strings that preserve the actual date parts (not timezone-adjusted)
    // This ensures the server sees the date as the user selected it
    const dateFormatted = format(selectedDate, "yyyy-MM-dd");
    const startTimeFormatted = startTime.split(':').map(Number);
    const endTimeFormatted = endTime.split(':').map(Number);
    
    // Create the ISO strings preserving the date and time as selected
    const startTimeISO = `${dateFormatted}T${startTimeFormatted[0].toString().padStart(2, '0')}:${startTimeFormatted[1].toString().padStart(2, '0')}:00.000Z`;
    const endTimeISO = `${dateFormatted}T${endTimeFormatted[0].toString().padStart(2, '0')}:${endTimeFormatted[1].toString().padStart(2, '0')}:00.000Z`;
    
    console.log('Using formatted ISO dates to preserve intended date:', {
      dateFormatted,
      startTimeISO,
      endTimeISO
    });
    
    // Need to cast the string type to Date to satisfy the InsertSchedule type
    // The server side will handle the parsing of these values
    const scheduleData: any = {
      userId: user?.id || 0,
      title,
      description,
      // Use the ISO strings directly to ensure the server gets the exact date/time
      startTime: startTimeISO,
      endTime: endTimeISO,
      type: scheduleType,
      location,
      contactIds: selectedContacts.length > 0 ? selectedContacts : undefined,
      reminderSent: false,
      reminderTime: reminderTimeValue,
      confirmationMethod: scheduleType === "appointment" ? confirmationMethod : undefined,
      confirmationStatus: scheduleType === "appointment" ? "pending" : undefined,
    };
    
    createScheduleMutation.mutate(scheduleData);
  };

  // Delete schedule
  const [scheduleToDelete, setScheduleToDelete] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Delete mutation for regular schedules
  const deleteScheduleMutation = useMutation({
    mutationFn: async (scheduleId: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${scheduleId}`);
      return res.json();
    },
    onSuccess: async () => {
      // Force an immediate refetch
      await refetchSchedules();
      
      // Also invalidate the query cache
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      
      toast({
        title: "Schedule deleted",
        description: "The schedule item has been deleted",
      });
      
      setShowDeleteDialog(false);
      setScheduleToDelete(null);
      
      // Double-check with another refetch after a small delay
      setTimeout(() => {
        refetchSchedules();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Error deleting schedule",
        description: "There was an error deleting the schedule. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const res = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      return res.json();
    },
    onSuccess: async () => {
      // Force an immediate refetch
      await refetchTasks();
      
      // Also invalidate the query cache
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      
      toast({
        title: "Task deleted",
        description: "The task has been deleted",
      });
      
      setShowDeleteDialog(false);
      setScheduleToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting task",
        description: "There was an error deleting the task. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle delete button click
  const handleDeleteSchedule = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setScheduleToDelete(item.id);
    
    // Store whether this is a task or not for the confirmation dialog
    const isTaskItem = item.type === "task" || 'isTask' in item;
    setItemToDeleteIsTask(isTaskItem);
    
    setShowDeleteDialog(true);
  };
  
  // Track if the item being deleted is a task
  const [itemToDeleteIsTask, setItemToDeleteIsTask] = useState(false);
  
  // Confirm delete
  const confirmDeleteSchedule = () => {
    if (scheduleToDelete) {
      if (itemToDeleteIsTask) {
        deleteTaskMutation.mutate(scheduleToDelete);
      } else {
        deleteScheduleMutation.mutate(scheduleToDelete);
      }
    }
  };
  
  // Toggle contact selection
  const toggleContactSelection = (contactId: number) => {
    setSelectedContacts((prev) => {
      if (prev.includes(contactId)) {
        return prev.filter((id) => id !== contactId);
      } else {
        return [...prev, contactId];
      }
    });
  };

  // Get confirmation status badge color
  const getConfirmationStatusColor = (status: string | null) => {
    if (!status) return "bg-neutral-100 text-neutral-800";
    
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 border-green-300";
      case "rescheduled":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      case "pending":
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };
  
  // Handle clicking a schedule item to view contact details
  const handleScheduleItemClick = (item: any) => {
    // Check if this is a task with a direct contactId
    if ('isTask' in item && item.contactId) {
      setSelectedContactId(item.contactId);
      setShowContactDetail(true);
      return;
    }
    
    // For regular schedules, check contactIds array
    if (item.contactIds && item.contactIds.length > 0) {
      // Get the first associated contact
      setSelectedContactId(item.contactIds[0]);
      setShowContactDetail(true);
    } else {
      toast({
        title: "No associated contact",
        description: "This schedule item doesn't have any associated contacts.",
      });
    }
  };
  
  // Handle clicking on an address to open navigation
  const handleAddressClick = (event: React.MouseEvent, address: string) => {
    event.stopPropagation(); // Prevent triggering the parent click handler
    if (address) {
      setNavigationAddress(address);
      setShowNavigationDialog(true);
    }
  };
  
  // Open map with the selected address
  const openMapNavigation = () => {
    if (navigationAddress) {
      // Create a properly encoded URI for the address
      const encodedAddress = encodeURIComponent(navigationAddress);
      
      // Open in default map application
      window.open(`https://maps.google.com/maps?q=${encodedAddress}`, '_blank');
      
      // Close the dialog
      setShowNavigationDialog(false);
      setNavigationAddress(null);
    }
  };

  // Get tour functionality
  const { startTour, endTour } = useTour();
  const [showScheduleTour, setShowScheduleTour] = useState(false);
  
  // Function to handle starting the schedule tour
  const handleStartScheduleTour = () => {
    console.log("Starting schedule tour - previous state:", showScheduleTour);
    
    // Force set to false first to ensure re-render triggers even if already true
    setShowScheduleTour(false);
    
    // Use setTimeout to ensure state updates completely before setting to true
    setTimeout(() => {
      console.log("Setting tour state to true");
      setShowScheduleTour(true);
    }, 50);
    
    // Show feedback to user
    toast({
      title: "Tour started",
      description: "Follow the steps to learn about the schedule features",
      duration: 2000,
    });
  };
  
  // Function to handle closing the schedule tour
  const handleCloseScheduleTour = () => {
    console.log("Closing schedule tour");
    setShowScheduleTour(false);
  };
  
  return (
    <div className="container mx-auto py-6">
      {/* Custom Tour Component */}
      <CustomTour 
        steps={customScheduleTourSteps}
        open={showScheduleTour}
        tourName="schedule"
        onClose={handleCloseScheduleTour}
        showCloseButton={true}
        showDoneButton={true}
      />
      {/* Debug panel for auth troubleshooting */}
      {debugVisible && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-yellow-800">Authentication Debug Panel</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDebugVisible(false)}
              className="h-6 text-yellow-600 hover:text-yellow-800"
            >
              Close
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-yellow-800">
                <strong>Auth State:</strong> {authLoading ? "Loading..." : isAuthenticated ? "Authenticated" : "Not Authenticated"}
              </p>
              <p className="text-yellow-800">
                <strong>Token Present:</strong> {!!localStorage.getItem('doorpro_auth_token') ? "Yes" : "No"}
              </p>
              
              {!isAuthenticated && !!localStorage.getItem('doorpro_auth_token') && (
                <Button 
                  size="sm" 
                  className="mt-2 h-7 text-xs bg-yellow-600 hover:bg-yellow-700"
                  onClick={() => {
                    toast({
                      title: "Refreshing authentication",
                      description: "Attempting to reconnect your session...",
                    });
                    window.location.reload();
                  }}
                >
                  Refresh Authentication
                </Button>
              )}
            </div>
            <div>
              <p className="text-yellow-800">
                <strong>User ID:</strong> {user?.id || "Not available"}
              </p>
              <p className="text-yellow-800">
                <strong>Username:</strong> {user?.username || "Not available"}
              </p>
              <p className="text-yellow-800">
                <strong>Token Value:</strong> {
                  localStorage.getItem('doorpro_auth_token')
                    ? localStorage.getItem('doorpro_auth_token')!.substring(0, 10) + '...'
                    : "None"
                }
              </p>
            </div>
          </div>
        </div>
      )}
    
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900" data-tour="schedule-title">Tasks & Bookings Schedule</h1>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleStartScheduleTour}
            className="ml-2 flex items-center h-8 w-8 p-1 justify-center rounded-full hover:bg-gray-100"
            aria-label="Help"
            title="Get help with managing your appointments and tasks"
          >
            <HelpCircle className="h-5 w-5 text-gray-500" />
          </Button>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 sm:mt-0">
          {/* View mode selector */}
          <div className="flex items-center gap-3" data-tour="schedule-filters">
            <div className="flex bg-gray-100 rounded-md p-1">
              <button 
                type="button"
                onClick={() => setViewMode('today')} 
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${viewMode === 'today' 
                  ? 'bg-white shadow-sm text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setViewMode('upcoming')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${viewMode === 'upcoming' 
                  ? 'bg-white shadow-sm text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'}`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${viewMode === 'all' 
                  ? 'bg-white shadow-sm text-primary-700' 
                  : 'text-gray-600 hover:text-gray-900'}`}
              >
                All
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => {
                refetchSchedules();
                refetchTasks();
                toast({
                  title: "Refreshed",
                  description: "Schedule and task data has been refreshed",
                });
              }}
              className="p-1.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-gray-100 transition-colors"
              title="Refresh schedule data"
            >
              <span className="material-icons text-xl">refresh</span>
            </button>
          </div>
          
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center"
            data-tour="add-schedule-btn"
          >
            <span className="material-icons text-sm mr-1">{showAddForm ? "close" : "add"}</span>
            {showAddForm ? "Cancel" : "Add Task/Appointment"}
          </Button>
        </div>
      </div>
      
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6" data-tour="schedule-form">
          <h2 className="text-lg font-medium mb-4">Add New Task or Appointment</h2>
          <form onSubmit={handleSubmit} data-tour="appointment-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Schedule title"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location (optional)"
                />
              </div>
              
              <div>
                <Label htmlFor="scheduleType">Type</Label>
                <Select value={scheduleType} onValueChange={setScheduleType}>
                  <SelectTrigger id="scheduleType">
                    <SelectValue placeholder="Schedule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="route">Route Planning</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="appointment">Booked</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">End Time <span className="text-xs text-gray-500">(optional)</span></Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <div className="text-xs text-gray-500 mt-1">
                  If not provided, a 30-minute duration will be assumed
                </div>
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about this schedule"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch id="send-reminder" checked={sendReminder} onCheckedChange={setSendReminder} />
                <Label htmlFor="send-reminder">Send reminder</Label>
              </div>
              
              {sendReminder && (
                <div>
                  <Label htmlFor="reminderTime">Reminder Time</Label>
                  <Select value={reminderTime} onValueChange={setReminderTime}>
                    <SelectTrigger id="reminderTime">
                      <SelectValue placeholder="When to send reminder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15_min">15 minutes before</SelectItem>
                      <SelectItem value="30_min">30 minutes before</SelectItem>
                      <SelectItem value="1_hour">1 hour before</SelectItem>
                      <SelectItem value="2_hours">2 hours before</SelectItem>
                      <SelectItem value="1_day">1 day before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Confirmation method temporarily hidden until needed
              {scheduleType === "appointment" && (
                <div className="md:col-span-2">
                  <Label htmlFor="confirmationMethod" className="mb-2 block">Confirmation Method</Label>
                  <Select value={confirmationMethod} onValueChange={setConfirmationMethod}>
                    <SelectTrigger id="confirmationMethod">
                      <SelectValue placeholder="How to confirm appointment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="both">Email & SMS</SelectItem>
                      <SelectItem value="none">No confirmation needed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-neutral-500 mt-1">
                    {confirmationMethod === "email" && "Appointment confirmation will be sent via email"}
                    {confirmationMethod === "sms" && "Appointment confirmation will be sent via SMS text message"}
                    {confirmationMethod === "both" && "Appointment confirmation will be sent via both email and SMS"}
                    {confirmationMethod === "none" && "No automatic confirmation will be sent for this appointment"}
                  </p>
                </div>
              )}
              */}
              
              {/* Contact Selection - Available for all schedule types now */}
              <div className="md:col-span-2">
                <Label className="mb-2 block">Select Contacts</Label>
                
                {/* Search and Sorting Controls */}
                <div className="flex flex-col md:flex-row gap-2 mb-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Search contacts..."
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sortField" className="whitespace-nowrap">Sort by:</Label>
                    <Select value={contactSortField} onValueChange={setContactSortField}>
                      <SelectTrigger id="sortField" className="w-[150px]">
                        <SelectValue placeholder="Sort field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fullName">Name</SelectItem>
                        <SelectItem value="address">Address</SelectItem>
                        <SelectItem value="city">City</SelectItem>
                        <SelectItem value="state">State</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setContactSortDirection(dir => dir === "asc" ? "desc" : "asc")}
                      title={`Sort ${contactSortDirection === "asc" ? "ascending" : "descending"}`}
                      type="button"
                    >
                      <span className="material-icons text-sm">
                        {contactSortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                      </span>
                    </Button>
                  </div>
                </div>
                
                {/* Contact List */}
                <div className="border rounded-md p-4 h-64 overflow-y-auto">
                  {contacts.length === 0 ? (
                    <div className="text-neutral-500 text-center py-4">
                      No contacts available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts
                        // Filter contacts based on search query
                        .filter(contact => {
                          if (!contactSearchQuery.trim()) return true;
                          const searchLower = contactSearchQuery.toLowerCase();
                          return (
                            (contact.fullName || '').toLowerCase().includes(searchLower) ||
                            (contact.address || '').toLowerCase().includes(searchLower) ||
                            (contact.city || '').toLowerCase().includes(searchLower) ||
                            (contact.state || '').toLowerCase().includes(searchLower) ||
                            (contact.status || '').toLowerCase().includes(searchLower)
                          );
                        })
                        // Sort contacts based on selected field and direction
                        .sort((a, b) => {
                          // Default values for null properties
                          const aValue = a[contactSortField as keyof Contact] || "";
                          const bValue = b[contactSortField as keyof Contact] || "";
                          
                          // Compare values based on sort direction
                          if (contactSortDirection === "asc") {
                            return String(aValue).localeCompare(String(bValue));
                          } else {
                            return String(bValue).localeCompare(String(aValue));
                          }
                        })
                        .map((contact) => (
                          <div 
                            key={contact.id}
                            className="flex items-center p-2 hover:bg-gray-50 rounded"
                          >
                            <Checkbox 
                              id={`contact-${contact.id}`}
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                              className="mr-2"
                            />
                            <div className="flex-1">
                              <Label 
                                htmlFor={`contact-${contact.id}`}
                                className="font-medium cursor-pointer"
                              >
                                {contact.fullName}
                              </Label>
                              <div className="text-sm text-neutral-600">
                                {contact.address}
                                {contact.city && `, ${contact.city}`}
                                {contact.state && `, ${contact.state}`}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {(contact.status || '').replace(/_/g, " ")}
                            </Badge>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
                
                {/* Selected Contacts Count */}
                <div className="mt-2 text-sm text-neutral-500">
                  {selectedContacts.length} contact{selectedContacts.length !== 1 && 's'} selected
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearForm}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createScheduleMutation.isPending}
              >
                {createScheduleMutation.isPending ? "Creating..." : "Add Task/Appointment"}
              </Button>
            </div>
          </form>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="schedule-list">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredDates.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-md">
            <div className="material-icons text-neutral-400 text-5xl mb-2">event_busy</div>
            <h3 className="text-lg font-medium text-neutral-800">
              {viewMode === 'today' 
                ? "No tasks or appointments for today" 
                : viewMode === 'upcoming' 
                  ? "No upcoming tasks or appointments" 
                  : "No tasks or appointments yet"}
            </h3>
            <p className="text-neutral-500 mb-4">
              {viewMode !== 'all' && sortedDates.length > 0 
                ? "Try switching to 'All' view or"
                : ""} Click the button below to add a new task or appointment
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {viewMode !== 'all' && sortedDates.length > 0 && (
                <Button variant="outline" onClick={() => setViewMode('all')}>Show All</Button>
              )}
              <Button onClick={() => setShowAddForm(true)}>Add Task/Appointment</Button>
            </div>
          </div>
        ) : (
          filteredDates.map((date) => (
            <Card key={date} className="shadow-md">
              <CardHeader className="bg-neutral-50 border-b pb-3">
                <CardTitle className="text-lg">{format(new Date(date + 'T12:00:00'), "EEEE, MMMM d, yyyy")}</CardTitle>
                <CardDescription>
                  {schedulesByDate[date].length} item{schedulesByDate[date].length !== 1 && 's'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {schedulesByDate[date]
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map((schedule) => (
                      <div 
                        key={schedule.id}
                        className={cn(
                          "border-l-4 px-3 py-2 rounded-r-md cursor-pointer hover:shadow-md transition-shadow relative",
                          schedule.type === "route" && "border-blue-500 bg-blue-50",
                          (schedule.type === "follow_up" || schedule.type === "follow-up") && "border-yellow-500 bg-yellow-50",
                          schedule.type === "appointment" && "border-blue-500 bg-blue-50",
                          schedule.type === "task" && "border-purple-500 bg-purple-50",
                          schedule.type === "presentation" && "border-orange-500 bg-orange-50"
                        )}
                        onClick={() => handleScheduleItemClick(schedule)}
                      >
                        {/* Delete button */}
                        <button 
                          className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 focus:outline-none z-10"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the parent click
                            handleDeleteSchedule(e, schedule);
                          }}
                          aria-label="Delete schedule item"
                        >
                          <span className="material-icons text-sm">delete</span>
                        </button>
                        
                        <div className="flex items-center">
                          <div className="flex-1 pr-6"> {/* Added padding right to make room for delete button */}
                            <div className="font-medium">{schedule.title}</div>
                            <div className="text-xs text-neutral-600">
                              {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                            </div>
                            {schedule.location && (
                              <div 
                                className="text-sm mt-1 flex items-center text-neutral-600 hover:text-primary"
                                onClick={(e) => handleAddressClick(e, schedule.location || "")}
                              >
                                <span className="material-icons text-xs mr-1">location_on</span>
                                <span className="underline hover:text-primary">{schedule.location}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            {/* Task-specific badges if this is a task */}
                            {'isTask' in schedule ? (
                              <>
                                <Badge variant="outline" className="capitalize text-xs bg-purple-50 text-purple-700 border-purple-300">
                                  Task
                                </Badge>
                                
                                {/* Task priority badge */}
                                {schedule.priority && (
                                  <Badge variant="outline" className={cn(
                                    "capitalize text-xs",
                                    schedule.priority === "high" ? "bg-red-50 text-red-700 border-red-300" :
                                    schedule.priority === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                                    "bg-blue-50 text-blue-700 border-blue-300"
                                  )}>
                                    {schedule.priority} priority
                                  </Badge>
                                )}
                                
                                {/* Task completion status */}
                                <Badge variant={schedule.completed ? "default" : "outline"} className={cn(
                                  "capitalize text-xs",
                                  schedule.completed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                )}>
                                  {schedule.completed ? "Completed" : "Pending"}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className="capitalize text-xs">
                                {schedule.type === "appointment" ? "Booked" : schedule.type.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {schedule.description && (
                          <div className="mt-2 text-sm text-neutral-600">
                            {schedule.description}
                          </div>
                        )}
                        
                        {/* Confirmation status temporarily hidden until needed
                        {schedule.type === "appointment" && schedule.confirmationStatus && (
                          <div className="mt-2">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getConfirmationStatusColor(schedule.confirmationStatus))}
                            >
                              Status: {schedule.confirmationStatus === "pending" 
                                ? "Pending Confirmation" 
                                : schedule.confirmationMethod === "none" 
                                  ? "No Confirmation Needed"
                                  : schedule.confirmationMethod.charAt(0).toUpperCase() + schedule.confirmationMethod.slice(1)}
                            </Badge>
                          </div>
                        )}
                        */}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    
      {/* Contact Detail Modal */}
      {showContactDetail && selectedContactId && (
        <ContactCard
          isOpen={showContactDetail}
          contactId={selectedContactId}
          onClose={() => {
            setShowContactDetail(false);
            setSelectedContactId(null);
          }}
        />
      )}
      
      {/* Navigation Dialog */}
      <AlertDialog open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open Map Navigation</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to navigate to this address using your default maps application?
              <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
                {navigationAddress}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNavigationAddress(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={openMapNavigation}>Navigate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemToDeleteIsTask ? "Delete Task" : "Delete Schedule"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {itemToDeleteIsTask ? "task" : "schedule item"}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setScheduleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteSchedule}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteScheduleMutation.isPending || deleteTaskMutation.isPending ? (
                <span className="flex items-center">
                  <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-r-transparent rounded-full"></span>
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}