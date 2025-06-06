import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { Contact } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// US States for dropdown
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

interface EditContactViewProps {
  contactId?: number;
  initialContact?: Contact;
  open: boolean;
  onCancel: () => void;
  onSuccess?: (contact: Contact) => void;
  onClose?: () => void;
  isEditMode?: boolean;
}

export default function EditContactView({
  contactId,
  initialContact,
  open,
  onCancel,
  onSuccess,
  onClose,
  isEditMode = false
}: EditContactViewProps) {
  const { toast } = useToast();

  // Form state
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [homePhone, setHomePhone] = useState("");
  const [workPhone, setWorkPhone] = useState("");

  // Fetch contact data only if contactId is provided and no initialContact
  const { data: fetchedContact, isLoading, error } = useQuery({
    queryKey: [`/api/contacts/${contactId}`],
    queryFn: () => apiRequest(`/api/contacts/${contactId}`),
    enabled: !!contactId && !initialContact,
  });

  // Use initialContact if provided, otherwise use fetched contact
  const contact = initialContact || fetchedContact;

  // Initialize form fields with contact data when it loads
  useEffect(() => {
    if (contact) {
      setFullName(contact.fullName || "");

      // Split full name into parts (best effort)
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

      setAddress(contact.address || "");
      setCity(contact.city || "");
      setState(contact.state || "");
      setZipCode(contact.zipCode || "");
      setPhone(contact.phone || "");
      setEmail(contact.email || "");
      setNotes(contact.notes || "");
      setStatus(contact.status || "");
      setCompany(contact.company || "");
      setSource(contact.source || "");

      // Additional fields (these might be null if not in your schema)
      setGender("");
      setDateOfBirth("");
      setHomePhone("");
      setWorkPhone("");
    }
  }, [contact]);

  // Save contact mutation
  const editContactMutation = useMutation({
    mutationFn: async (contactData: Partial<Contact>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contact?.id}`, contactData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contact?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });

      toast({
        title: "Contact updated",
        description: "Contact information has been successfully updated",
      });

      if (onSuccess) {
        onSuccess(data);
      }

      // Close the modal after successful update
      onCancel();
    },
    onError: (error) => {
      toast({
        title: "Failed to update contact",
        description: "There was an error updating the contact information",
        variant: "destructive",
      });
    },
  });

  // Reconstruct full name when first/middle/last name changes
  useEffect(() => {
    const parts = [];
    if (firstName) parts.push(firstName);
    if (middleName) parts.push(middleName);
    if (lastName) parts.push(lastName);

    if (parts.length > 0) {
      setFullName(parts.join(" "));
    }
  }, [firstName, middleName, lastName]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !address.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please provide at least a name and address",
        variant: "destructive",
      });
      return;
    }

    if (!contact) {
      toast({
        title: "Error",
        description: "Contact data is not available",
        variant: "destructive",
      });
      return;
    }

    const contactData: Partial<Contact> = {
      fullName,
      address,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      phone: phone || null,
      email: email || null,
      status,
      notes: notes || null,
      company: company || null,
      source: source || null,
    };

    // Geocode the address if it changed
    if (contactData.address && (
      contactData.address !== contact?.address ||
      contactData.city !== contact?.city ||
      contactData.state !== contact?.state ||
      contactData.zipCode !== contact?.zipCode
    )) {
      try {
        const fullAddress = `${contactData.address}, ${contactData.city || ""}, ${contactData.state || ""} ${contactData.zipCode || ""}`;
        const geocodeResult = await geocodeAddress(fullAddress);

        if (geocodeResult) {
          contactData.latitude = geocodeResult.latitude;
          contactData.longitude = geocodeResult.longitude;
        }
      } catch (error) {
        console.error("Failed to geocode address", error);
      }
    }

    editContactMutation.mutate(contactData);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2">Loading contact details...</span>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex justify-center items-center h-40 flex-col">
        <p className="text-red-500 mb-4">Failed to load contact details</p>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  // Render form content directly when used as modal in ContactCard
  const formContent = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Update Contact</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name fields */}
              <div className="space-y-4">
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

              {/* Gender and Date of Birth */}
              <div className="space-y-4">
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

              {/* Contact Information */}
              <div className="space-y-4">
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
                  <Label htmlFor="phone">Mobile Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
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

              {/* Address Information */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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

              {/* Additional Information */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company/Organization</Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company or organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source">Lead Source</Label>
                  <Input
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="How did you find this contact?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_contact">No Contact Yet</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="interested">Interested</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="no_soliciting">No Soliciting</SelectItem>
                      <SelectItem value="check_back">Check Back Later</SelectItem>
                      <SelectItem value="presented">Presented</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="no_answer">No Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this contact"
                    rows={4}
                  />
                </div>
              </div>

              {/* Buttons */}
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
                  disabled={editContactMutation.isPending || !fullName || !address}
                >
                  {editContactMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
    </div>
  );

  // If used in edit mode (from ContactCard), return form content directly
  if (isEditMode) {
    return formContent;
  }

  // Otherwise, wrap in Dialog for standalone usage
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Contact</DialogTitle>
        </DialogHeader>
        <Card className="border-none shadow-none">
          <CardContent className="px-0">
            {formContent}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}