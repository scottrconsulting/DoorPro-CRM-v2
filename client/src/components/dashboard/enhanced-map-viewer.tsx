import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { useLongPress } from "@/hooks/use-long-press";
import { geocodeAddress, getMarkerIcon, getCurrentLocation, getUserAvatarIcon } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact, InsertVisit, InsertSchedule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { getStatusColor, getColorStyle, getStatusLabel } from "@/lib/status-helpers";

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
  const [isProcessingClick, setIsProcessingClick] = useState(false); // Add processing flag

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

      const clickEndTime = Date.now();
      setMouseUpTime(clickEndTime);

      // Calculate click duration
      const clickDuration = mouseDownTime ? clickEndTime - mouseDownTime : 0;
      const isLongClick = clickDuration > 500; // 500ms threshold for long press

      console.log("Map click detected - Duration:", clickDuration, "ms, IsLongClick:", isLongClick);

      // Get the address from the coordinates first
      const geocoder = new window.google.maps.Geocoder();

      try {
        const geocodePromise = new Promise((resolve, reject) => {
          geocoder.geocode({ location: e.latLng.toJSON() }, (results: any, status: any) => {
            if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
              resolve(results[0]);
            } else {
              reject(new Error("Geocoding failed"));
            }
          });
        });

        const result: any = await geocodePromise;
        const address = result.formatted_address;

        // Extract address components
        const streetNumber = result.address_components.find((c: any) => 
          c.types.includes('street_number'))?.short_name || '';
        const street = result.address_components.find((c: any) => 
          c.types.includes('route'))?.short_name || '';
        const city = result.address_components.find((c: any) => 
          c.types.includes('locality'))?.short_name || '';
        const state = result.address_components.find((c: any) => 
          c.types.includes('administrative_area_level_1'))?.short_name || '';
        const zipCode = result.address_components.find((c: any) => 
          c.types.includes('postal_code'))?.short_name || '';

        const autoName = streetNumber && street ? `${streetNumber} ${street}` : 'New Contact';
        const coords = e.latLng.toJSON();

        // Start work timer when first contact is added (if not already started)
        if (!firstHouseRecordedRef.current) {
          firstHouseRecordedRef.current = true;
          timerActiveRef.current = true;
          sessionsRef.current.push({
            startTime: new Date().toISOString(),
            duration: 0
          });
        }

        if (isLongClick) {
          // Long press - show detailed contact form
          console.log("Long press detected - showing contact form");

          // Create a marker at the clicked location
          const marker = addMarker(coords, {
            title: "New Contact",
            draggable: true,
            animation: window.google.maps.Animation.DROP,
            icon: getMarkerIcon(activeStatus, customization?.pinColors, customization?.statusLabels),
          });

          const isAppointmentStatus = activeStatus === "booked" || activeStatus === "check_back";

          // Prepare the contact form data
          const formData = {
            fullName: "",
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            phone: "",
            email: "",
            status: activeStatus,
            notes: "",
            appointment: "",
            latitude: coords.lat.toString(),
            longitude: coords.lng.toString(),
          };

          // Set all state at once to prevent race conditions
          console.log("Opening contact form with data:", formData);
          
          setNewHouseMarker(marker);
          setNewContactAddress(address);
          setNewContactCoords(coords);
          setNewContactForm(formData);
          setShowSchedulingFields(isAppointmentStatus);
          setIsAddingHouse(true);
          
          // Use requestAnimationFrame to ensure DOM updates are complete
          requestAnimationFrame(() => {
            setShowNewContactDialog(true);
          });

        } else {
          // Quick click - just add the contact with minimal info
          console.log("Quick click detected - creating contact directly");

          createContactMutation.mutate({
            userId: user?.id || 0,
            fullName: autoName,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode,
            status: activeStatus,
            latitude: coords.lat.toString(),
            longitude: coords.lng.toString(),
            notes: `Quick add: ${new Date().toLocaleString()}`
          }, {
            onSuccess: () => {
              // Reset form state after quick add
              setNewContactForm({
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
              });
            }
          });
        }

      } catch (error) {
        console.error("Error geocoding address:", error);
        toast({
          title: "Search Error",
          description: "Error finding this address",
          variant: "destructive",
        });
        
        // For failed geocoding, still allow contact creation with coordinates only
        const coords = e.latLng.toJSON();

        if (isLongClick) {
          // Create marker and show form even without address
          const marker = addMarker(coords, {
            title: "New Contact",
            draggable: true,
            animation: window.google.maps.Animation.DROP,
            icon: getMarkerIcon(activeStatus, customization?.pinColors, customization?.statusLabels),
          });

          setNewHouseMarker(marker);
          setNewContactAddress("Address unavailable");
          setNewContactCoords(coords);
          setIsAddingHouse(true);

          const formData = {
            fullName: "",
            address: "Address unavailable",
            city: "",
            state: "",
            zipCode: "",
            phone: "",
            email: "",
            status: activeStatus,
            notes: "",
            appointment: "",
            latitude: coords.lat.toString(),
            longitude: coords.lng.toString(),
          };

          setNewContactForm(formData);
          setTimeout(() => {
            setShowNewContactDialog(true);
          }, 50);
        }
      }

      // Always reset processing flag
      setTimeout(() => {
        setIsProcessingClick(false);
      }, 500);
    }); // Close the async function

    return () => {
      mouseDownListener.remove();
      clickListener.remove();
    };
  }, [map, isLoaded, activeStatus, createContactMutation, toast, user, customization]);