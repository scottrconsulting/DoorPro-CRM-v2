import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { useLongPress } from "@/hooks/use-long-press";
import { geocodeAddress, getMarkerIcon, getCurrentLocation, getUserAvatarIcon } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact, InsertVisit, InsertSchedule } from "@shared/schema";
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
    google: any;
    initGoogleMaps?: () => void;
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
  const [showLegend, setShowLegend] = useState(true); // For legend toggle
  const [inStreetView, setInStreetView] = useState(false); // Track street view state
  
  // Function to handle contact deletion
  const handleContactDelete = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteDialog(true);
  }, []);
  
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
  
  // Track if we've already attempted to locate the user
  const hasLocatedUser = useRef<boolean>(false);
  
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
    isInStreetView,
    exitStreetView
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
        
        // Create a schedule entry if the contact has appointment/follow-up details
        if (createdContact.appointmentDate && createdContact.appointmentTime) {
          const startDateTime = new Date(`${createdContact.appointmentDate}T${createdContact.appointmentTime}`);
          
          if (createdContact.status === "booked") {
            // Create an appointment schedule entry
            const endDateTime = new Date(startDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + 60); // Default to 1 hour appointment
            
            createScheduleEntry({
              userId: user.id,
              title: `Appointment with ${createdContact.fullName}`,
              description: `Sales appointment at ${createdContact.address}`,
              startTime: startDateTime,
              endTime: endDateTime,
              type: "appointment",
              location: createdContact.address,
              reminderSent: false,
              contactIds: [createdContact.id]
            });
          } else if (createdContact.status === "check_back") {
            // Create a follow-up schedule entry
            const endDateTime = new Date(startDateTime);
            endDateTime.setMinutes(endDateTime.getMinutes() + 30); // Default to 30 min follow-up
            
            createScheduleEntry({
              userId: user.id,
              title: `Follow-up with ${createdContact.fullName}`,
              description: `Check back at ${createdContact.address}`,
              startTime: startDateTime,
              endTime: endDateTime,
              type: "follow_up",
              location: createdContact.address,
              reminderSent: false,
              contactIds: [createdContact.id]
            });
          }
        }
      }
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
  
  // Create schedule entry mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (scheduleData: InsertSchedule) => {
      const res = await apiRequest("POST", "/api/schedules", scheduleData);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Schedule Created",
        description: variables.type === 'appointment' 
          ? "Appointment has been added to your schedule" 
          : "Follow-up has been added to your schedule",
      });
    },
    onError: (error) => {
      console.error("Failed to create schedule entry", error);
      toast({
        title: "Schedule Creation Failed",
        description: "There was an error creating the schedule entry",
        variant: "destructive",
      });
    }
  });
  
  // Helper function to create a schedule entry
  const createScheduleEntry = (scheduleData: InsertSchedule) => {
    createScheduleMutation.mutate(scheduleData);
  };
  
  // Handle address search
  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter an address to search",
        variant: "destructive",
      });
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
    const position = await getCurrentLocation();
    if (position && map) {
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
      
      toast({
        title: "Location Found",
        description: "Map centered to your current location",
      });
    } else {
      toast({
        title: "Location Error",
        description: "Unable to get your current location. Please ensure location services are enabled.",
        variant: "destructive",
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
              description: `Added pin with status: ${getStatusLabel(activeStatus)}`,
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
  }, [isLoaded, map, addMarker, mouseDownTime, activeStatus, toast, user?.id, createContactMutation]);

  // Function to get the CSS color for a status based on customization
  const getStatusColor = (status: string): string => {
    // Default color mapping - updated to match pin colors
    const defaultColorMap: Record<string, string> = {
      no_answer: 'bg-pink-500',    // Changed from not_visited to no_answer with pink color
      interested: 'bg-yellow-500',
      not_interested: 'bg-red-500',
      check_back: 'bg-yellow-500',  // Follow-up uses yellow
      booked: 'bg-blue-500',       // Booked appointments use blue
      converted: 'bg-green-500',
      no_soliciting: 'bg-purple-500',
      considering: 'bg-purple-500',
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
  
  // Function to properly capitalize a status for display
  const getStatusLabel = (status: string): string => {
    if (customization?.statusLabels && customization.statusLabels[status]) {
      return customization.statusLabels[status];
    }
    // Capitalize each word
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Function to silently locate the user without showing toast notifications
  const locateUserSilently = useCallback(async () => {
    if (!map) return;
    
    // With our updated getCurrentLocation function, it will always return a position
    // (either actual location or fallback)
    const position = await getCurrentLocation();
    
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
  }, [map, panTo, userMarker]);
  
  // Get user's location on map load - but only once when the component first mounts
  useEffect(() => {
    if (isLoaded && map && !hasLocatedUser.current) {
      hasLocatedUser.current = true;
      // Silently locate user without showing toast notification
      locateUserSilently();
    }
  }, [isLoaded, map, locateUserSilently]);

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
                description: `${contact.fullName || "Unknown"} - ${getStatusLabel(contact.status)}`,
              });
            }
          }
        });
        
        // Long-press handler to show delete option
        marker.addListener("mousedown", () => {
          const startTime = Date.now();
          const longPressTimeout = setTimeout(() => {
            handleContactDelete(contact);
          }, 800); // 800ms long-press
          
          // Clear timeout if mouse is released before threshold
          marker.addListener("mouseup", () => {
            const duration = Date.now() - startTime;
            if (duration < 800) {
              clearTimeout(longPressTimeout);
            }
          });
        });
        
        // Right-click handler to show delete option (for desktop)
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
      // Only exit street view when the button is clicked, not on initial render
      setGoogleMapType(mapType);
    }
  }, [mapType, isLoaded, map, setGoogleMapType]);
  
  // Monitor street view status changes
  useEffect(() => {
    if (!isLoaded || !map) return;
    
    // Check every 750ms if we're in street view
    const streetViewInterval = setInterval(() => {
      const newInStreetViewState = isInStreetView();
      if (newInStreetViewState !== inStreetView) {
        setInStreetView(newInStreetViewState);
      }
    }, 750);
    
    return () => clearInterval(streetViewInterval);
  }, [isLoaded, map, isInStreetView, inStreetView]);

  // Monitor status changes in the form
  useEffect(() => {
    // Show/hide appointment scheduling fields based on status
    const needsScheduling = 
      newContactForm.status === "booked" || 
      newContactForm.status === "check_back";
    
    setShowSchedulingFields(needsScheduling);
    
    // Clear scheduling fields if not needed
    if (!needsScheduling) {
      setNewContactForm(prev => ({
        ...prev,
        appointmentDate: "",
        appointmentTime: ""
      }));
    }
  }, [newContactForm.status]);

  // Update the form status when the active status changes
  useEffect(() => {
    setNewContactForm(prev => ({
      ...prev,
      status: activeStatus
    }));
  }, [activeStatus]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div 
        ref={mapRef} 
        className="w-full h-full"
      />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Search Controls - Top */}
      <div className="absolute top-4 left-4 right-4 md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 flex flex-col gap-2 z-10">
        <div className="bg-white p-2 rounded-lg shadow-lg flex items-stretch gap-2">
          <Input
            type="text"
            placeholder="Search for an address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-[200px] flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddressSearch();
            }}
          />
          <Button 
            onClick={handleAddressSearch}
            variant="secondary"
            size="sm"
          >
            Search
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
          
          {/* Street View Exit Button - Only shown when in street view */}
          {inStreetView && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                exitStreetView();
                setInStreetView(false);
              }}
              className="mt-2"
            >
              Exit Street View
            </Button>
          )}
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
        
        {/* Only show the status buttons if legend is expanded */}
        {showLegend && (
          <>
            {/* Status buttons matching colors in customize page */}
            {[
              { status: "no_answer", defaultLabel: "No Answer" },
              { status: "presented", defaultLabel: "Demoed" },
              { status: "booked", defaultLabel: "Booked" },
              { status: "sold", defaultLabel: "Sold" },
              { status: "not_interested", defaultLabel: "Not Interested" },
              { status: "no_soliciting", defaultLabel: "No Soliciting" },
              { status: "check_back", defaultLabel: "Check Back" },
            ].map(status => (
              <Button
                key={status.status}
                variant="outline"
                size="sm"
                className={`h-8 px-2 py-1 text-xs ${activeStatus === status.status ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveStatus(status.status)}
              >
                <span 
                  className={`inline-block w-3 h-3 rounded-full mr-1 ${getStatusColor(status.status)}`} 
                  style={getColorStyle(status.status)}
                ></span>
                {customization?.statusLabels?.[status.status] || status.defaultLabel}
              </Button>
            ))}
          </>
        )}
      </div>
      
      {/* Map Type Controls */}
      <div className="absolute bottom-4 right-4 z-10">
        <div className="bg-white rounded-lg shadow-lg flex flex-col p-1 gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={`px-2 py-1 h-8 text-xs ${mapType === 'roadmap' ? 'bg-primary text-white' : ''}`}
            onClick={() => {
              // Only exit Street View if we're in it and clicked a different map type
              if (inStreetView) {
                exitStreetView();
                setInStreetView(false);
              }
              setMapType('roadmap');
            }}
          >
            Map
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`px-2 py-1 h-8 text-xs ${mapType === 'satellite' ? 'bg-primary text-white' : ''}`}
            onClick={() => {
              if (inStreetView) {
                exitStreetView();
                setInStreetView(false);
              }
              setMapType('satellite');
            }}
          >
            Satellite
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`px-2 py-1 h-8 text-xs ${mapType === 'hybrid' ? 'bg-primary text-white' : ''}`}
            onClick={() => {
              if (inStreetView) {
                exitStreetView();
                setInStreetView(false);
              }
              setMapType('hybrid');
            }}
          >
            Hybrid
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`px-2 py-1 h-8 text-xs ${mapType === 'terrain' ? 'bg-primary text-white' : ''}`}
            onClick={() => {
              if (inStreetView) {
                exitStreetView();
                setInStreetView(false);
              }
              setMapType('terrain');
            }}
          >
            Terrain
          </Button>
        </div>
      </div>
      
      {/* New Contact Dialog */}
      <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Name</Label>
              <Input 
                id="fullName" 
                value={newContactForm.fullName}
                onChange={(e) => setNewContactForm(prev => ({...prev, fullName: e.target.value}))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                value={newContactForm.address}
                onChange={(e) => setNewContactForm(prev => ({...prev, address: e.target.value}))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
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
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="zipCode">Zip Code</Label>
              <Input 
                id="zipCode" 
                value={newContactForm.zipCode}
                onChange={(e) => setNewContactForm(prev => ({...prev, zipCode: e.target.value}))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  type="tel"
                  value={newContactForm.phone}
                  onChange={(e) => setNewContactForm(prev => ({...prev, phone: e.target.value}))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={newContactForm.email}
                  onChange={(e) => setNewContactForm(prev => ({...prev, email: e.target.value}))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={newContactForm.status}
                onValueChange={(value) => setNewContactForm(prev => ({...prev, status: value}))}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="check_back">Check Back</SelectItem>
                  <SelectItem value="booked">Appointment Booked</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="no_soliciting">No Soliciting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {showSchedulingFields && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">
                    {newContactForm.status === "booked" ? "Appointment Date" : "Follow-up Date"}
                  </Label>
                  <Input 
                    id="appointmentDate" 
                    type="date"
                    value={newContactForm.appointmentDate}
                    onChange={(e) => setNewContactForm(prev => ({...prev, appointmentDate: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointmentTime">
                    {newContactForm.status === "booked" ? "Appointment Time" : "Follow-up Time"}
                  </Label>
                  <Input 
                    id="appointmentTime" 
                    type="time"
                    value={newContactForm.appointmentTime}
                    onChange={(e) => setNewContactForm(prev => ({...prev, appointmentTime: e.target.value}))}
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                rows={3} 
                value={newContactForm.notes}
                onChange={(e) => setNewContactForm(prev => ({...prev, notes: e.target.value}))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewContactDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Create the contact with all form data
                if (newContactCoords) {
                  // Prepare contact data for submission
                  const contactData: any = {
                    userId: user?.id || 0,
                    fullName: newContactForm.fullName,
                    address: newContactForm.address,
                    city: newContactForm.city,
                    state: newContactForm.state,
                    zipCode: newContactForm.zipCode,
                    phone: newContactForm.phone,
                    email: newContactForm.email,
                    status: newContactForm.status,
                    latitude: newContactCoords.lat.toString(),
                    longitude: newContactCoords.lng.toString(),
                    notes: newContactForm.notes
                  };
                  
                  // Handle scheduling fields based on status
                  if (newContactForm.appointmentDate) {
                    // Common scheduling data for both booked and check_back
                    // Format appointment string - important to include this properly
                  contactData.appointment = `${newContactForm.appointmentDate} ${newContactForm.appointmentTime}`;
                  
                  // Also include the separate fields
                  contactData.appointmentDate = newContactForm.appointmentDate;
                  contactData.appointmentTime = newContactForm.appointmentTime;
                  
                  console.log("Adding appointment data:", {
                    appointment: contactData.appointment,
                    appointmentDate: contactData.appointmentDate,
                    appointmentTime: contactData.appointmentTime,
                    status: contactData.status
                  });
                    
                    // Handle booked appointments
                    if (newContactForm.status === "booked") {
                      // Add appointment details to notes for backward compatibility
                      const appointmentNotes = `Appointment scheduled for ${newContactForm.appointmentDate} at ${newContactForm.appointmentTime}`;
                      contactData.notes = contactData.notes 
                        ? `${contactData.notes}\n\n${appointmentNotes}`
                        : appointmentNotes;
                      
                      toast({
                        title: "Appointment Scheduled",
                        description: `Successfully scheduled for ${newContactForm.appointmentDate} at ${newContactForm.appointmentTime}`,
                      });
                    }
                    
                    // Handle check-back reminders
                    if (newContactForm.status === "check_back") {
                      // Add check-back details to notes for backward compatibility
                      const checkBackNotes = `Check back scheduled for ${newContactForm.appointmentDate} at ${newContactForm.appointmentTime}`;
                      contactData.notes = contactData.notes 
                        ? `${contactData.notes}\n\n${checkBackNotes}`
                        : checkBackNotes;
                      
                      toast({
                        title: "Check Back Scheduled",
                        description: `Reminder set for ${newContactForm.appointmentDate} at ${newContactForm.appointmentTime}`,
                      });
                    }
                  }
                  
                  // Create the contact with all data
                  console.log("Creating contact with data:", contactData);
                  createContactMutation.mutate(contactData);
                  
                  setShowNewContactDialog(false);
                }
              }}
            >
              Create Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Confirmation Dialog */}
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
                setSelectedContact(null);
              }
              setShowDeleteDialog(false);
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}