import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertContactSchema, Contact, InsertContact, CONTACT_STATUSES } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/lib/maps";

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
  // Add appointment fields
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  // Add sale fields
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
      // Add appointment fields with default empty values
      appointmentDate: "",
      appointmentTime: "",
      // Add sale fields with default empty values
      saleAmount: "",
      saleDate: new Date().toISOString().split('T')[0], // Default to today
      saleNotes: "",
    },
  });
  
  // Update conditional fields visibility and reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Reset the form to initialContact values when dialog opens
      form.reset({
        fullName: initialContact?.fullName || "", // Critical: Use initialContact value
        address: initialContact?.address || "",
        city: initialContact?.city || "",
        state: initialContact?.state || "",
        zipCode: initialContact?.zipCode || "",
        phone: initialContact?.phone || "",
        email: initialContact?.email || "",
        status: initialContact?.status || "not_visited",
        notes: initialContact?.notes || "",
        appointmentDate: "",
        appointmentTime: "",
        saleAmount: "",
        saleDate: new Date().toISOString().split('T')[0],
        saleNotes: "",
      });
      
      const currentStatus = initialContact?.status || "not_visited";
      // Set visibility flags based on status
      setShowAppointmentFields(currentStatus === "booked" || currentStatus === "check_back");
      setShowSaleFields(currentStatus === "sold");
      
      console.log("Dialog opened with status:", currentStatus, 
        "- Shows appointment fields:", currentStatus === "booked" || currentStatus === "check_back",
        "- Shows sale fields:", currentStatus === "sold");
    }
  }, [isOpen, form, initialContact]);

  // We've moved the reset logic to the dialog open useEffect above
  // This helps avoid conflicts between multiple form resets

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const response = await apiRequest("POST", "/api/contacts", data);
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
      
      // Add appointment data if it's available
      if (
        (formData.status === "booked" || formData.status === "check_back") &&
        formData.appointmentDate && 
        formData.appointmentTime
      ) {
        // Format the appointment field as "YYYY-MM-DD HH:MM" string
        const appointmentStr = `${formData.appointmentDate} ${formData.appointmentTime}`;
        cleanData.appointment = appointmentStr;
      }
      
      // Add sale data if it's available and status is sold
      if (formData.status === "sold") {
        // Store sale details in the notes field using a structured format
        // This way we don't need to add schema fields for sales data
        let saleInfo = "";
        
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
      } else {
        createContactMutation.mutate(contactData as InsertContact);
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
                      {...field} 
                      // Make sure we use the value directly from the field to ensure reset works
                      value={field.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value);
                      }}
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
                      // First update the form field
                      field.onChange(value);
                      
                      // Then check if we need to show the appointment fields
                      const needsAppointment = value === "booked" || value === "check_back";
                      const needsSale = value === "sold";
                      
                      setShowAppointmentFields(needsAppointment);
                      setShowSaleFields(needsSale);
                      
                      console.log("Status changed to:", value, 
                        "- Now showing appointment fields:", needsAppointment,
                        "- Now showing sale fields:", needsSale);
                      
                      // If switching to sold status, pre-set the sale date to today
                      if (value === "sold") {
                        form.setValue("saleDate", new Date().toISOString().split('T')[0]);
                      }
                    }} 
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

            {/* Show appointment fields if status is booked or check_back */}
            {showAppointmentFields && (
              <div className="space-y-4 border border-blue-200 bg-blue-50 p-4 rounded-md">
                <h3 className="text-md font-semibold text-blue-700">
                  {form.getValues().status === "booked" ? "Schedule Appointment" : "Schedule Follow-up"}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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