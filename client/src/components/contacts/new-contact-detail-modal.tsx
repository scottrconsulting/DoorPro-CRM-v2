import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { geocodeAddress } from "@/lib/maps";
import { getStatusBadgeConfig } from "@/lib/status-helpers";
import { cn } from "@/lib/utils";
import { 
  Contact, 
  Visit, 
  InsertVisit
} from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  FileText,
  Calendar,
  DollarSign,
  CheckSquare,
  File,
  Phone,
  Mail,
  Edit,
  X
} from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import ContactEditDialog from "./contact-edit-dialog";

interface ContactDetailModalProps {
  contactId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function NewContactDetailModal({
  contactId,
  isOpen,
  onClose,
}: ContactDetailModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpReason, setFollowUpReason] = useState("follow_up");
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Active tab state - ensure it's initialized with a valid value
  const [activeTab, setActiveTab] = useState<string>("notes");

  // Fetch contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: isOpen,
  });

  // Fetch visit history
  const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({
    queryKey: [`/api/contacts/${contactId}/visits`],
    enabled: isOpen,
  });

  // Add visit mutation
  const addVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", `/api/contacts/${contactId}/visits`, visitData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/visits`] });
      setNote("");
      toast({
        title: "Note added",
        description: "Your note was successfully added",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add note",
        description: "There was an error adding your note",
        variant: "destructive",
      });
    },
  });

  // Handle edit dialog
  const handleOpenEditDialog = () => {
    setShowEditDialog(true);
  };
  
  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
  };

  // Handle note form submission
  const handleNoteSubmit = async () => {
    if (!note.trim()) return;

    const visitData: InsertVisit = {
      contactId,
      userId: 1, // TODO: Get from auth context
      visitType: "note",
      notes: note,
      visitDate: new Date(),
    };

    addVisitMutation.mutate(visitData);
  };

  // Handle follow-up scheduling
  const handleScheduleFollowUp = async () => {
    const [year, month, day] = followUpDate.split('-').map(Number);
    const [hour, minute] = followUpTime.split(':').map(Number);

    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    // Add a visit record
    const visitData: InsertVisit = {
      contactId,
      userId: 1, // TODO: Get from auth context
      visitType: "follow_up_scheduled",
      notes: `Follow-up scheduled for ${format(startDate, "MMM d, yyyy 'at' h:mm a")}`,
      visitDate: new Date(),
    };

    addVisitMutation.mutate(visitData);
    
    toast({
      title: "Follow-up scheduled",
      description: `Follow-up scheduled for ${format(startDate, "MMM d, yyyy 'at' h:mm a")}`,
    });
  };

  // Handle contact edit success
  const handleEditSuccess = (updatedContact: Contact) => {
    setShowEditDialog(false);
    // Invalidate queries to ensure updated data is shown
    queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
  };

  // Format address for display
  const getFormattedAddress = (contact: Contact): string => {
    const parts = [];
    if (contact.address) parts.push(contact.address);
    if (contact.city) parts.push(contact.city);
    if (contact.state) {
      if (contact.zipCode) {
        parts.push(`${contact.state} ${contact.zipCode}`);
      } else {
        parts.push(contact.state);
      }
    } else if (contact.zipCode) {
      parts.push(contact.zipCode);
    }
    return parts.join(', ');
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'booked': return 'bg-blue-100 text-blue-800';
      case 'not_home': return 'bg-yellow-100 text-yellow-800';
      case 'no_answer': return 'bg-pink-100 text-pink-800';
      case 'not_interested': return 'bg-red-100 text-red-800';
      case 'check_back': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Get status display name
  const getStatusName = (status: string) => {
    switch (status) {
      case 'booked': return 'Booked';
      case 'not_home': return 'Not Home';
      case 'no_answer': return 'No Answer';
      case 'not_interested': return 'Not Interested';
      case 'check_back': return 'Check Back';
      case 'completed': return 'Completed';
      case 'not_visited': return 'Not Visited';
      default: return status.replace('_', ' ');
    }
  };

  // Placeholder for delete function - needs proper implementation
  const handleContactDelete = (contact: Contact) => {
    //Implementation to delete contact goes here.
    console.log("Deleting contact:", contact);
    alert("Contact deleted - placeholder function"); // Replace with actual delete logic
  };

  if (!isOpen) return null;

  // Loading state
  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col">
          <div className="flex justify-center items-center flex-grow">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-xl font-semibold mb-2">Contact Not Found</div>
            <p className="text-neutral-600">The contact you're looking for could not be found.</p>
            <Button className="mt-4" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with close button */}
        <div className="flex justify-between items-center p-4 border-b">
          <DialogTitle className="text-xl sm:text-2xl font-bold break-words">
            {contact.fullName}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Status badge */}
        <div className="px-4 py-2">
          <Badge 
            className={cn(
              "h-6 px-3",
              getStatusBadge(contact.status)
            )}
          >
            {getStatusName(contact.status)}
          </Badge>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left side - contact info */}
          <div className="lg:w-1/3 border-r lg:min-h-[500px] p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg">Address</h2>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleOpenEditDialog}
                className="h-8 w-8 rounded-full"
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Edit contact</span>
              </Button>
            </div>
            
            <div className="mb-6">
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(getFormattedAddress(contact))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline block"
              >
                {contact.address}
                <div>
                  {contact.city}, {contact.state} {contact.zipCode}
                </div>
              </a>
            </div>

            {contact.phone && (
              <div className="mb-4">
                <h2 className="font-semibold mb-1">Phone</h2>
                <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                  {contact.phone}
                </a>
              </div>
            )}

            {contact.email && (
              <div className="mb-4">
                <h2 className="font-semibold mb-1">Email</h2>
                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                  {contact.email}
                </a>
              </div>
            )}

            {contact.notes && (
              <div className="mb-4">
                <h2 className="font-semibold mb-1">Notes</h2>
                <p className="text-gray-700">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Right side - tabs */}
          <div className="lg:w-2/3 p-4">
            <Tabs defaultValue="notes" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="notes" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Notes & History
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="sales" className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Sales
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex items-center gap-1">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-1">
                  <File className="h-4 w-4" />
                  Documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Contact History</h3>
                    <p className="text-gray-500 text-sm mb-4">Recent interactions and notes for this contact</p>
                  </div>

                  {/* Add Note form */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Add a Note</h4>
                    <Textarea 
                      placeholder="Enter your note..." 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="min-h-20"
                    />
                    <Button 
                      className="w-full sm:w-auto mt-2" 
                      onClick={handleNoteSubmit}
                      disabled={!note.trim() || addVisitMutation.isPending}
                    >
                      {addVisitMutation.isPending ? "Adding..." : "Add Note"}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Schedule a Follow-up</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="followUpDate">Date</Label>
                        <Input 
                          id="followUpDate"
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="followUpTime">Time</Label>
                        <Input 
                          id="followUpTime"
                          type="time"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="followUpReason">Reason</Label>
                      <Select value={followUpReason} onValueChange={setFollowUpReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="follow_up">General Follow-up</SelectItem>
                          <SelectItem value="appointment">Appointment</SelectItem>
                          <SelectItem value="presentation">Presentation</SelectItem>
                          <SelectItem value="demo">Product Demo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleScheduleFollowUp}
                      className="w-full sm:w-auto"
                    >
                      Schedule Follow-up
                    </Button>
                  </div>

                  {/* Visit history timeline */}
                  {visits.length > 0 && (
                    <div className="space-y-4 mt-8">
                      <h3 className="text-lg font-medium">History Timeline</h3>
                      <div className="space-y-4">
                        {visits
                          .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                          .map((visit) => (
                            <div key={visit.id} className="border-l-2 border-gray-300 pl-4 pb-4 relative">
                              <div className="w-3 h-3 rounded-full bg-gray-400 absolute -left-[7px] top-0"></div>
                              <div className="text-sm text-gray-500 mb-1">
                                {format(new Date(visit.visitDate), "MMM d, yyyy")} at {format(new Date(visit.visitDate), "h:mm a")}
                              </div>
                              <div className="font-medium mb-1">
                                {visit.visitType === "note" && "Note Added"}
                                {visit.visitType === "visit" && "In-Person Visit"}
                                {visit.visitType === "call" && "Phone Call"}
                                {visit.visitType === "email" && "Email Sent"}
                                {visit.visitType === "follow_up_scheduled" && "Follow-up Scheduled"}
                                {visit.visitType === "sale" && "Sale Completed"}
                              </div>
                              {visit.notes && <div className="text-gray-700">{visit.notes}</div>}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {isLoadingVisits && (
                    <div className="flex justify-center my-6">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  )}

                  {!isLoadingVisits && visits.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No history recorded yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="schedule">
                <div className="p-8 text-center text-gray-500">
                  <h3 className="font-medium mb-2">Schedule Features Coming Soon</h3>
                  <p>This section will allow you to manage appointments and schedule follow-ups.</p>
                </div>
              </TabsContent>

              <TabsContent value="sales">
                <div className="p-8 text-center text-gray-500">
                  <h3 className="font-medium mb-2">Sales Features Coming Soon</h3>
                  <p>This section will allow you to track sales and transactions.</p>
                </div>
              </TabsContent>

              <TabsContent value="tasks">
                <div className="p-8 text-center text-gray-500">
                  <h3 className="font-medium mb-2">Tasks Features Coming Soon</h3>
                  <p>This section will allow you to manage tasks related to this contact.</p>
                </div>
              </TabsContent>

              <TabsContent value="documents">
                <div className="p-8 text-center text-gray-500">
                  <h3 className="font-medium mb-2">Documents Features Coming Soon</h3>
                  <p>This section will allow you to manage documents related to this contact.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Dialog footer with delete button */}
        <div className="flex justify-between items-center p-4 border-t">
          <Button 
            variant="destructive"
            onClick={() => {
              if (contact) {
                handleContactDelete(contact);
                onClose();
              }
            }}
          >
            Delete Contact
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
        
        {/* Edit Dialog */}
        {contact && (
          <ContactEditDialog
            contact={contact}
            isOpen={showEditDialog}
            onClose={handleCloseEditDialog}
            isAdding={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}