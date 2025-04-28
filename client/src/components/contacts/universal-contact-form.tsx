import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertContactSchema, Contact, InsertContact, CONTACT_STATUSES } from "@shared/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
});

// Form values type
type ContactFormValues = z.infer<typeof contactFormSchema>;

// Component props
interface UniversalContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: ContactFormCoords | null;
  initialAddress?: string;
  onSuccess?: (contact: Contact) => void;
}

export default function UniversalContactForm({
  isOpen,
  onClose,
  initialCoords,
  initialAddress,
  onSuccess,
}: UniversalContactFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);

  // Create contact form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      address: initialAddress || "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      email: "",
      status: "not_visited",
      userId: user?.id || 0,
      appointmentDate: "",
      appointmentTime: "",
      notes: "",
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

  // Watch status to show scheduling fields
  const currentStatus = form.watch("status");
  
  useEffect(() => {
    // Show scheduling fields for booked and check_back statuses
    setShowSchedulingFields(currentStatus === "booked" || currentStatus === "check_back");
  }, [currentStatus]);

  // Handle form submit
  const onSubmit = async (data: ContactFormValues) => {
    // Check if at free plan limit
    if (user?.role === UserRole.FREE && FREE_PLAN_LIMITS.contacts) {
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
      console.error("Error creating contact:", error);
      toast({
        title: "Error creating contact",
        description: "An unexpected error occurred while creating the contact.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Enter the contact details below to add a new contact to your database.
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
      </DialogContent>
    </Dialog>
  );
}