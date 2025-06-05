import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertContactSchema, Contact, InsertContact, CONTACT_STATUSES, Sale, InsertSale } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/lib/maps";
import { getStatusColor, getColorStyle } from "@/lib/status-helpers";

// Extended interface to include appointment field
interface ContactData {
  fullName: string;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  appointment?: string;
  latitude?: string;
  longitude?: string;
  userId?: number;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form validation schema
const contactFormSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.union([
    z.string().email("Invalid email format"),
    z.string().length(0),
    z.null()
  ]).optional(),
  status: z.string(),
  notes: z.string().optional(),
  // Add schedule follow-up checkbox
  scheduleFollowUp: z.boolean().default(false),
  // Add appointment fields
  appointmentTitle: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  // Add sale fields
  saleProduct: z.string().optional(),
  saleAmount: z.union([
    z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
    z.string().length(0),
  ]).optional(),
  saleDate: z.string().optional(),
  saleNotes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

// Component props
interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (contact: Contact) => void;
  initialContact?: Partial<Contact>;
  isEditMode?: boolean;
}

export default function ContactForm({
  isOpen,
  onClose,
  onSuccess,
  initialContact,
  isEditMode = false
}: ContactFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAppointmentFields, setShowAppointmentFields] = useState(false);
  const [showSaleFields, setShowSaleFields] = useState(false);

  // Form setup
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      // Always use initialContact values or empty strings to prevent data persistence
      fullName: initialContact?.fullName || "",
      address: initialContact?.address || "",
      city: initialContact?.city || "",
      state: initialContact?.state || "",
      zipCode: initialContact?.zipCode || "",
      phone: initialContact?.phone || "",
      email: initialContact?.email || "",
      status: initialContact?.status || "not_visited",
      notes: initialContact?.notes || "",
      // Add scheduling checkbox
      scheduleFollowUp: false,
      // Add appointment fields with default empty values
      appointmentTitle: "",
      appointmentDate: "",
      appointmentTime: "",
      // Add sale fields with default empty values
      saleProduct: "",
      saleAmount: "",
      saleDate: new Date().toISOString().split('T')[0], // Default to today
      saleNotes: "",
    },
  });
  
  // Add a ref to track initialization state
  const hasInitializedRef = useRef(false);
  
  // Only update conditional fields visibility when dialog opens - just once
  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      // Mark as initialized to prevent further resets
      hasInitializedRef.current = true;
      
      // Check if there's an appointment in the initial contact
      const hasAppointment = initialContact?.appointment ? true : false;
      const currentStatus = initialContact?.status || "not_visited";
      
      // Initialize form with all values at once using setValue instead of reset
      form.setValue("fullName", initialContact?.fullName || "");
      form.setValue("address", initialContact?.address || "");
      form.setValue("city", initialContact?.city || "");
      form.setValue("state", initialContact?.state || "");
      form.setValue("zipCode", initialContact?.zipCode || "");
      form.setValue("phone", initialContact?.phone || "");
      form.setValue("email", initialContact?.email || "");
      form.setValue("status", currentStatus);
      form.setValue("notes", initialContact?.notes || "");
      form.setValue("scheduleFollowUp", hasAppointment);
      
      // Only set appointment fields if there's an appointment
      if (hasAppointment && initialContact?.appointment) {
        const appointmentParts = initialContact.appointment.split(" ");
        if (appointmentParts.length >= 2) {
          form.setValue("appointmentDate", appointmentParts[0]);
          form.setValue("appointmentTime", appointmentParts[1]);
        }
      }
      
      // Set default sale date for all forms
      form.setValue("saleDate", new Date().toISOString().split('T')[0]);
      
      // Set visibility flags
      setShowSaleFields(currentStatus === "sold");
      setShowAppointmentFields(hasAppointment);
      
      console.log("Dialog opened with status:", currentStatus, 
        "- Has appointment:", hasAppointment,
        "- Shows sale fields:", currentStatus === "sold");
    }
    
    // Reset the initialization flag when the dialog closes
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, initialContact, form]);

  // We've moved the reset logic to the dialog open useEffect above
  // This helps avoid conflicts between multiple form resets

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      // Go back to using the apiRequest utility which handles auth properly
      // Add our custom submission flag to the data itself since we can't add custom headers
      const response = await apiRequest("POST", "/api/contacts", {
        ...data,
        isContactFormSubmission: true
      });
      
      return response.json();
    },
    onSuccess: (newContact) => {
      form.reset();
      
      toast({
        title: "Success",
        description: "Contact has been created successfully",
      });
      
      if (onSuccess) {
        onSuccess(newContact);
      }
      
      onClose();
    },
    onError: (error) => {
      console.error("Error creating contact:", error);
      toast({
        title: "Error",
        description: "Failed to create contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Contact> }) => {
      const response = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return response.json();
    },
    onSuccess: (updatedContact) => {
      toast({
        title: "Success",
        description: "Contact has been updated successfully",
      });
      
      if (onSuccess) {
        onSuccess(updatedContact);
      }
      
      onClose();
    },
    onError: (error) => {
      console.error("Error updating contact:", error);
      toast({
        title: "Error",
        description: "Failed to update contact. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Schedule creation mutation for appointments
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await apiRequest("POST", "/api/schedules", scheduleData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate schedules query to refresh calendar
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      console.log("Schedule entry created successfully");
    },
    onError: (error) => {
      console.error("Error creating schedule entry:", error);
    },
  });

  // Create a sale record
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: any) => {
      // Use the main sales API endpoint for consistent data
      const response = await apiRequest("POST", `/api/sales`, saleData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both sales endpoints to ensure dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      if (initialContact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${initialContact.id}/sales`] });
      }
      
      toast({
        title: "Success",
        description: "Sale has been recorded successfully",
      });
    },
    onError: (error) => {
      console.error("Error creating sale:", error);
      toast({
        title: "Error",
        description: "Failed to record sale. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handler
  const onSubmit = async (formData: ContactFormValues) => {
    try {
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to create or update contacts",
          variant: "destructive",
        });
        return;
      }

      // Clean the data to ensure we only send what's expected
      const cleanData: ContactData = {
        fullName: formData.fullName,
        address: formData.address,
        city: formData.city || null,
        state: formData.state || null,
        zipCode: formData.zipCode || null,
        phone: formData.phone || null,
        email: formData.email || null,
        status: formData.status,
        notes: formData.notes || null,
      };
      
      // Add appointment data if checkbox is checked and fields are filled
      if (
        formData.scheduleFollowUp && 
        formData.appointmentDate && 
        formData.appointmentTime
      ) {
        // Format the appointment field as "YYYY-MM-DD HH:MM" string
        const appointmentStr = `${formData.appointmentDate} ${formData.appointmentTime}`;
        cleanData.appointment = appointmentStr;
        
        // We'll later create a schedule entry for this appointment
      }
      
      // Store sale details in notes field for reference
      if (formData.status === "sold") {
        // Include sale details in notes for historical reference
        let saleInfo = "";
        
        if (formData.saleProduct) {
          saleInfo += `Product/Service: ${formData.saleProduct}\n`;
        }

        if (formData.saleAmount) {
          saleInfo += `Sale Amount: $${formData.saleAmount}\n`;
        }
        
        if (formData.saleDate) {
          saleInfo += `Sale Date: ${formData.saleDate}\n`;
        }
        
        if (formData.saleNotes) {
          saleInfo += `Sale Notes: ${formData.saleNotes}\n`;
        }
        
        // Add existing notes if available
        if (formData.notes) {
          saleInfo += `\nAdditional Notes: ${formData.notes}`;
        }
        
        // Update notes field with sale information
        cleanData.notes = saleInfo.trim();
      }

      // If we already have coordinates, keep them
      let contactData: ContactData = {
        ...cleanData,
        userId: user.id,
      };

      // Always attempt to geocode the address for all contact creations and updates
      // This ensures the contact will appear on the map
      const fullAddress = `${formData.address}, ${formData.city || ''}, ${formData.state || ''} ${formData.zipCode || ''}`.trim();
      console.log("Geocoding address:", fullAddress);
      
      try {
        // Use the full address for better geocoding results
        const geocodeResult = await geocodeAddress(fullAddress);
        console.log("Geocode result:", geocodeResult);
        
        if (geocodeResult) {
          // The geocodeAddress function returns a different format than expected in the condition below
          contactData.latitude = geocodeResult.latitude;
          contactData.longitude = geocodeResult.longitude;
          
          // Update city/state/zip if they were missing and we got them from geocoding
          if (!formData.city && geocodeResult.city) {
            contactData.city = geocodeResult.city;
          }
          if (!formData.state && geocodeResult.state) {
            contactData.state = geocodeResult.state;
          }
          if (!formData.zipCode && geocodeResult.zipCode) {
            contactData.zipCode = geocodeResult.zipCode;
          }
          
          console.log("Contact with geocoded data:", contactData);
        } else {
          console.warn("Geocoding failed but continuing with submission");
          // Fall back to existing coordinates if available
          if (initialContact?.latitude && initialContact?.longitude) {
            contactData.latitude = initialContact.latitude;
            contactData.longitude = initialContact.longitude;
          }
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        // Fall back to existing coordinates if available
        if (initialContact?.latitude && initialContact?.longitude) {
          contactData.latitude = initialContact.latitude;
          contactData.longitude = initialContact.longitude;
        }
      }

      // Either create new or update existing contact
      if (isEditMode && initialContact?.id) {
        updateContactMutation.mutate({
          id: initialContact.id,
          data: contactData,
        });
        
        // Create schedule entry if appointment is set
        if (formData.scheduleFollowUp && formData.appointmentDate && formData.appointmentTime) {
          // Calculate start and end times
          const startTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + 30); // Default 30 min appointment
          
          // Create the schedule entry
          createScheduleMutation.mutate({
            userId: user.id,
            title: formData.appointmentTitle || `Appointment with ${initialContact.fullName}`,
            description: formData.notes || "",
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            type: "appointment",
            location: initialContact.address,
            reminderSent: false,
            contactIds: [initialContact.id]
          });
        }
        
        // Create sale record if status is "sold" and we have sale amount
        if (formData.status === "sold" && formData.saleAmount && initialContact.id) {
          // Create a sale record in the database
          createSaleMutation.mutate({
            contactId: initialContact.id,
            userId: user.id,
            amount: parseFloat(formData.saleAmount),
            product: formData.saleProduct || "Unknown product",
            saleDate: formData.saleDate || new Date().toISOString().split('T')[0],
            status: "completed",
            paymentMethod: "Unknown",
            notes: formData.saleNotes || "",
          });
        }
      } else {
        // For new contacts, we need to wait for the contact to be created before we can add a sale
        // Include a flag in the data to identify it's from the contact form
        const contactFormData = {
          ...contactData,
          usingContactForm: true
        };
        
        createContactMutation.mutate(contactFormData as InsertContact, {
          onSuccess: (newContact) => {
            // Create schedule entry if appointment is set
            if (formData.scheduleFollowUp && formData.appointmentDate && formData.appointmentTime && newContact.id) {
              // Calculate start and end times
              const startTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
              const endTime = new Date(startTime);
              endTime.setMinutes(endTime.getMinutes() + 30); // Default 30 min appointment
              
              // Create the schedule entry
              createScheduleMutation.mutate({
                userId: user.id,
                title: formData.appointmentTitle || `Appointment with ${newContact.fullName}`,
                description: formData.notes || "",
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                type: "appointment",
                location: newContact.address,
                reminderSent: false,
                contactIds: [newContact.id]
              });
            }
            
            // Create sale record if status is "sold" and we have sale amount
            if (formData.status === "sold" && formData.saleAmount && newContact.id) {
              // Create a sale record in the database
              createSaleMutation.mutate({
                contactId: newContact.id,
                userId: user.id,
                amount: parseFloat(formData.saleAmount),
                product: formData.saleProduct || "Unknown product",
                saleDate: formData.saleDate || new Date().toISOString().split('T')[0],
                status: "completed",
                paymentMethod: "Unknown",
                notes: formData.saleNotes || "",
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Error with contact form:", error);
      toast({
        title: `Error ${isEditMode ? 'updating' : 'creating'} contact`,
        description: `An unexpected error occurred while ${isEditMode ? 'updating' : 'creating'} the contact.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Contact" : "Add New Contact"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Update the contact details below." 
              : "Enter the contact details below to add a new contact to your database."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter name (required)" 
                      // Do NOT spread field props here as it would override our value
                      // Don't use explicit value={field.value} - it causes reset conflicts
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      onChange={(e) => {
                        // Simply pass the event value to field.onChange
                        field.onChange(e.target.value);
                      }}
                      // Ensure the input shows what the user types, not what form.reset sets
                      defaultValue={field.value || ""}
                      autoFocus // Automatically focus this field for better UX
                    />
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
                      <Input placeholder="City" {...field} value={field.value || ""} />
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
                      <Input placeholder="State" {...field} value={field.value || ""} />
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
                      <Input placeholder="Zip Code" {...field} value={field.value || ""} />
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
                    onValueChange={(value) => {
                      // First update the form field without triggering reset
                      form.setValue("status", value);
                      
                      // Show sale fields if status is "sold"
                      const needsSale = value === "sold";
                      setShowSaleFields(needsSale);
                      
                      console.log("Status changed to:", value, 
                        "- Now showing sale fields:", needsSale);
                      
                      // If switching to sold status, pre-set the sale date to today
                      if (value === "sold") {
                        form.setValue("saleDate", new Date().toISOString().split('T')[0]);
                      }
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="relative">
                        <div className="flex items-center gap-2">
                          <span 
                            className={`inline-block w-3 h-3 rounded-full ${getStatusColor(field.value)}`}
                            style={getColorStyle(field.value)}
                          ></span>
                          <SelectValue placeholder="Select a status" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CONTACT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <span 
                              className={`inline-block w-3 h-3 rounded-full ${getStatusColor(status)}`}
                              style={getColorStyle(status)}
                            ></span>
                            <span>
                              {status
                                .split("_")
                                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(" ")}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Schedule Follow-up Checkbox */}
            <FormField
              control={form.control}
              name="scheduleFollowUp"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        // Use form.setValue instead of field.onChange to prevent form reset
                        form.setValue("scheduleFollowUp", !!checked);
                        setShowAppointmentFields(!!checked);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Schedule a follow-up or appointment
                    </FormLabel>
                    <FormDescription>
                      Check this box to set a date and time for follow-up
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Show appointment fields if checkbox is selected */}
            {showAppointmentFields && (
              <div className="space-y-4 border border-blue-200 bg-blue-50 p-4 rounded-md">
                <h3 className="text-md font-semibold text-blue-700">
                  {form.getValues().status === "booked" ? "Schedule Appointment" : "Schedule Follow-up"}
                </h3>
                <FormField
                  control={form.control}
                  name="appointmentTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter appointment title..."
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
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
                            value={field.value || ""} 
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
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            
            {/* Show sale fields if status is sold */}
            {showSaleFields && (
              <div className="space-y-4 border border-green-200 bg-green-50 p-4 rounded-md">
                <h3 className="text-md font-semibold text-green-700">
                  Record Sale Details
                </h3>
                <FormField
                  control={form.control}
                  name="saleProduct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product/Service</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="What was sold?"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <FormField
                    control={form.control}
                    name="saleAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Amount ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text"
                            placeholder="0.00" 
                            {...field} 
                            value={field.value || ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="saleDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sale Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            value={field.value || new Date().toISOString().split('T')[0]} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="saleNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes about this sale..." 
                          {...field} 
                          value={field.value || ""} 
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                      {...field} 
                      value={field.value || ""} 
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {createContactMutation.isPending || updateContactMutation.isPending
                  ? "Saving..."
                  : isEditMode ? "Update Contact" : "Add Contact"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}