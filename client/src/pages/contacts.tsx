import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Contact, InsertContact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FREE_PLAN_LIMITS, UserRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/maps";
import ContactDetailModal from "@/components/contacts/contact-detail-modal";

// Extended schema with validation
const contactFormSchema = insertContactSchema.extend({
  address: z.string().min(5, "Address must be at least 5 characters"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function Contacts() {
  console.log("Contacts component is rendering");
  const { toast } = useToast();
  const { user } = useAuth();
  console.log("User in Contacts:", user);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Get contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user, // Only fetch if user is authenticated
  });

  // Create contact form
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      phone: "",
      email: "",
      status: "not_visited",
      userId: user?.id || 0,
    },
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contact: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contact);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsCreateModalOpen(false);
      form.reset();
      toast({
        title: "Contact created",
        description: "Your contact was successfully created",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create contact",
        description: error.message || "There was an error creating your contact",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/contacts/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact was successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete contact",
        description: "There was an error deleting the contact",
        variant: "destructive",
      });
    },
  });

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle sort direction if clicking on the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new sort field and default to ascending sort
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and sort contacts
  const filteredContacts = contacts
    .filter(contact => {
      // Apply search filter
      const matchesSearch = 
        contact.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (contact.phone && contact.phone.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Apply status filter
      const matchesStatus = !filterStatus || contact.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Apply sorting based on current sort field and direction
      let comparison = 0;
      
      switch (sortField) {
        case "fullName":
          comparison = a.fullName.localeCompare(b.fullName);
          break;
        case "address":
          comparison = a.address.localeCompare(b.address);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "updatedAt":
        default:
          comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          // Reverse for updatedAt to show newest first by default
          return sortDirection === "asc" ? -comparison : comparison;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

  // Get contact status badge
  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      interested: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Interested",
      },
      not_interested: {
        bg: "bg-red-100",
        text: "text-red-800",
        label: "Not interested",
      },
      converted: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Converted",
      },
      considering: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Considering",
      },
      not_visited: {
        bg: "bg-neutral-100",
        text: "text-neutral-800",
        label: "Not visited",
      },
    };

    const { bg, text, label } = config[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Handle form submit
  const onSubmit = async (data: ContactFormValues) => {
    // Check if at free plan limit
    if (user?.role === UserRole.FREE && contacts.length >= FREE_PLAN_LIMITS.contacts) {
      toast({
        title: "Contact limit reached",
        description: `Free plan is limited to ${FREE_PLAN_LIMITS.contacts} contacts. Please upgrade to Pro for unlimited contacts.`,
        variant: "destructive",
      });
      return;
    }

    // Geocode the address to get coordinates
    try {
      const geocodeResult = await geocodeAddress(data.address);
      
      if (geocodeResult) {
        // Create contact with coordinates
        createContactMutation.mutate({
          ...data,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
          address: geocodeResult.address, // Use formatted address from geocoding
        });
      } else {
        // Create contact without coordinates
        toast({
          title: "Address not found",
          description: "Could not find coordinates for this address. Contact will be created without map location.",
          variant: "default",
        });
        createContactMutation.mutate(data);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      createContactMutation.mutate(data);
    }
  };

  // Check if at contact limit
  const isAtContactLimit = user?.role === UserRole.FREE && contacts.length >= FREE_PLAN_LIMITS.contacts;

  // Get status filter options
  const statusOptions = [
    { value: "interested", label: "Interested" },
    { value: "not_interested", label: "Not interested" },
    { value: "converted", label: "Converted" },
    { value: "considering", label: "Considering" },
    { value: "not_visited", label: "Not visited" },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-neutral-800">Contacts</h1>
          <p className="text-neutral-500">
            {isLoading 
              ? "Loading contacts..." 
              : `Showing ${filteredContacts.length} of ${contacts.length} contacts`}
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isAtContactLimit}
            className="flex items-center"
          >
            <span className="material-icons text-sm mr-1">add</span>
            Add Contact
          </Button>
          {isAtContactLimit && (
            <p className="text-xs text-red-500 mt-1">
              Free plan limited to {FREE_PLAN_LIMITS.contacts} contacts. Please upgrade to Pro.
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Search contacts..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="material-icons absolute left-3 top-2.5 text-neutral-400">search</span>
          </div>
          <div className="w-full md:w-48">
            <Select value={filterStatus || ""} onValueChange={(value) => setFilterStatus(value || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8 text-center">
          <span className="material-icons text-6xl text-neutral-300 mb-4">people</span>
          <h3 className="text-xl font-medium text-neutral-700 mb-2">No contacts found</h3>
          <p className="text-neutral-500 mb-6">
            {searchQuery || filterStatus 
              ? "Try changing your search or filter criteria"
              : "Add your first contact to get started"}
          </p>
          <Button
            onClick={() => {
              setSearchQuery("");
              setFilterStatus(null);
              if (contacts.length === 0) {
                setIsCreateModalOpen(true);
              }
            }}
          >
            {searchQuery || filterStatus 
              ? "Clear Filters"
              : "Add Your First Contact"}
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-4 py-2 text-left font-medium text-neutral-600">
                    <div 
                      className={`flex items-center gap-1 cursor-pointer hover:text-primary ${sortField === "fullName" ? "text-primary" : ""}`} 
                      onClick={() => handleSort("fullName")}
                    >
                      Name
                      {sortField === "fullName" ? (
                        sortDirection === "asc" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 9 5-5 5 5"/></svg>
                        )
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600">
                    <div 
                      className={`flex items-center gap-1 cursor-pointer hover:text-primary ${sortField === "address" ? "text-primary" : ""}`} 
                      onClick={() => handleSort("address")}
                    >
                      Address
                      {sortField === "address" ? (
                        sortDirection === "asc" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 9 5-5 5 5"/></svg>
                        )
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600">Contact Info</th>
                  <th className="px-4 py-2 text-left font-medium text-neutral-600">
                    <div 
                      className={`flex items-center gap-1 cursor-pointer hover:text-primary ${sortField === "status" ? "text-primary" : ""}`} 
                      onClick={() => handleSort("status")}
                    >
                      Status
                      {sortField === "status" ? (
                        sortDirection === "asc" ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 9 5-5 5 5"/></svg>
                        )
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    className="border-b border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                    onClick={() => setSelectedContactId(contact.id)}
                  >
                    <td className="px-4 py-2 font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{contact.fullName}</span>
                        <span className="text-xs text-neutral-500">Last updated: {new Date(contact.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      <div className="flex flex-col">
                        <span className="text-sm truncate max-w-[250px]">{contact.address}</span>
                        {(contact.latitude && contact.longitude) ? (
                          <span className="text-xs text-green-600">✓ Mapped</span>
                        ) : (
                          <span className="text-xs text-orange-500">Not on map</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">
                      {contact.phone || contact.email ? (
                        <div className="flex flex-col">
                          {contact.phone && <span className="text-sm">{contact.phone}</span>}
                          {contact.email && <span className="text-xs text-neutral-500 truncate max-w-[150px]">{contact.email}</span>}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">No contact info</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{getStatusBadge(contact.status)}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this contact?")) {
                              deleteContactMutation.mutate(contact.id);
                            }
                          }}
                        >
                          <span className="material-icons text-neutral-500 text-sm">delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Contact Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Enter the contact details below to add a new potential customer.
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
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St, City, State, Zip" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
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
                        <Input placeholder="john.doe@example.com" value={field.value || ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
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
                        <SelectItem value="not_visited">Not visited</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="not_interested">Not interested</SelectItem>
                        <SelectItem value="considering">Considering</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(false)}
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

      {/* Contact Detail Modal */}
      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          isOpen={true}
          onClose={() => setSelectedContactId(null)}
        />
      )}
    </div>
  );
}
