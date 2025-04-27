import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { useLongPress } from "@/hooks/use-long-press";
import { geocodeAddress, getMarkerIcon, getCurrentLocation, getUserAvatarIcon } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact, InsertVisit } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Define the Customization type
interface Customization {
  id: number;
  userId: number;
  teamId: number | null;
  pinColors: Record<string, string>;
  enabledWidgets: string[];
  widgetOrder: string[];
  defaultMapType: string;
  createdAt?: string;
  updatedAt?: string;
}

// Add Google Maps types
declare global {
  interface Window {
    google: {
      maps: {
        Map: any;
        Marker: any;
        Animation: any;
        InfoWindow: any;
        Geocoder: any;
        GeocoderStatus: {
          OK: string;
        };
        SymbolPath: {
          CIRCLE: number;
        };
        event: {
          removeListener: (listener: any) => void;
        };
      };
    };
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface MapViewerProps {
  onSelectContact?: (contactId: number) => void;
}

export default function EnhancedMapViewer({ onSelectContact }: MapViewerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  const [newHouseMarker, setNewHouseMarker] = useState<any | null>(null);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newContactCoords, setNewContactCoords] = useState<{lat: number; lng: number} | null>(null);
  const [userMarker, setUserMarker] = useState<any | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>("not_visited");
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseUpTime, setMouseUpTime] = useState<number | null>(null);
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [newContactForm, setNewContactForm] = useState({
    fullName: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    zipCode: "",
    status: activeStatus,
    notes: "",
    appointmentDate: "",
    appointmentTime: "",
  });
  
  // Work timer states and refs
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timerDisplay, setTimerDisplay] = useState(0);
  const workTimerRef = useRef<number>(0);
  const timerActiveRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());
  const firstHouseRecordedRef = useRef<boolean>(false);
  const sessionsRef = useRef<{startTime: string; duration: number}[]>([]);
  
  // For the time display in HH:MM:SS format
  const formattedTime = useMemo(() => {
    const hours = Math.floor(workTimerRef.current / 3600);
    const minutes = Math.floor((workTimerRef.current % 3600) / 60);
    const seconds = workTimerRef.current % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [timerDisplay]);
  
  // Fetch contacts
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });
  
  // Fetch user's customizations
  const { data: customization } = useQuery<Customization>({
    queryKey: ["/api/customizations/current"],
  });

  // Initialize map with default location (US center), but will immediately try to locate user
  const {
    mapRef,
    map,
    isLoaded,
    loading,
    setMapType: setGoogleMapType,
    panTo,
    addMarker,
    clearMarkers,
  } = useGoogleMaps({
    apiKey: GOOGLE_MAPS_API_KEY,
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5,
    mapTypeId: "roadmap"
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contactData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
        setNewHouseMarker(null);
      }
      setIsAddingHouse(false);
    },
    onError: (error) => {
      console.error("Failed to create contact", error);
      toast({
        title: "Failed to create contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Create visit mutation
  const createVisitMutation = useMutation({
    mutationFn: async (visitData: InsertVisit) => {
      const res = await apiRequest("POST", "/api/visits", visitData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visits"] });
    },
    onError: (error) => {
      console.error("Failed to create visit record", error);
    }
  });
  
  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("DELETE", `/api/contacts/${contactId}`);
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact deleted",
        description: "The contact has been successfully deleted",
      });
      // Remove from selected contacts if needed
      setSelectedContacts((prev) => prev.filter(id => id !== contactId));
    },
    onError: (error) => {
      console.error("Failed to delete contact", error);
      toast({
        title: "Failed to delete contact",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Function to handle contact deletion
  const handleContactDelete = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteDialog(true);
  }, []);
  
  // Update markers when contacts change
  useEffect(() => {
    if (!isLoaded || !map || isLoadingContacts) return;
    
    // Clear all existing markers before adding new ones
    clearMarkers();
    
    // Debug any contact status issues
    const statusCounts: Record<string, number> = {};
    
    // Process all contacts and create markers for each one with coordinates
    contacts.forEach((contact) => {
      // Skip contacts without coordinates
      if (!contact.latitude || !contact.longitude) return;
      
      // Count statuses for debugging
      statusCounts[contact.status] = (statusCounts[contact.status] || 0) + 1;
      
      // Parse coordinates
      const position = {
        lat: parseFloat(contact.latitude),
        lng: parseFloat(contact.longitude),
      };
      
      // Get the proper marker icon based on status and customization settings
      // This ensures consistent pin colors for all status types
      const markerIcon = getMarkerIcon(contact.status, customization?.pinColors);
      
      // Create the map marker with the correct icon
      const marker = addMarker(position, {
        title: contact.fullName,
        icon: markerIcon,
        // Adding animation for better visibility
        animation: window.google.maps.Animation.DROP
      });
      
      if (marker) {
        // Click handler for all contact types - opens contact details
        // This has been standardized for all contact status types including call_back
        marker.addListener("click", () => {
          // Only trigger if not in adding mode
          if (!isAddingHouse) {
            // Set the selected contact for all pin types
            setSelectedContact(contact);
            // Call the onSelectContact for all pin types - makes behavior consistent
            if (onSelectContact) {
              onSelectContact(contact.id);
              
              // Provide consistent user feedback
              toast({
                title: "Contact selected",
                description: `${contact.fullName || "Unknown"} - ${contact.status.replace(/_/g, ' ')}`,
              });
            }
          }
        });
      }
    });
    
    console.log("Status counts for debugging:", statusCounts);
    
  }, [contacts, isLoaded, map, clearMarkers, addMarker, isLoadingContacts, onSelectContact, toast, isAddingHouse, customization?.pinColors]);

  return (
    <div className="relative h-full">
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg overflow-hidden shadow-lg"
      />
      
      {/* Status selection controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded-lg shadow-lg flex items-center gap-2 flex-wrap justify-center z-10">
        <Button 
          variant={activeStatus === "not_visited" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("not_visited")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
          Not Visited
        </Button>
        
        <Button 
          variant={activeStatus === "interested" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("interested")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
          Interested
        </Button>
        
        <Button 
          variant={activeStatus === "not_interested" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("not_interested")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
          Not Interested
        </Button>
        
        <Button 
          variant={activeStatus === "call_back" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("call_back")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
          Call Back
        </Button>
        
        <Button 
          variant={activeStatus === "appointment_scheduled" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("appointment_scheduled")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
          Appointment
        </Button>
        
        <Button 
          variant={activeStatus === "converted" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("converted")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
          Converted
        </Button>
        
        <Button 
          variant={activeStatus === "no_soliciting" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveStatus("no_soliciting")}
          className="rounded-full"
        >
          <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
          No Soliciting
        </Button>
      </div>
    </div>
  );
}