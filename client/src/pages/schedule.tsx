import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Schedule, InsertSchedule, Contact } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, set } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function SchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
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

  // Fetch schedules
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });
  
  // Fetch contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Group schedules by date
  const schedulesByDate = schedules.reduce((acc, schedule) => {
    const date = format(parseISO(schedule.startTime.toString()), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);
  
  // Sort dates
  const sortedDates = Object.keys(schedulesByDate).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  // Calculate reminder time
  const calculateReminderTime = (startDateTime: Date): Date => {
    const reminder = new Date(startDateTime);
    
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
    
    return reminder;
  };

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: InsertSchedule) => {
      const res = await apiRequest("POST", "/api/schedules", scheduleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule created",
        description: "Your schedule has been created successfully",
      });
      clearForm();
    },
    onError: (error) => {
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
    
    if (!selectedDate) {
      toast({
        title: "Date required",
        description: "Please select a date for your schedule",
        variant: "destructive",
      });
      return;
    }
    
    // Combine date and time
    const startDateTime = set(selectedDate, {
      hours: parseInt(startTime.split(":")[0]),
      minutes: parseInt(startTime.split(":")[1]),
      seconds: 0,
      milliseconds: 0,
    });
    
    const endDateTime = set(selectedDate, {
      hours: parseInt(endTime.split(":")[0]),
      minutes: parseInt(endTime.split(":")[1]),
      seconds: 0,
      milliseconds: 0,
    });
    
    // Validate time
    if (endDateTime <= startDateTime) {
      toast({
        title: "Invalid time",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }
    
    const scheduleData: InsertSchedule = {
      userId: user?.id || 0,
      title,
      description,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      type: scheduleType,
      location,
      contactIds: selectedContacts.length > 0 ? selectedContacts : undefined,
      reminderSent: false,
      reminderTime: sendReminder ? calculateReminderTime(startDateTime).toISOString() : undefined,
      confirmationMethod: scheduleType === "appointment" ? confirmationMethod : undefined,
      confirmationStatus: scheduleType === "appointment" ? "pending" : undefined,
    };
    
    createScheduleMutation.mutate(scheduleData);
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

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center"
        >
          <span className="material-icons text-sm mr-1">{showAddForm ? "close" : "add"}</span>
          {showAddForm ? "Cancel" : "Add Schedule"}
        </Button>
      </div>
      
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium mb-4">New Schedule</h2>
          <form onSubmit={handleSubmit}>
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
                    <SelectItem value="appointment">Appointment</SelectItem>
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
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
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
              
              {(scheduleType === "route" || scheduleType === "follow_up") && (
                <div className="md:col-span-2">
                  <Label className="mb-2 block">Select Contacts</Label>
                  <div className="border rounded-md p-4 h-48 overflow-y-auto">
                    {contacts.length === 0 ? (
                      <div className="text-neutral-500 text-center py-4">
                        No contacts available
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div 
                            key={contact.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox 
                              id={`contact-${contact.id}`}
                              checked={selectedContacts.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                            />
                            <Label 
                              htmlFor={`contact-${contact.id}`}
                              className="font-normal cursor-pointer"
                            >
                              {contact.fullName} ({contact.address})
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </form>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-md">
            <div className="material-icons text-neutral-400 text-5xl mb-2">event_busy</div>
            <h3 className="text-lg font-medium text-neutral-800">No schedules yet</h3>
            <p className="text-neutral-500 mb-4">Click the 'Add Schedule' button to create your first schedule</p>
            <Button onClick={() => setShowAddForm(true)}>Add Schedule</Button>
          </div>
        ) : (
          sortedDates.map((date) => (
            <Card key={date} className="shadow-md">
              <CardHeader className="bg-neutral-50 border-b pb-3">
                <CardTitle className="text-lg">{format(new Date(date), "EEEE, MMMM d")}</CardTitle>
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
                          "border-l-4 px-3 py-2 rounded-r-md",
                          schedule.type === "route" && "border-blue-500 bg-blue-50",
                          schedule.type === "follow_up" && "border-green-500 bg-green-50",
                          schedule.type === "appointment" && "border-yellow-500 bg-yellow-50",
                          schedule.type === "presentation" && "border-purple-500 bg-purple-50"
                        )}
                      >
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="font-medium">{schedule.title}</div>
                            <div className="text-xs text-neutral-600">
                              {format(new Date(schedule.startTime), "h:mm a")} - {format(new Date(schedule.endTime), "h:mm a")}
                            </div>
                            {schedule.location && (
                              <div className="text-sm mt-1 flex items-center text-neutral-600">
                                <span className="material-icons text-xs mr-1">location_on</span>
                                {schedule.location}
                              </div>
                            )}
                          </div>
                          <div>
                            <Badge variant="outline" className="capitalize text-xs">
                              {schedule.type.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                        
                        {schedule.description && (
                          <div className="mt-2 text-sm text-neutral-600">
                            {schedule.description}
                          </div>
                        )}
                        
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
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}