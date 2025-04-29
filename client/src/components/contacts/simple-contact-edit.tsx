import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface SimpleContactEditProps {
  contact: Contact;
  onCancel: () => void;
  onSuccess: (updatedContact: Contact) => void;
}

export default function SimpleContactEdit({
  contact,
  onCancel,
  onSuccess
}: SimpleContactEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [name, setName] = useState(contact.fullName || "");
  const [address, setAddress] = useState(contact.address || "");
  const [city, setCity] = useState(contact.city || "");
  const [state, setState] = useState(contact.state || "");
  const [zipCode, setZipCode] = useState(contact.zipCode || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [email, setEmail] = useState(contact.email || "");
  
  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: async (updatedData: Partial<Contact>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contact.id}`, updatedData);
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      toast({
        title: "Contact updated",
        description: "Contact information has been updated successfully"
      });
      
      onSuccess(data);
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: "There was an error updating the contact information",
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
    
    const updatedData: Partial<Contact> = {
      fullName: name,
      address,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      phone: phone || null,
      email: email || null,
      // Keep the existing status
      status: contact.status
    };
    
    // Check if address has changed and needs geocoding
    if (updatedData.address !== contact.address || 
        updatedData.city !== contact.city || 
        updatedData.state !== contact.state || 
        updatedData.zipCode !== contact.zipCode) {
      try {
        // Build a complete address string for geocoding
        const fullAddress = [
          updatedData.address,
          updatedData.city,
          updatedData.state,
          updatedData.zipCode
        ].filter(Boolean).join(", ");
        
        const geocodeResult = await geocodeAddress(fullAddress);
        
        if (geocodeResult) {
          updatedData.latitude = geocodeResult.latitude;
          updatedData.longitude = geocodeResult.longitude;
        }
      } catch (error) {
        console.error("Failed to geocode address", error);
      }
    }
    
    updateContactMutation.mutate(updatedData);
  };
  
  return (
    <div className="space-y-4 p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
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
        
        <div className="flex justify-between pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={updateContactMutation.isPending || !name || !address}
          >
            {updateContactMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}