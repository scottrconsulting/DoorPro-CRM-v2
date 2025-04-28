import { useState } from "react";
import { Contact, InsertContact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { geocodeAddress } from "@/lib/maps";
import { Switch } from "@/components/ui/switch";
import { MessageTemplate } from "@shared/schema";

export interface ContactFormCoords {
  lat: number;
  lng: number;
}

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
  onSuccess
}: UniversalContactFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: "",
    address: initialAddress || "",
    city: "",
    state: "",
    zipCode: "",
    email: "",
    phone: "",
    status: "not_visited",
    notes: "",
    appointmentDate: "",
    appointmentTime: "",
  });
  
  // Additional form control state
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [confirmationMethod, setConfirmationMethod] = useState("email");
  const [addToSchedule, setAddToSchedule] = useState(false);
  
  // Fetch message templates for confirmations
  const { data: messageTemplates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
    enabled: !!user,
  });
  
  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contact: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contact);
      return res.json();
    },
    onSuccess: (newContact: Contact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      toast({
        title: "Contact created",
        description: "Your contact was successfully created"
      });
      
      // If confirmation requested, send it
      if (
        sendConfirmation && 
        (formData.status === "booked" || formData.status === "check_back") && 
        formData.appointmentDate && 
        formData.appointmentTime
      ) {
        sendConfirmationMutation.mutate({
          contactId: newContact.id,
          method: confirmationMethod,
          appointmentDate: formData.appointmentDate,
          appointmentTime: formData.appointmentTime,
        });
      }
      
      // If adding to schedule is requested
      if (
        addToSchedule && 
        (formData.status === "booked" || formData.status === "check_back") && 
        formData.appointmentDate && 
        formData.appointmentTime
      ) {
        // Calculate end time (1 hour after start)
        const [hours, minutes] = formData.appointmentTime.split(':');
        const startDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // Add 1 hour
        
        const scheduleData = {
          title: `${formData.status === "booked" ? "Appointment" : "Check Back"}: ${formData.fullName}`,
          type: formData.status === "booked" ? "appointment" : "follow_up",
          description: `${formData.address}\n${formData.notes ? formData.notes : ""}`,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          location: formData.address,
          contactIds: [newContact.id],
          confirmationMethod: formData.status === "booked" ? confirmationMethod : undefined,
          confirmationStatus: formData.status === "booked" ? "pending" : undefined,
        };
        
        createScheduleMutation.mutate(scheduleData);
      }
      
      // Clear the form and close the dialog
      resetForm();
      if (onSuccess) {
        onSuccess(newContact);
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create contact",
        description: error.message || "There was an error creating your contact",
        variant: "destructive"
      });
    }
  });
  
  // Send confirmation mutation
  const sendConfirmationMutation = useMutation({
    mutationFn: async (data: { 
      contactId: number;
      method: string;
      appointmentDate: string;
      appointmentTime: string;
    }) => {
      const response = await apiRequest(
        "POST", 
        `/api/contacts/${data.contactId}/send-confirmation`, 
        data
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Confirmation sent",
        description: data.message || "Appointment confirmation has been sent"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send confirmation",
        description: error.message || "There was an error sending the confirmation",
        variant: "destructive"
      });
    }
  });
  
  // Create schedule entry mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await apiRequest("POST", "/api/schedule", scheduleData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({
        title: "Added to schedule",
        description: "The appointment has been added to your schedule"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create schedule",
        description: error.message || "There was an error adding to schedule",
        variant: "destructive"
      });
    }
  });
  
  // Handle form field changes
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Handle status change specifically to toggle scheduling fields
  const handleStatusChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      status: value
    }));
    
    // Show scheduling fields for booked and check_back statuses
    if (value === "booked" || value === "check_back") {
      setShowSchedulingFields(true);
    } else {
      setShowSchedulingFields(false);
      setSendConfirmation(false);
      setAddToSchedule(false);
    }
  };
  
  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      fullName: "",
      address: initialAddress || "",
      city: "",
      state: "",
      zipCode: "",
      email: "",
      phone: "",
      status: "not_visited",
      notes: "",
      appointmentDate: "",
      appointmentTime: "",
    });
    setShowSchedulingFields(false);
    setSendConfirmation(false);
    setConfirmationMethod("email");
    setAddToSchedule(false);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation - basic required fields
    if (!formData.fullName || !formData.address) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    // Further validation for appointment fields if scheduling is enabled
    if (showSchedulingFields && 
        (formData.status === "booked" || formData.status === "check_back") && 
        (sendConfirmation || addToSchedule)) {
      if (!formData.appointmentDate || !formData.appointmentTime) {
        toast({
          title: "Missing appointment details",
          description: "Please set the appointment date and time",
          variant: "destructive"
        });
        return;
      }
      
      // Email validation if sending confirmation via email
      if (sendConfirmation && 
          (confirmationMethod === "email" || confirmationMethod === "both") && 
          !formData.email) {
        toast({
          title: "Email address required",
          description: "Please add an email address to send the confirmation",
          variant: "destructive"
        });
        return;
      }
      
      // Phone validation if sending confirmation via SMS
      if (sendConfirmation && 
          (confirmationMethod === "sms" || confirmationMethod === "both") && 
          !formData.phone) {
        toast({
          title: "Phone number required",
          description: "Please add a phone number to send the SMS confirmation",
          variant: "destructive"
        });
        return;
      }
    }
    
    // Format appointment data if scheduling is enabled
    let appointmentData = null;
    if (showSchedulingFields && 
        (formData.status === 'booked' || formData.status === 'check_back') && 
        formData.appointmentDate && 
        formData.appointmentTime) {
      appointmentData = `${formData.appointmentDate} ${formData.appointmentTime}`;
    }
    
    // Create contact with location data
    if (initialCoords) {
      // If we already have coordinates (from map click), use them directly
      createContactMutation.mutate({
        userId: user?.id || 0,
        fullName: formData.fullName,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        notes: formData.notes,
        latitude: initialCoords.lat.toString(),
        longitude: initialCoords.lng.toString(),
        appointment: appointmentData,
      });
    } else {
      // Otherwise, geocode the address to get coordinates
      try {
        const geocodeResult = await geocodeAddress(formData.address);
        
        if (geocodeResult) {
          // Create contact with coordinates
          createContactMutation.mutate({
            userId: user?.id || 0,
            fullName: formData.fullName,
            address: geocodeResult.address, // Use formatted address from geocoding
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            email: formData.email,
            phone: formData.phone,
            status: formData.status,
            notes: formData.notes,
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
            appointment: appointmentData,
          });
        } else {
          // Create contact without coordinates
          toast({
            title: "Address not found",
            description: "Could not find coordinates for this address. Contact will be created without map location.",
            variant: "default",
          });
          createContactMutation.mutate({
            userId: user?.id || 0,
            fullName: formData.fullName,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            email: formData.email,
            phone: formData.phone,
            status: formData.status,
            notes: formData.notes,
            appointment: appointmentData,
          });
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        // Create contact without coordinates if geocoding fails
        createContactMutation.mutate({
          userId: user?.id || 0,
          fullName: formData.fullName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          notes: formData.notes,
          appointment: appointmentData,
        });
      }
    }
  };
  
  // Get status label
  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      not_interested: "Not Interested",
      booked: "Booked",
      presented: "Presented",
      no_answer: "No Answer",
      check_back: "Check Back",
      no_soliciting: "No Soliciting",
      sold: "Sold",
      not_visited: "Not Visited",
    };
    
    return statusLabels[status] || status.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>
            Enter the details for this new contact.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName" 
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Only display the 7 statuses used for map pins */}
                  <SelectItem value="not_interested">{getStatusLabel("not_interested")}</SelectItem>
                  <SelectItem value="booked">{getStatusLabel("booked")}</SelectItem>
                  <SelectItem value="presented">{getStatusLabel("presented")}</SelectItem>
                  <SelectItem value="no_answer">{getStatusLabel("no_answer")}</SelectItem>
                  <SelectItem value="check_back">{getStatusLabel("check_back")}</SelectItem>
                  <SelectItem value="no_soliciting">{getStatusLabel("no_soliciting")}</SelectItem>
                  <SelectItem value="sold">{getStatusLabel("sold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input 
              id="address" 
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              required
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input 
                id="city" 
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input 
                id="state" 
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input 
                id="zipCode" 
                value={formData.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea 
              id="notes" 
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </div>
          
          {/* Scheduling section only for booked and check_back statuses */}
          {(formData.status === 'booked' || formData.status === 'check_back') && (
            <div className="space-y-2 border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-base font-semibold">Scheduling</Label>
                <div className="flex items-center">
                  <Checkbox 
                    id="enableScheduling"
                    checked={showSchedulingFields}
                    onCheckedChange={(checked) => setShowSchedulingFields(!!checked)}
                  />
                  <Label htmlFor="enableScheduling" className="ml-2">Set appointment</Label>
                </div>
              </div>
              
              {showSchedulingFields && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointmentDate">Date</Label>
                      <Input 
                        id="appointmentDate" 
                        type="date"
                        value={formData.appointmentDate}
                        onChange={(e) => handleChange("appointmentDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appointmentTime">Time</Label>
                      <Input 
                        id="appointmentTime" 
                        type="time"
                        value={formData.appointmentTime}
                        onChange={(e) => handleChange("appointmentTime", e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="send-confirmation" className="text-sm">Send confirmation to customer</Label>
                      <Switch
                        id="send-confirmation"
                        checked={sendConfirmation}
                        onCheckedChange={setSendConfirmation}
                      />
                    </div>
                    
                    {sendConfirmation && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmationMethod">Confirmation Method</Label>
                        <Select 
                          value={confirmationMethod} 
                          onValueChange={setConfirmationMethod}
                        >
                          <SelectTrigger id="confirmationMethod">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="both">Email & SMS</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {confirmationMethod === "email" && "Email confirmation will be sent using the default template"}
                          {confirmationMethod === "sms" && "SMS confirmation will be sent using the default template"}
                          {confirmationMethod === "both" && "Both email and SMS confirmations will be sent"}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="add-to-schedule" className="text-sm">Add to your schedule</Label>
                      <Switch
                        id="add-to-schedule"
                        checked={addToSchedule}
                        onCheckedChange={setAddToSchedule}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                onClose();
                resetForm();
              }}
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
      </DialogContent>
    </Dialog>
  );
}