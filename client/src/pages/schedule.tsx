import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Schedule, InsertSchedule, Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertScheduleSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO, isSameDay, addHours } from "date-fns";
import { cn } from "@/lib/utils";
import { FREE_PLAN_LIMITS, UserRole } from "@/lib/auth";

// Extended schema with validation
const scheduleFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  startTime: z.date(),
  endTime: z.date(),
  type: z.string(),
  contactIds: z.array(z.number()).optional(),
});

type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

export default function SchedulePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get schedules
  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
  });

  // Get contacts for selection
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Create schedule form
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: addHours(new Date(), 1),
      endTime: addHours(new Date(), 2),
      type: "appointment",
      contactIds: [],
    },
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (schedule: InsertSchedule) => {
      const res = await apiRequest("POST", "/api/schedules", schedule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      setIsCreateModalOpen(false);
      form.reset();
      toast({
        title: "Schedule created",
        description: "Your schedule was successfully created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create schedule",
        description: error.message || "There was an error creating your schedule",
        variant: "destructive",
      });
    },
  });

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/schedules/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule deleted",
        description: "Schedule was successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete schedule",
        description: "There was an error deleting the schedule",
        variant: "destructive",
      });
    },
  });

  // Filter schedules for selected date
  const schedulesForSelectedDate = schedules.filter((schedule) => {
    const scheduleDate = parseISO(schedule.startTime.toString());
    return isSameDay(scheduleDate, selectedDate);
  }).sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  // Get schedule color based on type
  const getScheduleTypeColor = (type: string) => {
    switch (type) {
      case "route":
        return "bg-blue-50 border-l-4 border-primary";
      case "follow_up":
        return "bg-green-50 border-l-4 border-success";
      case "appointment":
        return "bg-yellow-50 border-l-4 border-warning";
      default:
        return "bg-neutral-50 border-l-4 border-neutral-400";
    }
  };

  // Format time
  const formatTime = (date: string | Date) => {
    return format(new Date(date), "h:mm a");
  };

  // Handle form submit
  const onSubmit = (data: ScheduleFormValues) => {
    // Check if at free plan limit
    if (user?.role === UserRole.FREE && schedules.length >= FREE_PLAN_LIMITS.schedules) {
      toast({
        title: "Schedule limit reached",
        description: `Free plan is limited to ${FREE_PLAN_LIMITS.schedules} schedules. Please upgrade to Pro for unlimited schedules.`,
        variant: "destructive",
      });
      return;
    }

    // Validate that end time is after start time
    if (data.endTime <= data.startTime) {
      toast({
        title: "Invalid time range",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    createScheduleMutation.mutate({
      ...data,
      userId: user?.id || 0,
    });
  };

  // Open create modal with pre-filled date
  const handleAddSchedule = (date?: Date) => {
    const defaultStartTime = date ? addHours(date, 9) : addHours(new Date(), 1);
    const defaultEndTime = date ? addHours(date, 10) : addHours(new Date(), 2);
    
    form.reset({
      title: "",
      description: "",
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      type: "appointment",
      contactIds: [],
    });
    
    setIsCreateModalOpen(true);
  };

  // Check if at schedule limit
  const isAtScheduleLimit = user?.role === UserRole.FREE && schedules.length >= FREE_PLAN_LIMITS.schedules;

  // Count dots to show on calendar
  const scheduleCounts = schedules.reduce((acc: Record<string, number>, schedule) => {
    const dateStr = format(new Date(schedule.startTime), "yyyy-MM-dd");
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-neutral-800">Schedule</h1>
          <p className="text-neutral-500">Manage your appointments and routes</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
            onClick={() => handleAddSchedule()}
            disabled={isAtScheduleLimit}
            className="flex items-center"
          >
            <span className="material-icons text-sm mr-1">add</span>
            Add Schedule
          </Button>
          {isAtScheduleLimit && (
            <p className="text-xs text-red-500 mt-1">
              Free plan limited to {FREE_PLAN_LIMITS.schedules} schedules. Please upgrade to Pro.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              modifiers={{
                dots: (date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  return !!scheduleCounts[dateStr];
                },
              }}
              modifiersStyles={{
                dots: {
                  position: "relative",
                }
              }}
              modifiersClassNames={{
                dots: "dot-calendar",
              }}
              styles={{
                day_today: { fontWeight: "bold", border: "1px solid #000" },
                day_selected: {
                  backgroundColor: "hsl(var(--primary))",
                  color: "white",
                  fontWeight: "bold",
                },
              }}
            />
            <style jsx global>{`
              .dot-calendar::after {
                content: "";
                position: absolute;
                bottom: 2px;
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background-color: hsl(var(--primary));
              }
            `}</style>
          </CardContent>
        </Card>

        {/* Schedule for Selected Day */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
            <Button 
              onClick={() => handleAddSchedule(selectedDate)}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={isAtScheduleLimit}
            >
              <span className="material-icons text-sm mr-1">add</span>
              Add
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : schedulesForSelectedDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-icons text-5xl text-neutral-300 mb-3">event_busy</span>
                <h3 className="text-lg font-medium text-neutral-700 mb-1">No schedules for this day</h3>
                <p className="text-neutral-500 mb-4">Add an appointment or route for {format(selectedDate, "MMMM d")}</p>
                <Button 
                  onClick={() => handleAddSchedule(selectedDate)}
                  variant="outline"
                  disabled={isAtScheduleLimit}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  Add Schedule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {schedulesForSelectedDate.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`flex items-center p-3 rounded ${getScheduleTypeColor(schedule.type)}`}
                  >
                    <div className="flex-shrink-0 mr-3 text-center">
                      <div className="text-xs text-neutral-500">
                        {formatTime(schedule.startTime)}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {formatTime(schedule.endTime)}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-sm font-medium text-neutral-800">{schedule.title}</h4>
                      <div className="text-xs text-neutral-600">{schedule.description}</div>
                      {schedule.type === "route" && schedule.contactIds && (
                        <div className="text-xs text-neutral-600">
                          {schedule.contactIds.length} houses planned
                        </div>
                      )}
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this schedule?")) {
                            deleteScheduleMutation.mutate(schedule.id);
                          }
                        }}
                      >
                        <span className="material-icons text-neutral-500">delete</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Schedule Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Schedule</DialogTitle>
            <DialogDescription>
              Create a new appointment, route, or follow-up.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Morning Route" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional details"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={format(field.value, "yyyy-MM-dd")}
                          onChange={(e) => {
                            const date = e.target.value;
                            const time = format(field.value, "HH:mm");
                            field.onChange(new Date(`${date}T${time}`));
                          }}
                        />
                        <Input
                          type="time"
                          value={format(field.value, "HH:mm")}
                          onChange={(e) => {
                            const date = format(field.value, "yyyy-MM-dd");
                            const time = e.target.value;
                            field.onChange(new Date(`${date}T${time}`));
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="date"
                          value={format(field.value, "yyyy-MM-dd")}
                          onChange={(e) => {
                            const date = e.target.value;
                            const time = format(field.value, "HH:mm");
                            field.onChange(new Date(`${date}T${time}`));
                          }}
                        />
                        <Input
                          type="time"
                          value={format(field.value, "HH:mm")}
                          onChange={(e) => {
                            const date = format(field.value, "yyyy-MM-dd");
                            const time = e.target.value;
                            field.onChange(new Date(`${date}T${time}`));
                          }}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="route">Route</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {form.watch("type") === "route" && (
                <FormField
                  control={form.control}
                  name="contactIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Contacts</FormLabel>
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                        {contacts.length === 0 ? (
                          <p className="text-sm text-neutral-500">No contacts available</p>
                        ) : (
                          <div className="space-y-2">
                            {contacts.map((contact) => (
                              <div key={contact.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`contact-${contact.id}`}
                                  checked={field.value?.includes(contact.id)}
                                  onCheckedChange={(checked) => {
                                    const currentValues = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentValues, contact.id]);
                                    } else {
                                      field.onChange(
                                        currentValues.filter((id) => id !== contact.id)
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`contact-${contact.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  {contact.fullName} - {contact.address.split(',')[0]}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createScheduleMutation.isPending}
                >
                  {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
