import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Contact, Visit, InsertVisit } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/use-maps";
import { formatDistanceToNow, format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getMarkerIcon } from "@/lib/maps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "your-api-key";

// Notes form schema
const notesFormSchema = z.object({
  notes: z.string().min(1, "Please enter some notes"),
});

type NotesFormValues = z.infer<typeof notesFormSchema>;

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const numericId = parseInt(id, 10);

  // Setup form
  const form = useForm<NotesFormValues>({
    resolver: zodResolver(notesFormSchema),
    defaultValues: {
      notes: "",
    },
  });
  
  // Get contact details
  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${numericId}`],
    enabled: !isNaN(numericId),
    onError: () => {
      toast({
        title: "Error",
        description: "Could not load contact details",
        variant: "destructive",
      });
      setLocation("/contacts");
    },
  });

  // Get visit history
  const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({
    queryKey: [`/api/contacts/${numericId}/visits`],
    enabled: !isNaN(numericId),
  });

  // Initialize map
  const {
    mapRef,
    map,
    isLoaded,
    addMarker,
  } = useGoogleMaps(GOOGLE_MAPS_API_KEY, {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 15,
  });

  // Add contact to map when loaded
  useEffect(() => {
    if (isLoaded && map && contact?.latitude && contact?.longitude) {
      const position = {
        lat: parseFloat(contact.latitude),
        lng: parseFloat(contact.longitude),
      };
      
      map.setCenter(position);
      addMarker(position, {
        title: contact.fullName,
        icon: getMarkerIcon(contact.status),
      });
    }
  }, [isLoaded, map, contact, addMarker]);

  // Add visit mutation
  const addVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", `/api/contacts/${numericId}/visits`, visitData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${numericId}/visits`] });
      form.reset();
      toast({
        title: "Success",
        description: "Your notes have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not save notes",
        variant: "destructive",
      });
    },
  });

  // Submit notes form
  const onSubmit = (data: NotesFormValues) => {
    if (!contact) return;
    
    addVisitMutation.mutate({
      contactId: numericId,
      userId: contact.userId,
      visitType: "note",
      notes: data.notes,
      visitDate: new Date(),
    });
  };

  // Format visit date
  const formatVisitDate = (date: string | Date) => {
    return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
  };

  // Get status badge
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

  if (isLoadingContact) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="material-icons text-6xl text-neutral-300 mb-4">error_outline</span>
            <h3 className="text-xl font-medium text-neutral-700 mb-2">Contact Not Found</h3>
            <p className="text-neutral-500 mb-6">The contact you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button onClick={() => setLocation("/contacts")}>
              Back to Contacts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mr-2"
            onClick={() => setLocation("/contacts")}
          >
            <span className="material-icons mr-1">arrow_back</span>
            Back
          </Button>
          <h1 className="text-2xl font-bold font-sans text-neutral-800">{contact.fullName}</h1>
          <div className="ml-4">{getStatusBadge(contact.status)}</div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">Edit Contact</Button>
          <Button>Schedule Follow-up</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-neutral-500 mb-1">Name</div>
                  <div className="text-neutral-800">{contact.fullName}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-neutral-500 mb-1">Address</div>
                  <div className="text-neutral-800">{contact.address}</div>
                </div>
                
                {contact.phone && (
                  <div>
                    <div className="text-sm font-medium text-neutral-500 mb-1">Phone</div>
                    <div className="text-neutral-800">{contact.phone}</div>
                  </div>
                )}
                
                {contact.email && (
                  <div>
                    <div className="text-sm font-medium text-neutral-500 mb-1">Email</div>
                    <div className="text-neutral-800">{contact.email}</div>
                  </div>
                )}
                
                <div>
                  <div className="text-sm font-medium text-neutral-500 mb-1">Status</div>
                  <div className="text-neutral-800">{getStatusBadge(contact.status)}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-neutral-500 mb-1">Added</div>
                  <div className="text-neutral-800">
                    {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={mapRef} 
                className="w-full h-64 bg-neutral-100 rounded-md overflow-hidden"
              />
            </CardContent>
          </Card>
        </div>

        {/* Notes & Visits */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="visits">
            <TabsList className="mb-4">
              <TabsTrigger value="visits">Visit History</TabsTrigger>
              <TabsTrigger value="notes">Add Notes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="visits">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Visit History</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingVisits ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="text-center py-6">
                      <span className="material-icons text-4xl text-neutral-300 mb-2">history</span>
                      <p className="text-neutral-500">No visit history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visits
                        .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                        .map((visit) => (
                          <div key={visit.id} className="border border-neutral-200 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-medium mb-1">
                                  {visit.visitType === "initial" ? "First Contact" : 
                                   visit.visitType === "follow_up" ? "Follow-up Visit" : 
                                   "Note"}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  {formatVisitDate(visit.visitDate)}
                                </div>
                              </div>
                              {getVisitTypeBadge(visit.visitType)}
                            </div>
                            <p className="text-sm text-neutral-600 mt-2">{visit.notes}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="notes">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Add Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Textarea 
                      placeholder="Add notes about this contact..."
                      className="min-h-[120px] mb-4"
                      {...form.register("notes")}
                    />
                    {form.formState.errors.notes && (
                      <p className="text-red-500 text-sm mb-4">{form.formState.errors.notes.message}</p>
                    )}
                    <div className="flex justify-end">
                      <Button 
                        type="submit"
                        disabled={addVisitMutation.isPending}
                      >
                        {addVisitMutation.isPending ? "Saving..." : "Save Notes"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
