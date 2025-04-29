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
  email: z.string().email("Invalid email format").optional().nullable(),
  status: z.string(),
  notes: z.string().optional(),
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

  // Form setup
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: initialContact?.fullName || "",
      address: initialContact?.address || "",
      city: initialContact?.city || "",
      state: initialContact?.state || "",
      zipCode: initialContact?.zipCode || "",
      phone: initialContact?.phone || "",
      email: initialContact?.email || "",
      status: initialContact?.status || "not_visited",
      notes: initialContact?.notes || "",
    },
  });

  // Reset form when initialContact changes
  useEffect(() => {
    if (initialContact) {
      form.reset({
        fullName: initialContact.fullName || "",
        address: initialContact.address || "",
        city: initialContact.city || "",
        state: initialContact.state || "",
        zipCode: initialContact.zipCode || "",
        phone: initialContact.phone || "",
        email: initialContact.email || "",
        status: initialContact.status || "not_visited",
        notes: initialContact.notes || "",
      });
    }
  }, [initialContact, form]);

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
      const cleanData = {
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

      // If we already have coordinates, keep them
      let contactData: any = {
        ...cleanData,
        userId: user.id,
      };

      if (initialContact?.latitude && initialContact?.longitude) {
        contactData.latitude = initialContact.latitude;
        contactData.longitude = initialContact.longitude;
      } else {
        // Try to geocode the address if we don't have coordinates
        try {
          const geocodeResult = await geocodeAddress(formData.address);
          if (geocodeResult && 
              typeof geocodeResult === 'object' && 
              'lat' in geocodeResult && 
              'lng' in geocodeResult &&
              geocodeResult.lat !== undefined &&
              geocodeResult.lng !== undefined) {
            contactData.latitude = String(geocodeResult.lat);
            contactData.longitude = String(geocodeResult.lng);
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          // Continue with submission even if geocoding fails
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