import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface DirectContactEditProps {
  contact: Contact;
  onCancel: () => void;
  onSuccess: (updatedContact: Contact) => void;
}

export default function DirectContactEdit({
  contact,
  onCancel,
  onSuccess
}: DirectContactEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState(contact.email || "");
  const [mobilePhone, setMobilePhone] = useState(contact.phone || "");
  const [homePhone, setHomePhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [address, setAddress] = useState(contact.address || "");
  const [city, setCity] = useState(contact.city || "");
  const [state, setState] = useState(contact.state || "");
  const [zipCode, setZipCode] = useState(contact.zipCode || "");
  
  // Split full name into parts on component mount
  useEffect(() => {
    if (contact.fullName) {
      const nameParts = contact.fullName.split(" ");
      if (nameParts.length === 1) {
        setFirstName(nameParts[0]);
      } else if (nameParts.length === 2) {
        setFirstName(nameParts[0]);
        setLastName(nameParts[1]);
      } else if (nameParts.length >= 3) {
        setFirstName(nameParts[0]);
        setMiddleName(nameParts.slice(1, -1).join(" "));
        setLastName(nameParts[nameParts.length - 1]);
      }
    }
  }, [contact.fullName]);
  
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
    
    // Construct full name from parts
    const parts = [];
    if (firstName) parts.push(firstName);
    if (middleName) parts.push(middleName);
    if (lastName) parts.push(lastName);
    const fullName = parts.join(" ");
    
    if (!fullName || !address) {
      toast({
        title: "Missing required information",
        description: "Please provide at least a name and address",
        variant: "destructive"
      });
      return;
    }
    
    const updatedData: Partial<Contact> = {
      fullName,
      address,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      phone: mobilePhone || null,
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={onCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-medium">Update Client</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input 
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="middleName">Middle Name</Label>
            <Input 
              id="middleName"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Middle name (optional)"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input 
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input 
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input 
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mobilePhone">Mobile Phone</Label>
            <Input 
              id="mobilePhone"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              placeholder="(___) ___-____"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="homePhone">Home Phone</Label>
            <Input 
              id="homePhone"
              value={homePhone}
              onChange={(e) => setHomePhone(e.target.value)}
              placeholder="(___) ___-____"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="workPhone">Work Phone</Label>
            <Input 
              id="workPhone"
              value={workPhone}
              onChange={(e) => setWorkPhone(e.target.value)}
              placeholder="(___) ___-____"
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input 
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input 
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input 
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input 
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="Zip code"
            />
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="flex-1"
            disabled={updateContactMutation.isPending || !firstName || !address}
          >
            {updateContactMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}