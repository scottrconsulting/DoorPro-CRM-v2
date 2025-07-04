import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { useLongPress } from "@/hooks/use-long-press";
import { geocodeAddress, getMarkerIcon, getCurrentLocation, getUserAvatarIcon } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact, InsertVisit } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  statusLabels: Record<string, string>;
  enabledWidgets: string[];
  widgetOrder: string[];
  defaultMapType: string;
  quickActions: string[];
  customStatuses: string[];
  appointmentTypes: string[];
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
        marker?: {
          AdvancedMarkerElement?: any;
        };
      };
    };
    initGoogleMaps?: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface MapViewerProps {
  onSelectContact?: (contactId: number) => void;
}

// Function to properly capitalize a status for display
const getStatusLabel = (status: string, statusLabels: Record<string, string> | undefined): string => {
  // Map not_visited to no_answer for display purposes
  const mappedStatus = status === 'not_visited' ? 'no_answer' : status;

  if (statusLabels) {
    // First check for direct match
    if (statusLabels[status]) {
      return statusLabels[status];
    }
    // Then check for mapped status match
    if (mappedStatus !== status && statusLabels[mappedStatus]) {
      return statusLabels[mappedStatus];
    }
  }

  // Handle special cases directly
  if (status === 'not_visited') {
    return 'No Answer';
  }

  // Capitalize each word
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

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
  const [activeStatus, setActiveStatus] = useState<string>("no_answer");
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseUpTime, setMouseUpTime] = useState<number | null>(null);
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLegend, setShowLegend] = useState(true); // For legend toggle

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

  // Set up timer interval
  useEffect(() => {
    // Timer update interval - every second
    const timerInterval = setInterval(() => {
      if (timerActiveRef.current) {
        workTimerRef.current += 1;
        setTimerDisplay(workTimerRef.current);
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

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
    // Removed custom mapId to use standard Google Maps appearance
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contactData);
      return res.json();
    },
    onSuccess: (createdContact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
        setNewHouseMarker(null);
      }
      setIsAddingHouse(false);

      // Create a visit record for this contact interaction
      if (createdContact?.id && user?.id) {
        createVisitMutation.mutate({
          contactId: createdContact.id,
          userId: user.id,
          visitType: "initial",
          notes: `Initial contact - Status: ${createdContact.status}`,
          outcome: createdContact.status === "booked" ? "positive" : 
                   createdContact.status === "not_interested" ? "negative" : "neutral",
          followUpNeeded: createdContact.status === "check_back" || createdContact.status === "booked",
          visitDate: new Date()
        });
      }
    },
    onError: (error) => {
      console.error("Failed to create contact", error);
      // Toast notification removed per user request
      // No notification will be shown
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
      // Toast notification removed per user request
      // No notification will be shown
      // Remove from selected contacts if needed
      setSelectedContacts((prev) => prev.filter(id => id !== contactId));
    },
    onError: (error) => {
      console.error("Failed to delete contact", error);
      // Toast notification removed per user request
      // No notification will be shown
    }
  });

  // Function to handle contact deletion
  const handleContactDelete = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteDialog(true);
  }, []);

  // Handle address search
  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) {
      // Toast notification removed per user request
      // No notification will be shown
      return;
    }

    try {
      const result = await geocodeAddress(searchQuery);

      if (result && map) {
        const position = {
          lat: parseFloat(result.latitude),
          lng: parseFloat(result.longitude)
        };

        // Pan the map to the found location
        panTo(position);
        map.setZoom(17);

        // Create a temporary marker at the searched location
        if (newHouseMarker) {
          newHouseMarker.setMap(null);
        }

        const marker = new window.google.maps.Marker({
          position: position,
          map: map,
          animation: window.google.maps.Animation.DROP,
          title: result.address
        });

        setNewHouseMarker(marker);
        setNewContactAddress(result.address);
        setNewContactCoords(position);

        // Prefill the contact form with address details
        setNewContactForm(prev => ({
          ...prev,
          address: result.address,
          city: result.city || '',
          state: result.state || '',
          zipCode: result.zipCode || ''
        }));

        toast({
          title: "Location Found",
          description: result.address,
        });
      } else {
        toast({
          title: "Search Error",
          description: "No results found for this address",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Address search error:", error);
      toast({
        title: "Search Error",
        description: "Error finding this address",
        variant: "destructive",
      });
    }
  };

  // Handle my location button click
  const handleMyLocationClick = async () => {
    // With our updated getCurrentLocation function, it will always return a position
    // (either actual location or fallback)
    const position = await getCurrentLocation();

    if (map) {
      panTo(position);
      map.setZoom(15);

      // Remove previous user location marker if it exists
      if (userMarker) {
        userMarker.setMap(null);
      }

      // Create a blue dot marker for user's current location
      const newUserMarker = new window.google.maps.Marker({
        position: position,
        map: map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#4285F4", // Google blue
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#FFFFFF",
        },
        title: "Your Location",
        zIndex: 1000 // Ensure it's above other markers
      });

      setUserMarker(newUserMarker);

      // We'll always have a location now - either real or default
      toast({
        title: "Location Set",
        description: "Map centered to location",
      });
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
        icon: getMarkerIcon(activeStatus, customization?.pinColors, customization?.statusLabels),
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

          // Different behavior based on click duration
          if (isLongClick) {
            // Long press - show detailed contact form
            setNewContactForm(prev => ({
              ...prev,
              fullName: autoName,
              address: address,
              city: city,
              state: state,
              zipCode: zipCode,
              status: activeStatus,
              latitude: e.latLng.lat().toString(),
              longitude: e.latLng.lng().toString(),
            }));

            // Show the form dialog for long press
            setShowNewContactDialog(true);

            toast({
              title: "New Contact Form",
              description: "Fill in the details to add this contact",
            });
          } else {
            // Quick click - just add the contact with minimal info
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
                description: `Added pin with status: ${getStatusLabel(activeStatus, customization?.statusLabels)}`,
              });
          }
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
  }, [isLoaded, map, addMarker, mouseDownTime, activeStatus, toast, user?.id, createContactMutation, customization]);

  // Function to get the CSS color for a status based on customization
  const getStatusColor = (status: string): string => {
    // Default color mapping
    const defaultColorMap: Record<string, string> = {
      no_answer: 'bg-pink-500',       // Pink for No Answer (replacing not_visited)
      not_visited: 'bg-pink-500',     // For backward compatibility
      presented: 'bg-orange-500',     // Orange for Presented/Demoed
      booked: 'bg-blue-500',          // Blue for Booked/Appointments
      sold: 'bg-green-500',           // Green for Sold/Converted
      not_interested: 'bg-red-500',   // Red for Not Interested
      no_soliciting: 'bg-purple-500', // Purple for No Soliciting
      check_back: 'bg-yellow-500',    // Yellow for Check Back/Follow-up
      interested: 'bg-yellow-500',    // For backward compatibility
      call_back: 'bg-yellow-500',     // For backward compatibility
      appointment_scheduled: 'bg-blue-500', // For backward compatibility
      converted: 'bg-green-500',      // For backward compatibility
      considering: 'bg-purple-500',   // For backward compatibility
    };

    // If customization is available, use the customized color
    if (customization?.pinColors && customization.pinColors[status]) {
      const customColor = customization.pinColors[status];

      // If it's a hex color, use it directly as an inline style
      if (customColor.startsWith('#')) {
        // Return null so we can use inline style instead
        return '';
      }

      // Convert color name to tailwind classes
      const colorClassMap: Record<string, string> = {
        'red': 'bg-red-500',
        'blue': 'bg-blue-500',
        'green': 'bg-green-500',
        'yellow': 'bg-yellow-500',
        'purple': 'bg-purple-500',
        'orange': 'bg-orange-500',
        'pink': 'bg-pink-500',
      };

      return colorClassMap[customColor.toLowerCase()] || defaultColorMap[status] || 'bg-blue-500';
    }

    return defaultColorMap[status] || 'bg-blue-500';
  };

  // Function to get inline style if it's a hex color
  const getColorStyle = (status: string): React.CSSProperties | undefined => {
    if (customization?.pinColors && customization.pinColors[status]) {
      const customColor = customization.pinColors[status];
      if (customColor.startsWith('#')) {
        return { backgroundColor: customColor };
      }
    }
    return undefined;
  };

  // Track if we've already attempted to locate the user
  const hasLocatedUser = useRef(false);

  // Get user's location on map load - but only once when the component first mounts
  useEffect(() => {
    if (isLoaded && map && !hasLocatedUser.current) {
      // Auto-center map to user's location only the first time
      handleMyLocationClick();
      hasLocatedUser.current = true;
    }
  }, [isLoaded, map, handleMyLocationClick]);

  // Update markers when contacts or customization changes
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
      const markerIcon = getMarkerIcon(contact.status, customization?.pinColors, customization?.statusLabels);

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
                description: `${contact.fullName || "Unknown"} - ${getStatusLabel(contact.status, customization?.statusLabels)}`,
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

  }, [contacts, isLoaded, map, clearMarkers, addMarker, isLoadingContacts, onSelectContact, toast, isAddingHouse, customization, handleContactDelete]);

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

      {/* Map Type Controls - Top Right */}
      <div className="absolute top-2 right-2 z-10 flex bg-white rounded overflow-hidden border border-gray-200 shadow-sm">
        <button
          className={`py-1 px-2 text-xs ${mapType === 'roadmap' ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
          onClick={() => setMapType("roadmap")}
        >
          Road
        </button>
        <button
          className={`py-1 px-2 text-xs ${mapType === 'satellite' ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
          onClick={() => setMapType("satellite")}
        >
          Satellite
        </button>
        <button
          className={`py-1 px-2 text-xs ${mapType === 'hybrid' ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
          onClick={() => setMapType("hybrid")}
        >
          Hybrid
        </button>
        <button
          className={`py-1 px-2 text-xs ${mapType === 'terrain' ? 'bg-primary text-white' : 'bg-white text-gray-700'}`}
          onClick={() => setMapType("terrain")}
        >
          Terrain
        </button>
      </div>

      {/* Address Search Bar - Top Center */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 w-64 md:w-80">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-8 h-9 shadow-lg rounded-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddressSearch();
              }
            }}
          />
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-0 top-0 h-9 w-9"
            onClick={handleAddressSearch}
          >
            <span className="material-icons text-base">search</span>
          </Button>
        </div>
      </div>

      {/* Other Controls - Right side */}
      <div className="absolute top-14 right-4 flex flex-col gap-2 z-10">

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

      {/* Status Selection Controls - Bottom with Minimize/Maximize button */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-1 rounded-lg shadow-lg flex items-center gap-1 flex-wrap justify-center z-10">
        {/* Toggle button for showing/hiding the legend */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full shrink-0"
          onClick={() => setShowLegend(!showLegend)}
          title={showLegend ? "Minimize legend" : "Maximize legend"}
        >
          <span className="material-icons text-sm">
            {showLegend ? "remove" : "add"}
          </span>
        </Button>

        {/* Only show the status buttons if legend is visible */}
        {showLegend && (
          <>
            {/* Show status buttons based on customization */}
            {[
              // Core statuses with the right display labels as shown in customization page
              { id: "no_answer", defaultLabel: "No Answer" },
              { id: "presented", defaultLabel: "Demoed" }, // Changed to match customization page
              { id: "booked", defaultLabel: "Booked" },
              { id: "sold", defaultLabel: "Sold" },
              { id: "not_interested", defaultLabel: "Not Interested" },
              { id: "no_soliciting", defaultLabel: "No Soliciting" },
              { id: "check_back", defaultLabel: "Check Back" },
              // Include other standard statuses for backward compatibility
              { id: "not_visited", defaultLabel: "Unknown" },
              { id: "interested", defaultLabel: "Interested" },
              { id: "appointment_scheduled", defaultLabel: "Appointment" },
              { id: "converted", defaultLabel: "Converted" },
              { id: "call_back", defaultLabel: "Call Back" }
            ].filter(status => {
              // Only show the core statuses that we specifically want (matching the customization page)
              const coreStatuses = [
                "no_answer", "presented", "booked", "sold", 
                "not_interested", "no_soliciting", "check_back"
              ];

              return coreStatuses.includes(status.id);
            }).map(status => (
              <Button
                key={status.id}
                variant={activeStatus === status.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveStatus(status.id)}
                className="rounded-full text-xs px-2 py-1 h-7"
              >
                <div
                  className="w-2 h-2 rounded-full mr-1 border border-gray-200"
                  style={{
                    backgroundColor: customization?.pinColors?.[status.id] || 
                      // Default colors for standard statuses
                      // Colors matching DEFAULT_PIN_COLORS from schema.ts
                      status.id === "no_answer" || status.id === "not_visited" ? "#e91e63" :  // Pink
                      status.id === "presented" ? "#ff9800" :   // Orange
                      status.id === "booked" || status.id === "appointment_scheduled" ? "#2196f3" :  // Blue
                      status.id === "sold" || status.id === "converted" ? "#4caf50" :  // Green
                      status.id === "not_interested" ? "#f44336" :  // Red
                      status.id === "no_soliciting" ? "#9c27b0" :  // Purple
                      status.id === "check_back" || status.id === "call_back" || status.id === "interested" ? "#ffeb3b" :  // Yellow
                      "#cccccc")
                  }}
                />
                {customization?.statusLabels && customization.statusLabels[status.id] 
                  ? customization.statusLabels[status.id] 
                  : status.defaultLabel}
              </Button>
            ))}
          </>
        )}
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

      {/* Temporarily hidden until core features are stable 
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
      */}

      {/* New Contact Dialog - appears on long press */}
      <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Enter the details for this new contact.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name / Address</Label>
                <Input 
                  id="fullName" 
                  value={newContactForm.fullName}
                  onChange={(e) => setNewContactForm(prev => ({...prev, fullName: e.target.value}))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={newContactForm.status}
                  onValueChange={(value) => setNewContactForm(prev => ({...prev, status: value}))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only display the 7 statuses used for map pins */}
                    <SelectItem value="not_interested">{getStatusLabel("not_interested", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="booked">{getStatusLabel("booked", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="presented">{getStatusLabel("presented", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="no_answer">{getStatusLabel("no_answer", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="check_back">{getStatusLabel("check_back", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="no_soliciting">{getStatusLabel("no_soliciting", customization?.statusLabels)}</SelectItem>
                    <SelectItem value="sold">{getStatusLabel("sold", customization?.statusLabels)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                value={newContactForm.address}
                onChange={(e) => setNewContactForm(prev => ({...prev, address: e.target.value}))}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city" 
                  value={newContactForm.city}
                  onChange={(e) => setNewContactForm(prev => ({...prev, city: e.target.value}))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input 
                  id="state" 
                  value={newContactForm.state}
                  onChange={(e) => setNewContactForm(prev => ({...prev, state: e.target.value}))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input 
                  id="zipCode" 
                  value={newContactForm.zipCode}
                  onChange={(e) => setNewContactForm(prev => ({...prev, zipCode: e.target.value}))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm(prev => ({...prev, phone: e.target.value}))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={newContactForm.email}
                  onChange={(e) => setNewContactForm(prev => ({...prev, email: e.target.value}))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                rows={3}
                value={newContactForm.notes}
                onChange={(e) => setNewContactForm(prev => ({...prev, notes: e.target.value}))}
              />
            </div>

            {/* Scheduling section only for booked and check_back statuses */}
            {(newContactForm.status === 'booked' || newContactForm.status === 'check_back') && (
              <div className="space-y-2 border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-base font-semibold">Scheduling</Label>
                  <div className="flex items-center">
                    <Checkbox 
                      id="enableScheduling"
                      checked={showSchedulingFields}
                      onCheckedChange={(checked) => setShowSchedulingFields(!!checked)}
                    />
                    <Label htmlFor="enableScheduling" className="ml-2">Set appointment</Label>
                  </div>
                </div>

                {showSchedulingFields && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointmentDate">Date</Label>
                      <Input 
                        id="appointmentDate" 
                        type="date"
                        value={newContactForm.appointmentDate}
                        onChange={(e) => setNewContactForm(prev => ({...prev, appointmentDate: e.target.value}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appointmentTime">Time</Label>
                      <Input 
                        id="appointmentTime" 
                        type="time"
                        value={newContactForm.appointmentTime}
                        onChange={(e) => setNewContactForm(prev => ({...prev, appointmentTime: e.target.value}))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewContactDialog(false);
                // Remove the marker if canceling
                if (newHouseMarker) {
                  newHouseMarker.setMap(null);
                  setNewHouseMarker(null);
                }
                setIsAddingHouse(false);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Create the contact with all the gathered information
                if (newContactCoords) {
                  createContactMutation.mutate({
                    userId: user?.id || 0,
                    fullName: newContactForm.fullName,
                    address: newContactForm.address,
                    city: newContactForm.city,
                    state: newContactForm.state,
                    zipCode: newContactForm.zipCode,
                    email: newContactForm.email,
                    phone: newContactForm.phone,
                    status: newContactForm.status,
                    notes: newContactForm.notes,
                    latitude: newContactCoords.lat.toString(),
                    longitude: newContactCoords.lng.toString(),
                    // Add scheduling info if enabled
                    appointment: showSchedulingFields && (newContactForm.status === 'booked' || newContactForm.status === 'check_back') ? 
                      `${newContactForm.appointmentDate} ${newContactForm.appointmentTime}` : null
                  });
                }
                setShowNewContactDialog(false);
              }}
              disabled={!newContactCoords || !newContactForm.fullName}
            >
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}