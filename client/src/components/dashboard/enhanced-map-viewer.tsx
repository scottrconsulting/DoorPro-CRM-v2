import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { useLongPress } from "@/hooks/use-long-press";
import { geocodeAddress, getMarkerIcon, getCurrentLocation, getUserAvatarIcon } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact, InsertVisit, InsertSchedule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import CustomTour from "@/components/tour/custom-tour";
import { customMapTourSteps } from "@/tours/custom-map-tour-steps";
import { useTour } from "@/contexts/tour-context";
import ContactForm from "@/components/contacts/contact-form";
import ContactCard from "@/components/contacts/contact-card";
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

// Define the contact form state interface
interface ContactFormState {
  fullName: string;
  address: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  status: string;
  notes: string;
  appointment: string;
}

// Add Google Maps types
declare global {
  interface Window {
    google: any;
    initGoogleMaps?: () => void;
    handleStartMapTour?: () => void;
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
  
  const [newContactForm, setNewContactForm] = useState<ContactFormState>({
    fullName: "",
    address: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    zipCode: "",
    status: activeStatus,
    notes: "",
    appointment: "",
    // We'll use the appointment string format in the contact schema
    // instead of separate appointmentDate and appointmentTime fields
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
        
        // NOTE: We're now letting the contact form handle appointment creation
        // to avoid creating duplicate appointment entries in the schedule.
        // The visit record is still created here, but appointment scheduling
        // is handled by the contact form component when adding/editing contacts.
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
        
        // Prefill the contact form with address details but reset the name field
        setNewContactForm(prev => ({
          ...prev,
          fullName: "", // Explicitly reset name to prevent it showing previous contact's name
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
    try {
      // No need for loading state as it might cause UI issues
      console.log("Getting current location...");
      const position = await getCurrentLocation();
      console.log("Current location:", position);
      
      if (position && map) {
        // Animate to the user's location smoothly
        panTo(position);
        map.setZoom(15);
        
        if (userMarker) {
          // If marker exists, just update its position instead of recreating it
          // This prevents the flickering effect
          userMarker.setPosition(position);
        } else {
          // Create a special My Location marker only if it doesn't exist yet
          const newUserMarker = new window.google.maps.Marker({
            position: position,
            map: map,
            icon: {
              // Create a pulsing blue dot like the one in Google Maps mobile app
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: "#4285F4", // Google Maps blue 
              fillOpacity: 0.8,
              strokeColor: "#FFFFFF", 
              strokeWeight: 2,
              scale: 12 // Not too large, not too small
            },
            title: "Your Location",
            animation: window.google.maps.Animation.DROP, // Add a drop animation for visibility
            zIndex: 1000 // Ensure it's above other markers
          });
          
          // Store the new marker reference
          setUserMarker(newUserMarker);
        }
        
        // Show a success notification
        toast({
          title: "Location Found",
          description: "Map centered on your current location",
        });
      }
    } catch (error) {
      console.error("Location error:", error);
      // Show a helpful error message
      toast({
        title: "Location Services Required",
        description: "Please enable location services in your device settings to track your location",
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
            
            // Toast notification removed per user request
            // No notification will be shown
          }
          
          // Different behavior based on click duration
          if (isLongClick) {
            // Long press - show detailed contact form
            const isAppointmentStatus = activeStatus === "booked" || activeStatus === "check_back";
            
            setNewContactForm(prev => ({
              ...prev,
              // Don't pre-fill the name at all - let user enter it themselves
              fullName: "", 
              address: address,
              city: city,
              state: state,
              zipCode: zipCode,
              status: activeStatus,
              latitude: e.latLng.lat().toString(),
              longitude: e.latLng.lng().toString(),
            }));
            
            // Set the scheduling fields visibility state first
            setShowSchedulingFields(isAppointmentStatus);
            
            // Show the form dialog for long press
            setShowNewContactDialog(true);
            
            // Log for debugging
            console.log("Map pin contact form opened with status:", activeStatus, "- Should show appointment fields:", isAppointmentStatus);
            
            // Toast notification removed per user request
            // No notification will be shown
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
            }, {
              onSuccess: () => {
                // Make sure to reset the form state after quick add too
                setNewContactForm({
                  fullName: "", // Critical: reset name to prevent persistence
                  address: "",
                  phone: "",
                  email: "",
                  city: "",
                  state: "",
                  zipCode: "",
                  status: activeStatus, 
                  notes: "",
                  appointment: "",
                });
              }
            });
            
            // Toast notification removed per user request
            // No notification will be shown
          }
        } else {
          // Could not get the address
          // Toast notification removed per user request
          // No notification will be shown
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
    // Map not_visited to no_answer for display purposes
    const mappedStatus = status === 'not_visited' ? 'no_answer' : status;
    
    if (customization?.statusLabels) {
      // First check for direct match
      if (customization.statusLabels[status]) {
        return customization.statusLabels[status];
      }
      // Then check for mapped status match
      if (mappedStatus !== status && customization.statusLabels[mappedStatus]) {
        return customization.statusLabels[mappedStatus];
      }
    }
    
    // Handle special cases directly
    if (status === 'not_visited') {
      return 'No Answer';
    }
    
    // Capitalize each word
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Function to silently locate the user without showing toast notifications
  const locateUserSilently = useCallback(async () => {
    if (!map) return;
    
    try {
      console.log("Silently getting current location...");
      const position = await getCurrentLocation();
      console.log("Auto-locate position:", position);
      
      // Only update marker position without changing map zoom or center
      // This provides real-time tracking without disrupting the user's map view
      
      if (userMarker) {
        // If marker exists, just update its position instead of recreating it
        // This prevents the flickering effect
        userMarker.setPosition(position);
      } else {
        // Create a special My Location marker only if it doesn't exist yet
        const newUserMarker = new window.google.maps.Marker({
          position: position,
          map: map,
          icon: {
            // Create a blue dot like the one in Google Maps mobile app
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#4285F4", // Google Maps blue 
            fillOpacity: 0.8,
            strokeColor: "#FFFFFF", 
            strokeWeight: 2,
            scale: 12 // Not too large, not too small
          },
          title: "Your Location",
          zIndex: 1000 // Ensure it's above other markers
        });
        
        // Store the new marker reference
        setUserMarker(newUserMarker);
      }
      
      // Return the position for use by other functions
      return position;
    } catch (error) {
      // Silently handle location errors without showing toasts
      console.log("Location tracking error (silent):", error);
      // Don't show error notifications for automatic background tracking
      return null;
    }
  }, [map, userMarker]);
  
  // Function to center the map on user's location (used on initial load)
  const centerMapOnUserLocation = useCallback(async () => {
    if (!map) return;
    
    try {
      // Get the user's location
      const position = await locateUserSilently();
      
      if (position && !hasLocatedUser.current) {
        // Center the map on the user's location and set zoom
        panTo(position);
        map.setZoom(15);
        
        // Mark that we've located the user so we don't do it again 
        // until a new map session
        hasLocatedUser.current = true;
        
        console.log("Map automatically centered on user location");
      }
    } catch (error) {
      console.error("Auto-centering map failed:", error);
      // No notification for automatic centering
    }
  }, [map, locateUserSilently, panTo]);
  
  // Set up real-time location tracking that continuously updates every minute
  useEffect(() => {
    if (!isLoaded || !map) return;
    
    // First, center the map on user's location (automatic)
    // This simulates clicking the "My Location" button automatically
    centerMapOnUserLocation();
    
    // Set up interval for continuous real-time tracking
    const locationTrackingInterval = setInterval(() => {
      // Re-request location every minute to keep location current
      // A longer interval reduces flickering and battery usage
      locateUserSilently();
    }, 60000); // 60 seconds in milliseconds
    
    // Clean up interval when component unmounts
    return () => {
      clearInterval(locationTrackingInterval);
    };
  }, [isLoaded, map, locateUserSilently, centerMapOnUserLocation]);

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
              
              // Toast notification removed per user request
              // No notification will be shown
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

  // Monitor when the dialog opens
  useEffect(() => {
    if (showNewContactDialog) {
      console.log("Map pin contact form opened with status:", newContactForm.status, 
        "- Should show appointment fields:", 
        newContactForm.status === "booked" || newContactForm.status === "check_back",
        "- Should show sale fields:", newContactForm.status === "sold");
    }
  }, [showNewContactDialog, newContactForm.status]);

  // Monitor status changes in the form
  useEffect(() => {
    // Show/hide appointment scheduling fields based on status
    const needsScheduling = 
      newContactForm.status === "booked" || 
      newContactForm.status === "check_back";
    
    const needsSaleFields = newContactForm.status === "sold";
    
    setShowSchedulingFields(needsScheduling);
    
    // Clear scheduling fields if not needed
    if (!needsScheduling) {
      // Reset appointment fields (will be handled via appointment string in universal form)
      setNewContactForm(prev => ({
        ...prev
        // appointment fields will be handled by the form component
      }));
    }
    
    // If status needs scheduling and we're showing the dialog, ensure we flag the form
    if ((needsScheduling || needsSaleFields) && showNewContactDialog) {
      console.log(`Status ${newContactForm.status} requires extra fields, updating form...`);
    }
  }, [newContactForm.status, showNewContactDialog]);

  // Update the form status when the active status changes
  useEffect(() => {
    setNewContactForm(prev => ({
      ...prev,
      status: activeStatus
    }));
  }, [activeStatus]);

  // Custom Tour functionality
  const { endTour } = useTour();
  const [showMapTour, setShowMapTour] = useState(false);
  
  // Function to start the map tour
  const handleStartMapTour = () => {
    console.log("Map tour button clicked - setting showMapTour to true");
    setShowMapTour(true);
    console.log("Current showMapTour state:", showMapTour); // This will show the previous state due to React's async state updates
  };
  
  // Expose the handleStartMapTour function to the window object
  useEffect(() => {
    window.handleStartMapTour = handleStartMapTour;
    
    return () => {
      // Clean up when component unmounts
      delete window.handleStartMapTour;
    };
  }, []);
  
  // Function to close the map tour
  const handleCloseMapTour = () => {
    setShowMapTour(false);
  };

  return (
    <div className="relative w-full h-full">
{/* Map Tour Guide is moved to end of component */}
      
      {/* Map container */}
      <div 
        ref={mapRef} 
        className="w-full h-full map-container"
        id="map-container"
        data-tour="map-container"
      />
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* Search Controls and Map Options in a single bar at the top */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        {/* Main search bar and controls - Responsive layout */}
        <div className="bg-white p-2 rounded-lg shadow-lg flex flex-col sm:flex-row items-stretch gap-2 w-full">
          {/* Search input and button - Always visible */}
          <div className="flex-grow flex items-stretch gap-2 map-search" id="map-search-container" data-tour="map-search">
            <Input
              type="text"
              placeholder="Search for an address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-[150px] flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddressSearch();
              }}
            />
            <Button 
              onClick={handleAddressSearch}
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
            >
              Search
            </Button>
          </div>
          
          {/* My Location button - Always visible */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMyLocationClick}
              className="text-xs whitespace-nowrap flex-shrink-0 location-button"
              id="my-location-button"
              data-tour="my-location"
            >
              My Location
            </Button>
          
            {/* Map Type Controls - Responsive handling */}
            <div className="hidden sm:flex items-stretch gap-0.5 ml-2 border-l pl-2 map-controls" id="map-controls" data-tour="map-controls">
              <Button
                variant="ghost"
                size="sm"
                className={`min-w-[50px] px-1.5 py-1 h-8 text-xs ${mapType === 'roadmap' ? 'bg-primary text-white' : ''}`}
                onClick={() => {
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
                className={`min-w-[50px] px-1.5 py-1 h-8 text-xs ${mapType === 'satellite' ? 'bg-primary text-white' : ''}`}
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
                className={`min-w-[50px] px-1.5 py-1 h-8 text-xs ${mapType === 'hybrid' ? 'bg-primary text-white' : ''}`}
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
                className={`min-w-[50px] px-1.5 py-1 h-8 text-xs ${mapType === 'terrain' ? 'bg-primary text-white' : ''}`}
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
            
            {/* Mobile dropdown for map type */}
            <div className="flex sm:hidden items-center border-l pl-2">
              <Select 
                value={mapType}
                onValueChange={(value: 'roadmap' | 'satellite' | 'hybrid' | 'terrain') => {
                  if (inStreetView) {
                    exitStreetView();
                    setInStreetView(false);
                  }
                  setMapType(value);
                }}
              >
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue placeholder="Map Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roadmap">Map</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Street View Exit Button - Only shown when in street view */}
      {inStreetView && (
        <div className="absolute top-20 right-4 z-10 bg-white p-1.5 rounded-lg shadow-lg">
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              exitStreetView();
              setInStreetView(false);
            }}
          >
            Exit Street View
          </Button>
        </div>
      )}
      
      {/* Status Selection Controls - Bottom with Minimize/Maximize button */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-1 rounded-lg shadow-lg flex items-center gap-1 flex-wrap justify-center z-10 status-filter" id="status-filter" data-tour="status-filter">
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
              { status: "presented", defaultLabel: "Presented" },
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
                {getStatusLabel(status.status)}
              </Button>
            ))}
          </>
        )}
      </div>
      
      {/* Map Type Controls have been moved to the main search bar at the top */}
      
      {/* New Contact Dialog - Using our new consolidated Form Component */}
      <ContactForm
        isOpen={showNewContactDialog}
        onClose={() => {
          // Clear the form completely when closing the dialog to prevent conflicts on next open
          setNewContactForm({
            fullName: "", // Reset to empty to avoid auto-filling from previous contact
            address: "",
            phone: "",
            email: "",
            city: "",
            state: "",
            zipCode: "",
            status: activeStatus, // Keep the active status to match selected pin type
            notes: "",
            appointment: "", // Clear appointment data
            // Clear any other fields that might be persisting
          });
          setShowNewContactDialog(false);
        }}
        initialContact={{
          fullName: newContactForm.fullName,
          address: newContactForm.address,
          city: newContactForm.city,
          state: newContactForm.state,
          zipCode: newContactForm.zipCode,
          phone: newContactForm.phone || "",
          email: newContactForm.email || "",
          status: newContactForm.status,
          notes: newContactForm.notes || "",
          latitude: newContactCoords?.lat.toString() || "",
          longitude: newContactCoords?.lng.toString() || "",
          // Add a field that triggers the appointment fields
          // This ensures the form shows scheduling fields for booked or check_back
          // This matches our form's showAppointmentFields state initialization
        }}
        onSuccess={(newContact: Contact) => {
          // Log status for debugging
          console.log("Contact created successfully:", newContact);
          
          // Handle successful creation
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
          
          // Reset form completely to prevent data persisting to next contact
          setNewContactForm({
            fullName: "", // Make sure name is cleared for the next new contact
            address: "",
            phone: "",
            email: "",
            city: "",
            state: "",
            zipCode: "",
            status: activeStatus,
            notes: "",
            appointment: "",
          });
          
          // Cleanup map marker
          if (newHouseMarker) {
            newHouseMarker.setMap(null);
            setNewHouseMarker(null);
          }
          setIsAddingHouse(false);
          
          // Create a visit record for this contact interaction
          if (newContact?.id && user?.id) {
            createVisitMutation.mutate({
              contactId: newContact.id,
              userId: user.id,
              visitType: "initial",
              notes: `Initial contact - Status: ${newContact.status}`,
              outcome: newContact.status === "booked" ? "positive" : 
                     newContact.status === "not_interested" ? "negative" : "neutral",
              followUpNeeded: newContact.status === "check_back" || newContact.status === "booked",
              visitDate: new Date()
            });
            
            // Handle scheduling based on status
            if (newContact.appointment) {
              const [appointmentDate, appointmentTime] = newContact.appointment.split(' ');
              if (appointmentDate && appointmentTime) {
                if (newContact.status === "booked") {
                  toast({
                    title: "Appointment Scheduled",
                    description: `Successfully scheduled for ${appointmentDate} at ${appointmentTime}`,
                  });
                } else if (newContact.status === "check_back") {
                  toast({
                    title: "Check Back Scheduled",
                    description: `Reminder set for ${appointmentDate} at ${appointmentTime}`,
                  });
                }
              }
            }
          }
        }}
      />

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

      {/* Custom Map Tour Dialog - Placed as the last component */}
      <CustomTour 
        steps={customMapTourSteps} 
        tourName="map"
        isOpen={showMapTour}
        onClose={handleCloseMapTour}
      />
    </div>
  );
}