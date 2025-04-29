import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { Contact } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ContactEditDialogProps {
  contact?: Contact;
  isOpen: boolean;
  onClose: () => void;
  isAdding?: boolean;
}

export default function ContactEditDialog({
  contact,
  isOpen,
  onClose,
  isAdding = false
}: ContactEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [name, setName] = useState(contact?.fullName || "");
  const [address, setAddress] = useState(contact?.address || "");
  const [city, setCity] = useState(contact?.city || "");
  const [state, setState] = useState(contact?.state || "");
  const [zipCode, setZipCode] = useState(contact?.zipCode || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [email, setEmail] = useState(contact?.email || "");
  
  // Create/Update contact mutation
  const contactMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      if (isAdding) {
        const res = await apiRequest("POST", "/api/contacts", contactData);
        return res.json();
      } else if (contact?.id) {
        const res = await apiRequest("PATCH", `/api/contacts/${contact.id}`, contactData);
        return res.json();
      }
      throw new Error("Invalid operation");
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (contact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact.id}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      toast({
        title: isAdding ? "Contact added" : "Contact updated",
        description: isAdding 
          ? "New contact has been added successfully" 
          : "Contact information has been updated successfully"
      });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: isAdding ? "Failed to add contact" : "Update failed",
        description: "There was an error with the contact information",
        variant: "destructive"
      });
    }
  });
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !address) {
      toast({
        title: "Missing required information",
        description: "Please provide at least a name and address",
        variant: "destructive"
      });
      return;
    }
    
    const contactData: Partial<Contact> = {
      userId: 1, // Assuming the current user's ID is 1
      fullName: name,
      address,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      phone: phone || null,
      email: email || null,
      // Keep the existing status or set to default for new contacts
      status: contact?.status || "not_visited"
    };
    
    try {
      // Build a complete address string for geocoding
      const fullAddress = [
        contactData.address,
        contactData.city,
        contactData.state,
        contactData.zipCode
      ].filter(Boolean).join(", ");
      
      const geocodeResult = await geocodeAddress(fullAddress);
      
      if (geocodeResult) {
        contactData.latitude = geocodeResult.latitude;
        contactData.longitude = geocodeResult.longitude;
      }
    } catch (error) {
      console.error("Failed to geocode address", error);
    }
    
    contactMutation.mutate(contactData);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogTitle className="p-5 pb-0 text-xl font-semibold">
          {isAdding ? "Add New Contact" : "Edit Contact"}
        </DialogTitle>
        <form onSubmit={handleSubmit} className="p-5 pt-2">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium mb-2">Name</h2>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full"
              />
            </div>
            
            <div>
              <h2 className="text-lg font-medium mb-2">Address</h2>
              <Input 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-lg font-medium mb-2">City</h2>
                <Input 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full"
                />
              </div>
              
              <div>
                <h2 className="text-lg font-medium mb-2">State</h2>
                <Input 
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="w-full"
                />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-medium mb-2">Zip Code</h2>
              <Input 
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Zip code"
                className="w-full"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h2 className="text-lg font-medium mb-2">Phone</h2>
                <Input 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full"
                />
              </div>
              
              <div>
                <h2 className="text-lg font-medium mb-2">Email</h2>
                <Input 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-4 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={contactMutation.isPending || !name || !address}
              >
                {contactMutation.isPending ? "Saving..." : (isAdding ? "Add" : "Save")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}