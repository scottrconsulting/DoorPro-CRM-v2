import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Contact, Visit, InsertVisit } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, addDays } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ContactDetailModalProps {
  contactId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactDetailModal({
  contactId,
  isOpen,
  onClose,
}: ContactDetailModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpReason, setFollowUpReason] = useState("follow_up");

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
      return res.json();
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

  // Schedule follow-up mutation
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const res = await apiRequest("POST", "/api/schedules", scheduleData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Follow-up scheduled",
        description: "Your follow-up was successfully scheduled",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to schedule follow-up",
        description: "There was an error scheduling your follow-up",
        variant: "destructive",
      });
    },
  });

  // Format date
  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  };

  // Format time from now
  const timeFromNow = (date: string | Date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  // Handle save note
  const handleSaveNote = () => {
    if (!note.trim()) {
      toast({
        title: "Note cannot be empty",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    addVisitMutation.mutate({
      contactId,
      userId: contact?.userId || 0,
      visitType: "note",
      notes: note,
      visitDate: new Date(),
    });
  };

  // Handle schedule follow-up
  const handleScheduleFollowUp = () => {
    const startTime = new Date(`${followUpDate}T${followUpTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    scheduleFollowUpMutation.mutate({
      userId: contact?.userId || 0,
      title: `Follow-up with ${contact?.fullName}`,
      description: `${followUpReason} at ${contact?.address}`,
      startTime,
      endTime,
      type: "follow_up",
      contactIds: [contactId],
    });
  };

  // Generate status badge
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
    };

    const { bg, text, label } = config[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Get visit type badge
  const getVisitTypeBadge = (type: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      initial: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        label: "Initial Visit",
      },
      follow_up: {
        bg: "bg-green-100",
        text: "text-green-800",
        label: "Follow-up",
      },
      note: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Note",
      },
    };

    const { bg, text, label } = config[type] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: type,
    };

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Loading state
  if (isLoadingContact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Loading contact details...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contact) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact not found</DialogTitle>
          </DialogHeader>
          <p>The requested contact could not be found.</p>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 p-4">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-1/3 mb-4 md:mb-0">
              <div className="bg-neutral-100 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="h-16 w-16 bg-primary text-white rounded-full flex items-center justify-center">
                    <span className="material-icons text-2xl">person</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="font-bold text-neutral-800">{contact.fullName}</h3>
                    <p className="text-sm text-neutral-600">
                      Added {timeFromNow(contact.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-neutral-500 mb-1">Contact Info</div>
                  <div className="text-sm mb-2">
                    <span className="material-icons text-xs align-text-bottom mr-1">home</span>
                    {contact.address}
                  </div>
                  {contact.phone && (
                    <div className="text-sm mb-2">
                      <span className="material-icons text-xs align-text-bottom mr-1">phone</span>
                      {contact.phone}
                    </div>
                  )}
                  {contact.email && (
                    <div className="text-sm">
                      <span className="material-icons text-xs align-text-bottom mr-1">email</span>
                      {contact.email}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-neutral-500 mb-1">Status</div>
                  {getStatusBadge(contact.status)}
                </div>
              </div>
            </div>

            <div className="md:w-2/3 md:pl-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-neutral-800">Visit History</h3>
                </div>
                {isLoadingVisits ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : visits.length === 0 ? (
                  <div className="border border-neutral-200 rounded-lg p-4 text-center">
                    <p className="text-neutral-500">No visit history yet</p>
                  </div>
                ) : (
                  <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200">
                    {visits
                      .sort((a, b) => 
                        new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
                      )
                      .map((visit) => (
                        <div key={visit.id} className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-medium">
                                {visit.visitType === "initial" ? "First Contact" : 
                                 visit.visitType === "follow_up" ? "Follow-up Visit" : 
                                 "Note"}
                              </div>
                              <div className="text-xs text-neutral-500">
                                {formatDate(visit.visitDate)}
                              </div>
                            </div>
                            {getVisitTypeBadge(visit.visitType)}
                          </div>
                          <p className="text-sm text-neutral-600 mt-1">{visit.notes}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-neutral-800">Notes</h3>
                </div>
                <div className="border border-neutral-200 rounded-lg p-3">
                  <Textarea
                    className="w-full"
                    rows={4}
                    placeholder="Add notes about this customer..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button className="p-1 hover:bg-neutral-100 rounded" title="Template">
                        <span className="material-icons text-neutral-500 text-sm">
                          format_list_bulleted
                        </span>
                      </button>
                    </div>
                    <Button
                      onClick={handleSaveNote}
                      disabled={addVisitMutation.isPending}
                      className="px-3 py-1"
                      size="sm"
                    >
                      {addVisitMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Schedule Follow-up */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-neutral-800">Schedule Follow-up</h3>
                </div>
                <div className="border border-neutral-200 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Date
                      </label>
                      <Input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Time
                      </label>
                      <Input
                        type="time"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Reason
                    </label>
                    <Select value={followUpReason} onValueChange={setFollowUpReason}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="product_presentation">Product presentation</SelectItem>
                        <SelectItem value="follow_up">Follow-up call</SelectItem>
                        <SelectItem value="contract_signing">Contract signing</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-3 text-right">
                    <Button
                      onClick={handleScheduleFollowUp}
                      disabled={scheduleFollowUpMutation.isPending}
                      className="px-3 py-1"
                      size="sm"
                    >
                      {scheduleFollowUpMutation.isPending ? "Scheduling..." : "Schedule"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 px-4 py-3 flex justify-between">
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" className="flex items-center">
              <span className="material-icons text-sm mr-1">edit</span>
              Edit Contact
            </Button>
            <Button variant="outline" size="sm" className="flex items-center">
              <span className="material-icons text-sm mr-1">delete</span>
              Delete
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
