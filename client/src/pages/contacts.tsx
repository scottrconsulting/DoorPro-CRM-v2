import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Contact, InsertContact, CONTACT_STATUSES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { FREE_PLAN_LIMITS, UserRole } from "@/lib/auth";
import ContactDetailModal from "@/components/contacts/contact-detail-modal";
import UniversalContactForm from "@/components/contacts/universal-contact-form";

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
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [navigationAddress, setNavigationAddress] = useState<string | null>(null);
  const [isNavigationDialogOpen, setIsNavigationDialogOpen] = useState(false);

  // Handle address click for navigation
  const handleAddressClick = (e: React.MouseEvent, address: string) => {
    e.stopPropagation();
    setNavigationAddress(address);
    setIsNavigationDialogOpen(true);
  };

  // Handle navigation to address using maps
  const handleNavigateToAddress = () => {
    if (navigationAddress) {
      // Create a Google Maps URL with the address
      const encodedAddress = encodeURIComponent(navigationAddress);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      window.open(mapsUrl, '_blank');
      setIsNavigationDialogOpen(false);
    }
  };

  // Get contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user, // Only fetch if user is authenticated
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (ids: number | number[]) => {
      if (Array.isArray(ids)) {
        // Mass deletion
        const promises = ids.map(id => 
          apiRequest("DELETE", `/api/contacts/${id}`, {})
        );
        await Promise.all(promises);
      } else {
        // Single deletion
        await apiRequest("DELETE", `/api/contacts/${ids}`, {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setSelectedContacts([]);
      toast({
        title: "Contact(s) deleted",
        description: "Selected contacts were successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete contact(s)",
        description: "There was an error deleting the contacts",
        variant: "destructive",
      });
    },
  });

  // Handle mass deletion
  const handleMassDelete = () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No contacts selected",
        description: "Please select contacts to delete",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedContacts.length} contacts?`)) {
      deleteContactMutation.mutate(selectedContacts);
    }
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Name,Address,City,State,Zip Code,Phone,Email,Status\n" +
      filteredContacts.map(contact => {
        return `"${contact.fullName}","${contact.address}","${contact.city || ''}","${contact.state || ''}","${contact.zipCode || ''}","${contact.phone || ''}","${contact.email || ''}","${contact.status}"`;
      }).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      const matchesStatus = !filterStatus || filterStatus === "all" || contact.status === filterStatus;
      
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
    // Use colored badges that match the map pin colors
    const statusLabels: Record<string, string> = {
      interested: "Interested",
      not_interested: "Not interested",
      converted: "Converted",
      considering: "Considering",
      not_visited: "Not visited",
      no_answer: "No Answer",
      presented: "Presented",
      booked: "Booked",
      sold: "Sold",
      no_soliciting: "No Soliciting",
      check_back: "Check Back",
    };

    // Color mapping that matches the map pins
    const colorMap: Record<string, { bg: string; text: string }> = {
      no_answer: { bg: 'bg-pink-100', text: 'text-pink-800' },        // Changed from not_visited to no_answer with pink
      not_visited: { bg: 'bg-pink-100', text: 'text-pink-800' },      // For backward compatibility
      interested: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      not_interested: { bg: 'bg-red-100', text: 'text-red-800' },
      call_back: { bg: 'bg-yellow-100', text: 'text-yellow-800' },    // Changed to yellow to match check_back
      check_back: { bg: 'bg-yellow-100', text: 'text-yellow-800' },   // Changed to yellow for consistency
      appointment_scheduled: { bg: 'bg-blue-100', text: 'text-blue-800' }, // Changed to blue to match booked
      converted: { bg: 'bg-green-100', text: 'text-green-800' },
      no_soliciting: { bg: 'bg-purple-100', text: 'text-purple-800' },
      considering: { bg: 'bg-purple-100', text: 'text-purple-800' },
      booked: { bg: 'bg-blue-100', text: 'text-blue-800' },           // Changed to blue for appointments
      presented: { bg: 'bg-orange-100', text: 'text-orange-800' },   // Changed to orange to match map pins
      sold: { bg: 'bg-green-100', text: 'text-green-800' },
    };

    // Convert snake_case status to label if not in the mapping
    const label = statusLabels[status] || status.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const { bg, text } = colorMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Check if at contact limit
  const isAtContactLimit = user?.role === UserRole.FREE && contacts.length >= FREE_PLAN_LIMITS.contacts;

  // Get status filter options
  const statusOptions = CONTACT_STATUSES.map(status => ({
    value: status,
    label: status.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }));

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <span className="material-icons absolute left-3 top-2 text-neutral-400">search</span>
          </div>
          
          <div className="w-full md:w-64">
            <Select
              value={filterStatus || ""}
              onValueChange={(value) => setFilterStatus(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportCSV} 
              className="flex items-center"
              disabled={filteredContacts.length === 0}
            >
              <span className="material-icons text-sm mr-1">download</span>
              Export CSV
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleMassDelete} 
              className="flex items-center"
              disabled={selectedContacts.length === 0}
            >
              <span className="material-icons text-sm mr-1">delete</span>
              Delete ({selectedContacts.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Contact List */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        {filteredContacts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-neutral-500">No contacts found matching your criteria.</p>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery("");
                setFilterStatus(null);
              }}
              className="mt-4"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="p-3 text-left">
                    <Checkbox
                      checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedContacts(filteredContacts.map(c => c.id));
                        } else {
                          setSelectedContacts([]);
                        }
                      }}
                    />
                  </th>
                  <th 
                    className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("fullName")}
                  >
                    <div className="flex items-center">
                      Name
                      {sortField === "fullName" && (
                        <span className="material-icons text-sm ml-1">
                          {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("address")}
                  >
                    <div className="flex items-center">
                      Address
                      {sortField === "address" && (
                        <span className="material-icons text-sm ml-1">
                          {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th 
                    className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Status
                      {sortField === "status" && (
                        <span className="material-icons text-sm ml-1">
                          {sortDirection === "asc" ? "arrow_upward" : "arrow_downward"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="p-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-neutral-50">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedContacts([...selectedContacts, contact.id]);
                          } else {
                            setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                          }
                        }}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div 
                        className="font-medium text-neutral-900 hover:text-primary cursor-pointer"
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        {contact.fullName}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div 
                        className="text-neutral-600 hover:text-primary cursor-pointer hover:underline"
                        onClick={(e) => handleAddressClick(e, contact.address)}
                      >
                        {contact.address}
                      </div>
                      {contact.city && contact.state && (
                        <div className="text-neutral-500 text-xs">
                          {contact.city}, {contact.state} {contact.zipCode}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-neutral-600">
                      {contact.phone || "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-neutral-600">
                      {contact.email || "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getStatusBadge(contact.status)}
                      {contact.appointment && (
                        <div className="text-xs text-neutral-500 mt-1">
                          <span className="material-icons text-xs mr-1 align-text-top">event</span>
                          {contact.appointment}
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${contact.fullName}?`)) {
                              deleteContactMutation.mutate(contact.id);
                            }
                          }}
                          title="Delete Contact"
                        >
                          <span className="material-icons text-sm">delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Contact Modal */}
      <UniversalContactForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newContact) => {
          toast({
            title: "Contact created",
            description: "Your contact was successfully created"
          });
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        }}
      />

      {/* Contact Detail Modal */}
      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          isOpen={true}
          onClose={() => setSelectedContactId(null)}
        />
      )}

      {/* Navigation Dialog */}
      <AlertDialog open={isNavigationDialogOpen} onOpenChange={setIsNavigationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Navigate to Address</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to navigate to this address?
              <div className="mt-2 p-2 bg-neutral-100 rounded-md">
                {navigationAddress}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNavigateToAddress}>
              <span className="flex items-center">
                <span className="material-icons text-sm mr-1">map</span>
                Navigate
              </span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}