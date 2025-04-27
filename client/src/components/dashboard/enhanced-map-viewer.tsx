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
  
  // Handle my location button click
  const handleMyLocationClick = async () => {
    const position = await getCurrentLocation();
    if (position && map) {
      panTo(position);
      map.setZoom(15);
    }
  };
  
  // Add click functionality to map for adding new contacts
  useEffect(() => {
    if (!isLoaded || !map || !window.google) return;
    
    // Track when the mouse is pressed down
    const mouseDownListener = map.addListener("mousedown", (e: any) => {
      if (!e.latLng) return;
      setMouseDownTime(Date.now());
    });
    
    // Handle click with hold detection
    const clickListener = map.addListener("click", async (e: any) => {
      if (!e.latLng) return;
      setMouseUpTime(Date.now());
      
      // Calculate click duration
      const clickDuration = mouseDownTime ? Date.now() - mouseDownTime : 0;
      const isLongClick = clickDuration > 500; // 500ms threshold for long press
      
      // Create a marker at the clicked location with the current active status
      const marker = addMarker(e.latLng.toJSON(), {
        title: "New Contact",
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        icon: getMarkerIcon(activeStatus, customization?.pinColors),
      });
      
      setNewHouseMarker(marker);
      setIsAddingHouse(true); // Auto-enable adding mode
      
      // Get the address from the coordinates
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: e.latLng.toJSON() }, (
        results: any, 
        status: any
      ) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const address = results[0].formatted_address;
          setNewContactAddress(address);
          setNewContactCoords(e.latLng.toJSON());
          
          // Extract address components for all contact creation paths
          const streetNumber = results[0].address_components.find((c: any) => 
            c.types.includes('street_number'))?.short_name || '';
          const street = results[0].address_components.find((c: any) => 
            c.types.includes('route'))?.short_name || '';
          const city = results[0].address_components.find((c: any) => 
            c.types.includes('locality'))?.short_name || '';
          const state = results[0].address_components.find((c: any) => 
            c.types.includes('administrative_area_level_1'))?.short_name || '';
          const zipCode = results[0].address_components.find((c: any) => 
            c.types.includes('postal_code'))?.short_name || '';
          
          const autoName = streetNumber && street ? `${streetNumber} ${street}` : 'New Contact';
          
          // For quick clicks - just add the contact with the selected status for ALL statuses
          // Start work timer when first contact is added (if not already started)
          if (!firstHouseRecordedRef.current) {
            firstHouseRecordedRef.current = true;
            timerActiveRef.current = true;
            
            // Add first session to the sessions list
            sessionsRef.current.push({
              startTime: new Date().toISOString(),
              duration: 0
            });
            
            toast({
              title: "Work timer started",
              description: "Timer has started tracking your work session"
            });
          }
          
          // Create the contact with the current active status and all address components
          createContactMutation.mutate({
            userId: user?.id || 0,
            fullName: autoName,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            status: activeStatus,
            latitude: e.latLng.lat().toString(),
            longitude: e.latLng.lng().toString(),
            notes: `Quick add: ${new Date().toLocaleString()}`
          });
          
          toast({
            title: "Contact added",
            description: `Added pin with status: ${activeStatus.replace(/_/g, ' ')}`,
          });
        } else {
          // Could not get the address
          toast({
            title: "Pin added",
            description: "Address could not be determined",
            variant: "destructive",
          });
        }
      });
    });
    
    return () => {
      // Clean up the listeners when the component unmounts
      window.google.maps.event.removeListener(mouseDownListener);
      window.google.maps.event.removeListener(clickListener);
    };
  }, [isLoaded, map, addMarker, mouseDownTime, activeStatus, toast, user?.id, createContactMutation]);

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
        
        // Right-click handler to show delete option
        marker.addListener("rightclick", () => {
          handleContactDelete(contact);
        });
      }
    });
    
    console.log("Status counts for debugging:", statusCounts);
    
  }, [contacts, isLoaded, map, clearMarkers, addMarker, isLoadingContacts, onSelectContact, toast, isAddingHouse, customization?.pinColors, handleContactDelete]);
  
  // Change map type when mapType state changes
  useEffect(() => {
    if (isLoaded && map) {
      setGoogleMapType(mapType);
    }
  }, [mapType, isLoaded, map, setGoogleMapType]);

  return (
    <div className="relative h-full w-full">
      {/* Google Map Container */}
      <div
        ref={mapRef}
        className="w-full h-full rounded-lg overflow-hidden shadow-lg"
      />
      
      {/* Map Controls Overlay - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Map Type Controls */}
        <div className="bg-white p-2 rounded-lg shadow-lg grid grid-cols-2 gap-1">
          <Button
            variant={mapType === "roadmap" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapType("roadmap")}
          >
            Map
          </Button>
          <Button
            variant={mapType === "satellite" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapType("satellite")}
          >
            Satellite
          </Button>
          <Button
            variant={mapType === "hybrid" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapType("hybrid")}
          >
            Hybrid
          </Button>
          <Button
            variant={mapType === "terrain" ? "default" : "outline"}
            size="sm"
            onClick={() => setMapType("terrain")}
          >
            Terrain
          </Button>
        </div>
        
        {/* Location and Search Controls */}
        <div className="bg-white p-2 rounded-lg shadow-lg flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMyLocationClick}
          >
            My Location
          </Button>
        </div>
      </div>
      
      {/* Status Selection Controls - Bottom */}
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
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedContact) {
                deleteContactMutation.mutate(selectedContact.id);
              }
              setShowDeleteDialog(false);
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Work Timer Display - Top Left Corner */}
      <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow-lg z-10">
        <div className="text-sm font-bold">{formattedTime}</div>
        <div className="flex gap-2 mt-1">
          <Button
            variant={timerActiveRef.current ? "outline" : "default"}
            size="sm"
            onClick={() => {
              // If first time starting, initialize the session
              if (!firstHouseRecordedRef.current && !timerActiveRef.current) {
                firstHouseRecordedRef.current = true;
                sessionsRef.current.push({
                  startTime: new Date().toISOString(),
                  duration: 0
                });
              }
              
              // Toggle timer state
              timerActiveRef.current = !timerActiveRef.current;
              
              // Save current session duration when pausing
              if (!timerActiveRef.current) {
                const currentSession = sessionsRef.current[sessionsRef.current.length - 1];
                if (currentSession) {
                  currentSession.duration = workTimerRef.current;
                }
              } else {
                // Create a new session if resuming after pause
                if (firstHouseRecordedRef.current) {
                  sessionsRef.current.push({
                    startTime: new Date().toISOString(),
                    duration: 0
                  });
                }
              }
              
              // Force UI update
              setTimerDisplay(workTimerRef.current);
              
              // Show feedback toast
              toast({
                title: timerActiveRef.current ? "Timer Started" : "Timer Paused",
                description: timerActiveRef.current ? 
                  "Recording your work time" : 
                  `Session duration: ${formattedTime}`,
              });
            }}
            className="px-2 py-1 h-auto"
          >
            {timerActiveRef.current ? "Pause" : "Start/Resume"}
          </Button>
        </div>
      </div>
    </div>
  );
}