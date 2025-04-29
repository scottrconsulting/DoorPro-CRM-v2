import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertContactSchema, Contact, InsertContact, InsertSchedule, InsertSale, InsertVisit, CONTACT_STATUSES } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { FREE_PLAN_LIMITS, UserRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/maps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Contact form coordinates type
export interface ContactFormCoords {
  lat: number;
  lng: number;
}

// Extended schema with validation
const contactFormSchema = insertContactSchema.extend({
  address: z.string().min(5, "Address must be at least 5 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  notes: z.string().optional(),
  id: z.number().optional(), // For editing existing contacts
});

// Sale form schema
const saleFormSchema = z.object({
  amount: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  product: z.string().min(1, "Product name is required"),
  saleDate: z.string().min(1, "Sale date is required"),
  notes: z.string().optional(),
});

// Visit form schema
const visitFormSchema = z.object({
  visitDate: z.string().min(1, "Visit date is required"),
  visitType: z.string().min(1, "Visit type is required"),
  outcome: z.string().min(1, "Outcome is required"),
  notes: z.string().optional(),
  followUpNeeded: z.boolean().default(false),
});

// Document form schema
const documentFormSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  type: z.string().min(1, "Document type is required"),
  file: z.instanceof(File).optional(),
});

// Form values type
type ContactFormValues = z.infer<typeof contactFormSchema>;
type SaleFormValues = z.infer<typeof saleFormSchema>;
type VisitFormValues = z.infer<typeof visitFormSchema>;
type DocumentFormValues = z.infer<typeof documentFormSchema>;

// Component props
interface UniversalContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: ContactFormCoords | null;
  initialAddress?: string;
  initialContact?: Partial<Contact>; // For editing existing contacts
  isAdding?: boolean; // Whether we're adding or editing
  onSuccess?: (contact: Contact) => void;
}

export default function UniversalContactForm({
  isOpen,
  onClose,
  initialCoords,
  initialAddress,
  initialContact,
  isAdding = true,
  onSuccess,
}: UniversalContactFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);
  const [activeTab, setActiveTab] = useState("contact"); // Default to contact tab
  
  // Use initialContact to determine if we're in editing mode
  const isEditMode = !isAdding;
  
  // Parse appointment data from contact if available
  let appointmentDate = "";
  let appointmentTime = "";
  
  if (initialContact?.appointment) {
    try {
      const [datePart, timePart] = initialContact.appointment.split(' ');
      appointmentDate = datePart || "";
      appointmentTime = timePart || "";
    } catch (error) {
      console.error("Error parsing appointment:", error);
    }
  }

  // Create contact form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      id: initialContact?.id,
      fullName: initialContact?.fullName || "",
      address: initialContact?.address || initialAddress || "",
      city: initialContact?.city || "",
      state: initialContact?.state || "",
      zipCode: initialContact?.zipCode || "",
      phone: initialContact?.phone || "",
      email: initialContact?.email || "",
      status: initialContact?.status || "not_visited",
      userId: user?.id || 0,
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime,
      notes: initialContact?.notes || "",
    },
  });
  
  // Create sale form
  const saleForm = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      amount: "",
      product: "",
      saleDate: new Date().toISOString().split("T")[0], // Today's date
      notes: "",
    },
  });
  
  // Create visit form
  const visitForm = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      visitDate: new Date().toISOString().split("T")[0], // Today's date
      visitType: "in_person",
      outcome: "neutral",
      notes: "",
      followUpNeeded: false,
    },
  });
  
  // Create document form
  const documentForm = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      title: "",
      type: "contract",
    },
  });

  // Update form when initialAddress changes
  useEffect(() => {
    if (initialAddress) {
      form.setValue("address", initialAddress);
    }
  }, [initialAddress, form]);

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contact: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contact);
      return res.json();
    },
    onSuccess: (data: Contact) => {
      // If contact was created and has booked or check_back status, create a schedule entry
      if (data && (data.status === 'booked' || data.status === 'check_back')) {
        createScheduleEntry(data);
      }
      
      form.reset();
      onClose();
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create contact",
        description: error.message || "There was an error creating your contact",
        variant: "destructive",
      });
    },
  });
  
  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: { id: number, contact: Partial<Contact> }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${data.id}`, data.contact);
      return res.json();
    },
    onSuccess: (data: Contact) => {
      // If contact was updated and has booked or check_back status, update schedule entry
      if (data && (data.status === 'booked' || data.status === 'check_back')) {
        createScheduleEntry(data);
      }
      
      form.reset();
      onClose();
      
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${data.id}`] });
      
      if (onSuccess) {
        onSuccess(data);
      }
      
      toast({
        title: "Contact updated",
        description: "Contact information has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update contact",
        description: error.message || "There was an error updating this contact",
        variant: "destructive",
      });
    },
  });
  
  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (sale: InsertSale) => {
      const res = await apiRequest("POST", "/api/sales", sale);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      if (initialContact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${initialContact.id}/sales`] });
      }
      
      saleForm.reset({
        amount: "",
        product: "",
        saleDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      
      toast({
        title: "Sale recorded",
        description: "Sale has been recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record sale",
        description: error.message || "There was an error recording this sale",
        variant: "destructive",
      });
    },
  });
  
  // Create visit mutation
  const createVisitMutation = useMutation({
    mutationFn: async (visit: InsertVisit) => {
      const res = await apiRequest("POST", "/api/visits", visit);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
      if (initialContact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${initialContact.id}/visits`] });
      }
      
      visitForm.reset({
        visitDate: new Date().toISOString().split("T")[0],
        visitType: "in_person",
        outcome: "neutral",
        notes: "",
        followUpNeeded: false,
      });
      
      toast({
        title: "Visit recorded",
        description: "Visit has been recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record visit",
        description: error.message || "There was an error recording this visit",
        variant: "destructive",
      });
    },
  });
  
  // Create document upload mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Using FormData option
      const res = await apiRequest("POST", "/api/documents", formData, {
        isFormData: true
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (initialContact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${initialContact.id}/documents`] });
      }
      
      documentForm.reset({
        title: "",
        type: "contract",
      });
      
      toast({
        title: "Document uploaded",
        description: "Document has been uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to upload document",
        description: error.message || "There was an error uploading this document",
        variant: "destructive",
      });
    },
  });
  
  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: InsertSchedule) => {
      const res = await apiRequest("POST", "/api/schedules", scheduleData);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule created",
        description: variables.type === 'appointment' 
          ? "Appointment has been added to your schedule" 
          : "Follow-up has been added to your schedule",
      });
    },
    onError: (error: any) => {
      console.error("Schedule creation error:", error);
      toast({
        title: "Schedule error",
        description: "There was an error adding this to your schedule",
        variant: "destructive",
      });
    },
  });
  
  // Helper function to create a schedule entry based on contact status
  const createScheduleEntry = (contact: Contact) => {
    if (!contact.appointment || !user) return;
    
    try {
      // Parse the appointment string
      const [datePart, timePart] = contact.appointment.split(' ');
      if (!datePart || !timePart) return;
      
      // Create Date objects for start and end times (default 30min appointment)
      const startTime = new Date(`${datePart}T${timePart}`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);
      
      // Create schedule data based on contact status
      const scheduleData: InsertSchedule = {
        userId: user.id,
        title: contact.status === 'booked' 
          ? `Appointment with ${contact.fullName}`
          : `Follow-up with ${contact.fullName}`,
        description: `${contact.status === 'booked' ? 'Appointment' : 'Follow-up'} at ${contact.address}`,
        startTime: startTime,
        endTime: endTime,
        type: contact.status === 'booked' ? 'appointment' : 'follow_up',
        location: contact.address,
        contactIds: [contact.id],
        reminderSent: false,
      };
      
      createScheduleMutation.mutate(scheduleData);
    } catch (error) {
      console.error("Error creating schedule entry:", error);
    }
  };

  // Watch status to show scheduling fields
  const currentStatus = form.watch("status");
  
  useEffect(() => {
    // Show scheduling fields for booked and check_back statuses
    setShowSchedulingFields(currentStatus === "booked" || currentStatus === "check_back");
  }, [currentStatus]);

  // Handle form submit for the contact tab
  const onSubmit = async (data: ContactFormValues) => {
    // Check if at free plan limit
    if (!isEditMode && user?.role === UserRole.FREE && FREE_PLAN_LIMITS.contacts) {
      // You would need to check against current contact count here
      // For now, we'll assume it's handled at the API level
    }

    // Format appointment data if scheduling is enabled
    let appointmentData = null;
    if (showSchedulingFields && (data.status === 'booked' || data.status === 'check_back') && 
        data.appointmentDate && data.appointmentTime) {
      appointmentData = `${data.appointmentDate} ${data.appointmentTime}`;
    }

    try {
      // Handle editing existing contact
      if (isEditMode && initialContact?.id) {
        const contactUpdateData = {
          ...data,
          appointment: appointmentData,
        };
        delete contactUpdateData.id; // Remove ID from update payload
        
        updateContactMutation.mutate({
          id: initialContact.id,
          contact: contactUpdateData as Partial<Contact>,
        });
        return;
      }
      
      // Handle creating new contact
      let contactData: InsertContact;
      
      // If coordinates are provided (from map click), use them directly
      if (initialCoords) {
        contactData = {
          ...data,
          latitude: String(initialCoords.lat),
          longitude: String(initialCoords.lng),
          appointment: appointmentData,
        };
        createContactMutation.mutate(contactData);
      } else {
        // Otherwise geocode the address to get coordinates
        try {
          const geocodeResult = await geocodeAddress(data.address);
          
          if (geocodeResult) {
            // Create contact with coordinates
            contactData = {
              ...data,
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              address: geocodeResult.address, // Use formatted address from geocoding
              appointment: appointmentData,
            };
            createContactMutation.mutate(contactData);
          } else {
            // Create contact without coordinates
            toast({
              title: "Address not found",
              description: "Could not find coordinates for this address. Contact will be created without map location.",
              variant: "default",
            });
            contactData = {
              ...data,
              appointment: appointmentData,
            };
            createContactMutation.mutate(contactData);
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          contactData = {
            ...data,
            appointment: appointmentData,
          };
          createContactMutation.mutate(contactData);
        }
      }
    } catch (error) {
      console.error("Error with contact:", error);
      toast({
        title: `Error ${isEditMode ? 'updating' : 'creating'} contact`,
        description: `An unexpected error occurred while ${isEditMode ? 'updating' : 'creating'} the contact.`,
        variant: "destructive",
      });
    }
  };
  
  // Handle sale form submission
  const onSubmitSale = (data: SaleFormValues) => {
    if (!initialContact?.id || !user?.id) {
      toast({
        title: "Cannot record sale",
        description: "Contact must be saved first before recording a sale",
        variant: "destructive",
      });
      return;
    }
    
    const saleData: InsertSale = {
      contactId: initialContact.id,
      userId: user.id,
      amount: parseFloat(data.amount),
      product: data.product,
      saleDate: new Date(data.saleDate),
      notes: data.notes || "",
      status: "completed", // Set default sale status
    };
    
    createSaleMutation.mutate(saleData);
  };
  
  // Handle visit form submission
  const onSubmitVisit = (data: VisitFormValues) => {
    if (!initialContact?.id || !user?.id) {
      toast({
        title: "Cannot record visit",
        description: "Contact must be saved first before recording a visit",
        variant: "destructive",
      });
      return;
    }
    
    const visitData: InsertVisit = {
      contactId: initialContact.id,
      userId: user.id,
      visitType: data.visitType,
      outcome: data.outcome,
      notes: data.notes || "",
      followUpNeeded: data.followUpNeeded,
      visitDate: new Date(data.visitDate),
    };
    
    createVisitMutation.mutate(visitData);
  };
  
  // Handle document form submission
  const onSubmitDocument = (data: DocumentFormValues) => {
    if (!initialContact?.id || !user?.id) {
      toast({
        title: "Cannot upload document",
        description: "Contact must be saved first before uploading documents",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('contactId', initialContact.id.toString());
    formData.append('userId', user.id.toString());
    formData.append('title', data.title);
    formData.append('type', data.type);
    formData.append('file', data.file);
    
    createDocumentMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update contact information or manage related data." 
              : "Enter the contact details below to add a new contact to your database."}
          </DialogDescription>
        </DialogHeader>

        {/* Tab interface for editing mode */}
        {isEditMode ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 mb-4">
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="sales" disabled={!initialContact?.id}>Sales</TabsTrigger>
              <TabsTrigger value="visits" disabled={!initialContact?.id}>Visits</TabsTrigger>
              <TabsTrigger value="documents" disabled={!initialContact?.id}>Documents</TabsTrigger>
            </TabsList>
            
            {/* Contact Info Tab */}
            <TabsContent value="contact">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Zip Code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(555) 123-4567" 
                        value={field.value || ""} 
                        onChange={field.onChange} 
                        onBlur={field.onBlur} 
                        name={field.name} 
                        ref={field.ref} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="john.doe@example.com" 
                        value={field.value || ""} 
                        onChange={field.onChange} 
                        onBlur={field.onBlur} 
                        name={field.name} 
                        ref={field.ref} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status
                            .split("_")
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(" ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduling section only for booked and check_back statuses */}
            {showSchedulingFields && (
              <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-700">
                    {currentStatus === "booked" ? "Appointment Details" : "Follow-up Details"}
                  </h3>
                  <div className="flex items-center">
                    <Checkbox 
                      id="enableScheduling"
                      checked={showSchedulingFields}
                      onCheckedChange={(checked) => setShowSchedulingFields(!!checked)}
                    />
                    <Label htmlFor="enableScheduling" className="ml-2 text-sm">
                      {currentStatus === "booked" ? "Schedule Appointment" : "Schedule Follow-up"}
                    </Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="appointmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="appointmentTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input 
                            type="time"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this contact..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createContactMutation.isPending || updateContactMutation.isPending}
              >
                {isEditMode 
                  ? (updateContactMutation.isPending ? "Updating..." : "Update Contact")
                  : (createContactMutation.isPending ? "Adding..." : "Add Contact")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
        </TabsContent>
        
        {/* Sales Tab */}
        <TabsContent value="sales">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Record a Sale</h3>
            <Form {...saleForm}>
              <form onSubmit={saleForm.handleSubmit(onSubmitSale)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={saleForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={saleForm.control}
                    name="product"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product/Service</FormLabel>
                        <FormControl>
                          <Input placeholder="Product name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={saleForm.control}
                  name="saleDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={saleForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details about the sale..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit"
                  disabled={createSaleMutation.isPending}
                >
                  {createSaleMutation.isPending ? "Recording..." : "Record Sale"}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
        
        {/* Visits Tab */}
        <TabsContent value="visits">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Record a Visit</h3>
            <Form {...visitForm}>
              <form onSubmit={visitForm.handleSubmit(onSubmitVisit)} className="space-y-4">
                <FormField
                  control={visitForm.control}
                  name="visitDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={visitForm.control}
                    name="visitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in_person">In Person</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={visitForm.control}
                    name="outcome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outcome</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="positive">Positive</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="negative">Negative</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={visitForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details about the visit..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={visitForm.control}
                  name="followUpNeeded"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4 border">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Follow-up needed
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Check if a follow-up action is required
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit"
                  disabled={createVisitMutation.isPending}
                >
                  {createVisitMutation.isPending ? "Recording..." : "Record Visit"}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
        
        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Upload a Document</h3>
            <Form {...documentForm}>
              <form className="space-y-4">
                <FormField
                  control={documentForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Contract title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={documentForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center">
                  <Input 
                    type="file" 
                    className="w-full" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        documentForm.setValue('file', e.target.files[0]);
                      }
                    }}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Upload PDF, Word, or image files
                  </p>
                </div>
                <Button 
                  type="button"
                  onClick={documentForm.handleSubmit(onSubmitDocument)}
                  disabled={createDocumentMutation.isPending}
                >
                  {createDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
                </Button>
              </form>
            </Form>
          </div>
        </TabsContent>
      </Tabs>
    ) : (
      // Add New Contact mode - simple form without tabs
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="City" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="State" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Zip Code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(555) 123-4567" 
                      value={field.value || ""} 
                      onChange={field.onChange} 
                      onBlur={field.onBlur} 
                      name={field.name} 
                      ref={field.ref} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="john.doe@example.com" 
                      value={field.value || ""} 
                      onChange={field.onChange} 
                      onBlur={field.onBlur} 
                      name={field.name} 
                      ref={field.ref} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONTACT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status
                          .split("_")
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Scheduling section only for booked and check_back statuses */}
          {showSchedulingFields && (
            <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-700">
                  {currentStatus === "booked" ? "Appointment Details" : "Follow-up Details"}
                </h3>
                <div className="flex items-center">
                  <Checkbox 
                    id="enableScheduling"
                    checked={showSchedulingFields}
                    onCheckedChange={(checked) => setShowSchedulingFields(!!checked)}
                  />
                  <Label htmlFor="enableScheduling" className="ml-2 text-sm">
                    {currentStatus === "booked" ? "Schedule Appointment" : "Schedule Follow-up"}
                  </Label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="appointmentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appointmentTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Additional notes about this contact..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Adding..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    )}
      </DialogContent>
    </Dialog>
  );
}