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

// Add Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "your-api-key";

interface MapViewerProps {
  onSelectContact?: (contactId: number) => void;
}

export default function EnhancedMapViewer({ onSelectContact }: MapViewerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  const [newHouseMarker, setNewHouseMarker] = useState<google.maps.Marker | null>(null);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newContactCoords, setNewContactCoords] = useState<{lat: number; lng: number} | null>(null);
  const [userMarker, setUserMarker] = useState<google.maps.Marker | null>(null);
  // User avatar state removed as requested
  const [activeStatus, setActiveStatus] = useState<string>("not_visited");
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseUpTime, setMouseUpTime] = useState<number | null>(null);
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Drawing mode states removed as requested
  const [newContactForm, setNewContactForm] = useState({
    fullName: "",
    address: "",
    phone: "",
    email: "",
    status: "not_visited",
    notes: "",
    // Scheduling fields
    scheduleDate: "",
    scheduleTime: "",
    sendConfirmation: false,
    confirmationType: "none", // none, text, email, both
    confirmationTiming: "before", // immediate, before, both
    reminderTime: 30 // minutes before appointment
  });
  
  // Work timer state - using refs to avoid render loops 
  const workTimerRef = useRef(0);
  const timerActiveRef = useRef(false); // Start inactive until first house
  const lastActivityRef = useRef(Date.now());
  const firstHouseRecordedRef = useRef(false);
  const sessionsRef = useRef<{startTime: string, duration: number}[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Fetch contacts
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
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
    mapTypeId: "roadmap",
    onLoad: (map) => {
      // Drawing manager removed as requested
    },
  });

  // Create contact mutation
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

  const createContactMutation = useMutation({
    mutationFn: async (contactData: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contactData);
      return res.json();
    },
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      // Create a visit record for the new contact
      createVisitMutation.mutate({
        contactId: newContact.id,
        userId: newContact.userId,
        visitType: "initial",
        visitDate: new Date(),
        notes: `Initial contact created with status: ${newContact.status}`,
        outcome: newContact.status
      });
      
      toast({
        title: "Contact added",
        description: "New contact has been successfully added",
      });
      setShowNewContactDialog(false);
      setIsAddingHouse(false);
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
        setNewHouseMarker(null);
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to add contact",
        description: "There was an error adding the contact",
        variant: "destructive",
      });
    },
  });
  
  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      const res = await apiRequest("DELETE", `/api/contacts/${contactId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact deleted",
        description: "Contact has been successfully removed",
      });
      setShowDeleteDialog(false);
      setSelectedContact(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete contact",
        description: "There was an error removing the contact",
        variant: "destructive",
      });
    },
  });

  // Auto-detect user location on map load and show a standard marker instead of avatar
  // (removed boy/girl icon as requested)
  useEffect(() => {
    const getUserLocation = async () => {
      if (isLoaded && map && window.google) {
        try {
          const position = await getCurrentLocation();
          if (position) {
            // Only pan to user's location on initial load
            if (!userMarker) {
              panTo(position);
              map.setZoom(16); // Zoom in close enough to see houses
              console.log("Auto-detected user location and centered map");
              
              // Create a fixed marker for user location - no animation to prevent flickering
              const newUserMarker = new window.google.maps.Marker({
                position,
                map,
                title: "Your Location",
                // Using a standard blue marker instead of custom icon
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: "#4285F4",
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: "#FFFFFF",
                },
                zIndex: 1000, // Make sure user marker is on top
                optimized: true // For better performance
              });
              
              setUserMarker(newUserMarker);
            }
          }
        } catch (error) {
          console.error("Error getting current location:", error);
          toast({
            title: "Location access denied",
            description: "Please enable location services to see houses around you",
            variant: "destructive",
          });
        }
      }
    };
    
    getUserLocation();
    
    // Removed the watchPosition implementation to prevent flickering on mobile
    // Instead, we'll just use a static marker
    
    return () => {
      // No watcher to clean up since we removed watchPosition
      
      // Remove user marker
      if (userMarker) {
        userMarker.setMap(null);
      }
    };
  }, [isLoaded, map, panTo, toast, userMarker]);

  // Configure long press gesture for marker deletion (mobile support)
  const handleContactDelete = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setShowDeleteDialog(true);
  }, []);

  // Update markers when contacts change
  useEffect(() => {
    if (!isLoaded || !map || isLoadingContacts) return;
    
    clearMarkers();
    
    contacts.forEach((contact) => {
      if (contact.latitude && contact.longitude) {
        const position = {
          lat: parseFloat(contact.latitude),
          lng: parseFloat(contact.longitude),
        };
        
        const marker = addMarker(position, {
          title: contact.fullName,
          icon: getMarkerIcon(contact.status),
        });
        
        if (marker) {
          // Click handler to view the contact
          marker.addListener("click", () => {
            setSelectedContact(contact);
            
            if (onSelectContact) {
              onSelectContact(contact.id);
            }
          });
          
          // Right-click handler to show delete option (desktop)
          marker.addListener("rightclick", () => {
            handleContactDelete(contact);
          });
          
          // Add touch listeners for mobile long-press support
          // We need to add DOM event listeners to the marker element
          if (marker.getDiv) { // For advanced markers
            const markerElement = marker.getDiv();
            if (markerElement) {
              // Use our custom hook for long press
              const longPress = {
                onTouchStart: () => {
                  const timerId = window.setTimeout(() => {
                    handleContactDelete(contact);
                  }, 800); // 800ms threshold for long press
                  
                  // Store timer ID on the element itself
                  markerElement.setAttribute('data-timer-id', timerId.toString());
                },
                onTouchEnd: () => {
                  const timerId = markerElement.getAttribute('data-timer-id');
                  if (timerId) {
                    window.clearTimeout(parseInt(timerId));
                    markerElement.removeAttribute('data-timer-id');
                  }
                },
                onTouchCancel: () => {
                  const timerId = markerElement.getAttribute('data-timer-id');
                  if (timerId) {
                    window.clearTimeout(parseInt(timerId));
                    markerElement.removeAttribute('data-timer-id');
                  }
                }
              };
              
              // Add the event listeners
              markerElement.addEventListener('touchstart', longPress.onTouchStart);
              markerElement.addEventListener('touchend', longPress.onTouchEnd);
              markerElement.addEventListener('touchcancel', longPress.onTouchCancel);
            }
          } else { // For standard markers, we need a different approach
            // Add a tooltip indicating long-press to delete on mobile
            const tooltip = new window.google.maps.InfoWindow({
              content: "<div class='bg-black/70 text-white p-2 rounded text-xs'>Hold to delete</div>",
              disableAutoPan: true
            });
            
            // Show tooltip briefly when marker is tapped
            marker.addListener("click", () => {
              tooltip.open(map, marker);
              setTimeout(() => tooltip.close(), 2000);
            });
            
            // Google Maps API doesn't provide direct access to marker DOM element
            // So we'll use a workaround where we track touch start/end on the entire map
            // and check if it's over a marker
            const markerPosition = marker.getPosition();
            if (markerPosition) {
              const markerLatLng = markerPosition.toJSON();
              
              // Add a specific data attribute to map element to track this marker's touch
              const mapElement = map.getDiv();
              if (mapElement) {
                // We already have mousedown/up listeners on the map
                // We'll leverage those and the mouseDownTime state
              }
            }
          }
        }
      }
    });
  }, [contacts, isLoaded, map, clearMarkers, addMarker, isLoadingContacts, onSelectContact, handleContactDelete]);

  // Set up mouse down/up listeners for detecting click vs hold on the map
  useEffect(() => {
    if (!isLoaded || !map || !window.google) return;
    
    // Track when the mouse is pressed down
    const mouseDownListener = map.addListener("mousedown", (e: any) => {
      if (!e.latLng) return;
      setMouseDownTime(Date.now());
    });
    
    // Handle click with click vs hold detection
    const clickListener = map.addListener("click", async (e: any) => {
      if (!e.latLng) return;
      setMouseUpTime(Date.now());
      
      // Check if the click is on an existing contact marker
      // If it is, the existing marker's click handler will handle it
      const clickedFeature = map.data?.getFeatureAt?.(e.latLng);
      if (clickedFeature) return;
      
      // Calculate click duration
      const clickDuration = mouseDownTime ? Date.now() - mouseDownTime : 0;
      const isLongClick = clickDuration > 1000; // Threshold of 1 second for a long click/hold
      
      // Remove the previous marker if it exists
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
      }
      
      // Create a new marker where the user clicked
      const marker = addMarker(e.latLng.toJSON(), {
        title: "New Contact",
        draggable: true,
        animation: window.google.maps.Animation.DROP,
        icon: getMarkerIcon(activeStatus),
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
          
          // Create the base newContactForm data
          const newFormData = {
            ...newContactForm,
            address,
            status: activeStatus,
            notes: `Initial contact: ${new Date().toLocaleString()}`
          };
          
          setNewContactForm(newFormData);
          
          // For quick click, automatically add contact without showing form
          if (!isLongClick) {
            // Auto generate a name based on address if it's a quick click
            const streetNumber = results[0].address_components.find((c: any) => 
              c.types.includes('street_number'))?.short_name || '';
            const street = results[0].address_components.find((c: any) => 
              c.types.includes('route'))?.short_name || '';
            const autoName = streetNumber && street ? `${streetNumber} ${street}` : 'New Contact';
            
            // Extract city, state and zip code for the contact data
            const city = results[0].address_components.find((c: any) => 
              c.types.includes('locality'))?.short_name || '';
            const state = results[0].address_components.find((c: any) => 
              c.types.includes('administrative_area_level_1'))?.short_name || '';
            const zipCode = results[0].address_components.find((c: any) => 
              c.types.includes('postal_code'))?.short_name || '';
            
            // Create the contact with enhanced info
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
            
            // Start work timer when first contact is added
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
            
            toast({
              title: "Contact added",
              description: `Quick-added pin at ${address}`,
            });
          } else {
            // For long click/hold, show the form
            setShowNewContactDialog(true);
            
            // Check if the selected status needs scheduling fields
            const needsScheduling = ["appointment_scheduled", "call_back", "interested"].includes(activeStatus);
            setShowSchedulingFields(needsScheduling);
          }
        } else {
          toast({
            title: "Could not find address",
            description: "Unable to get the address for this location",
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
  }, [isLoaded, map, addMarker, newHouseMarker, toast, activeStatus, mouseDownTime, newContactForm, user?.id, createContactMutation]);
  
  // Drawing manager functionality removed as requested

  // Function to count contacts inside polygon removed as requested
  
  // Drawing mode toggle removed as requested

  // Work timer implementation (using refs to avoid render issues)
  useEffect(() => {
    // Start timer when component loads
    timerActiveRef.current = true;
    lastActivityRef.current = Date.now();
    
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Update the timer only if active
    const timerInterval = setInterval(() => {
      const now = Date.now();
      
      // If inactive for more than 30 minutes (1800000 ms), pause the timer automatically
      if (now - lastActivityRef.current > 1800000 && timerActiveRef.current) {
        // Update current session's duration before pausing
        const currentSession = sessionsRef.current[sessionsRef.current.length - 1];
        if (currentSession) {
          currentSession.duration = workTimerRef.current;
        }
        
        timerActiveRef.current = false;
        
        // Save work time to localStorage or could send to server in real app
        const workTimeData = {
          userId: user?.id,
          date: new Date().toISOString().split('T')[0],
          duration: workTimerRef.current,
          endTime: new Date().toISOString(),
          sessions: sessionsRef.current,
        };
        localStorage.setItem(`workTime_${user?.id}_${new Date().toISOString().split('T')[0]}`, 
                            JSON.stringify(workTimeData));
        
        toast({
          title: "Timer paused automatically",
          description: "No activity detected for 30 minutes",
        });
        
        // Force UI update
        setTimerDisplay(workTimerRef.current);
      }
      
      // Only increment if active
      if (timerActiveRef.current && firstHouseRecordedRef.current) {
        workTimerRef.current += 1;
      }
    }, 1000);
    
    // Track mouse movement and map interaction as activity
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Do not automatically restart the timer when activity is detected
      // as this would interfere with manual pausing - only update the last activity timestamp
      // The user will need to click the Resume button to restart the timer
    };
    
    // Add event listeners for activity tracking
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    
    return () => {
      clearInterval(timerInterval);
      clearInterval(timeInterval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      
      // Save work time when component unmounts
      const workTimeData = {
        userId: user?.id,
        date: new Date().toISOString().split('T')[0],
        duration: workTimerRef.current,
        endTime: new Date().toISOString(),
      };
      localStorage.setItem(`workTime_${user?.id}_${new Date().toISOString().split('T')[0]}`, 
                          JSON.stringify(workTimeData));
    };
  }, [user?.id, toast]);

  // Change map type
  useEffect(() => {
    if (isLoaded && map) {
      setGoogleMapType(mapType);
    }
  }, [mapType, isLoaded, map, setGoogleMapType]);

  // Handle map type toggle
  const handleMapTypeChange = (type: "roadmap" | "satellite" | "hybrid" | "terrain") => {
    setMapType(type);
  };

  // Handle my location button click
  const handleMyLocationClick = async () => {
    const position = await getCurrentLocation();
    if (position && map) {
      panTo(position);
      map.setZoom(15);
    }
  };

  // Toggle adding house mode
  const toggleAddingHouse = () => {
    setIsAddingHouse(!isAddingHouse);
    
    if (!isAddingHouse) {
      toast({
        title: "Adding a new house",
        description: "Click anywhere on the map to add a new contact",
      });
    } else {
      // Cancel adding mode
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
        setNewHouseMarker(null);
      }
    }
  };

  // Handle form input change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewContactForm((prev) => ({ ...prev, [name]: value }));
  };

  // Handle status change
  const handleStatusChange = (value: string) => {
    setNewContactForm((prev) => ({ ...prev, status: value }));
    
    // Show scheduling fields for certain statuses
    const needsScheduling = ["appointment_scheduled", "call_back", "interested"].includes(value);
    setShowSchedulingFields(needsScheduling);
  };
  
  // Set active status for next pin
  const handleSetActiveStatus = (status: string) => {
    setActiveStatus(status);
    toast({
      title: "Pin type selected",
      description: `Next pin will be marked as "${status.replace(/_/g, ' ')}"`,
    });
  };

  // Handle save new contact
  const handleSaveContact = () => {
    if (!newContactForm.fullName || !newContactForm.address || !newContactCoords) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Start timer after first house is recorded if not already running
    if (!firstHouseRecordedRef.current) {
      firstHouseRecordedRef.current = true;
      timerActiveRef.current = true;
      // Add first session
      sessionsRef.current.push({
        startTime: new Date().toISOString(),
        duration: 0
      });
      toast({
        title: "Work timer started",
        description: "Timer will track your work sessions automatically"
      });
    }

    // Prepare contact data
    const contactData: any = {
      userId: user?.id || 0,
      fullName: newContactForm.fullName,
      address: newContactForm.address,
      phone: newContactForm.phone,
      email: newContactForm.email,
      status: newContactForm.status,
      notes: newContactForm.notes,
      latitude: newContactCoords.lat.toString(),
      longitude: newContactCoords.lng.toString(),
    };
    
    // Add scheduling information if applicable
    if (showSchedulingFields && newContactForm.scheduleDate && newContactForm.scheduleTime) {
      contactData.scheduleDate = newContactForm.scheduleDate;
      contactData.scheduleTime = newContactForm.scheduleTime;
      
      // Add confirmation details if selected
      if (newContactForm.sendConfirmation) {
        contactData.sendConfirmation = true;
        contactData.confirmationType = newContactForm.confirmationType;
        contactData.confirmationTiming = newContactForm.confirmationTiming;
        contactData.reminderTime = newContactForm.reminderTime;
        
        // If immediate confirmation is requested, show user feedback
        if (newContactForm.confirmationTiming === "immediate" || newContactForm.confirmationTiming === "both") {
          toast({
            title: "Confirmation will be sent",
            description: `An immediate ${newContactForm.confirmationType} confirmation will be sent to the contact.`,
          });
        }
      }
    }
    
    createContactMutation.mutate(contactData);
  };

  // Count selected contacts
  const selectedContactsCount = selectedContacts.length;

  // Get contacts with coordinates
  const contactsWithCoordinates = useMemo(() => {
    return contacts.filter(
      (contact) => contact.latitude && contact.longitude
    );
  }, [contacts]);

  // Add current area contacts to selection
  const handleAddAreaSelection = () => {
    if (!map) return;
    
    const bounds = map.getBounds();
    if (!bounds) return;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const newSelectedContacts = contactsWithCoordinates
      .filter((contact) => {
        const lat = parseFloat(contact.latitude || "0");
        const lng = parseFloat(contact.longitude || "0");
        return (
          lat <= ne.lat() &&
          lat >= sw.lat() &&
          lng <= ne.lng() &&
          lng >= sw.lng()
        );
      })
      .map((contact) => contact.id);
    
    setSelectedContacts(newSelectedContacts);
  };

  // Format timer for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Need to re-render the timer display when it changes
  const [timerDisplay, setTimerDisplay] = useState(0);
  useEffect(() => {
    const timerDisplayInterval = setInterval(() => {
      setTimerDisplay(workTimerRef.current);
    }, 1000);
    
    return () => {
      clearInterval(timerDisplayInterval);
    };
  }, []);

  return (
    <>
      {/* Work Timer Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden mb-4">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <span className="material-icons text-primary mr-2">schedule</span>
            <div>
              <h3 className="font-medium text-neutral-800">Work Timer</h3>
              <p className="text-xs text-neutral-500">Tracks your active time</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <p className="text-xs text-neutral-500">Current Time</p>
              <p className="font-medium">{currentTime.toLocaleTimeString()}</p>
            </div>
            
            <div className="text-center">
              <p className="text-xs text-neutral-500">Work Duration</p>
              <p className={`font-bold ${timerActiveRef.current ? 'text-green-600' : 'text-red-500'}`}>
                {formatTime(timerDisplay)}
              </p>
            </div>
            
            <Button 
              onClick={() => {
                // Only allow pause/resume if we have recorded at least one house
                if (firstHouseRecordedRef.current) {
                  // Setup state to toggle between active and inactive
                  const newTimerState = !timerActiveRef.current;
                  
                  // If resuming (going from inactive to active)
                  if (newTimerState) {
                    // Start a new session
                    sessionsRef.current.push({
                      startTime: new Date().toISOString(),
                      duration: 0
                    });
                    toast({
                      title: "Timer resumed",
                      description: "A new work session has been started"
                    });
                  } else {
                    // If pausing (going from active to inactive)
                    // Update current session's duration
                    const currentSession = sessionsRef.current[sessionsRef.current.length - 1];
                    if (currentSession) {
                      currentSession.duration = workTimerRef.current;
                    }
                    toast({
                      title: "Timer paused",
                      description: "Your work session has been saved"
                    });
                  }
                  
                  // Update timer state
                  timerActiveRef.current = newTimerState;
                  
                  // Force immediate re-render for UI update
                  setTimerDisplay(workTimerRef.current);
                } else {
                  toast({
                    title: "Can't start timer yet",
                    description: "Record your first contact to start the timer",
                    variant: "destructive"
                  });
                }
              }} 
              variant={timerActiveRef.current ? "default" : "outline"}
              size="sm"
              disabled={!firstHouseRecordedRef.current}
              className="flex items-center"
            >
              <span className="material-icons text-sm mr-1">
                {timerActiveRef.current ? "pause_circle" : "play_circle"}
              </span>
              {timerActiveRef.current ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        <div className="border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <h2 className="font-medium text-neutral-800">Territory Map</h2>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-neutral-100 rounded-full">
              <button
                onClick={() => handleMapTypeChange("roadmap")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  mapType === "roadmap"
                    ? "bg-primary text-white"
                    : "text-neutral-600"
                }`}
              >
                Map
              </button>
              <button
                onClick={() => handleMapTypeChange("satellite")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  mapType === "satellite"
                    ? "bg-primary text-white"
                    : "text-neutral-600"
                }`}
              >
                Satellite
              </button>
              <button
                onClick={() => handleMapTypeChange("hybrid")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  mapType === "hybrid"
                    ? "bg-primary text-white"
                    : "text-neutral-600"
                }`}
              >
                Hybrid
              </button>
              <button
                onClick={() => handleMapTypeChange("terrain")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  mapType === "terrain"
                    ? "bg-primary text-white"
                    : "text-neutral-600"
                }`}
              >
                Terrain
              </button>
            </div>
            <Button 
              onClick={toggleAddingHouse}
              variant={isAddingHouse ? "default" : "outline"}
              size="sm"
              className="flex items-center"
            >
              <span className="material-icons text-sm mr-1">add_location</span>
              {isAddingHouse ? "Cancel" : "Add House"}
            </Button>
          </div>
        </div>
        
        <div className="map-container relative">
          <div ref={mapRef} className="w-full h-[500px]" />
          
          {/* Loading indicator */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          )}
          
          {/* Map Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
            <button
              onClick={() => map?.setZoom((map.getZoom() || 0) + 1)}
              className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
            >
              <span className="material-icons text-neutral-600">add</span>
            </button>
            <button
              onClick={() => map?.setZoom((map.getZoom() || 0) - 1)}
              className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
            >
              <span className="material-icons text-neutral-600">remove</span>
            </button>
            <button
              onClick={handleMyLocationClick}
              className="w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center"
            >
              <span className="material-icons text-neutral-600">my_location</span>
            </button>
            {/* Avatar gender button removed as requested */}
          </div>
          
          {/* Polygon info display removed as requested */}
          
          {/* Interactive Contact Status Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-2">
            <div className="text-xs font-medium mb-1">Contact Status (Click to Select)</div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "converted" ? "bg-green-100" : ""}`}
              onClick={() => handleSetActiveStatus("converted")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>
              <span className="text-neutral-600">Converted</span>
              {activeStatus === "converted" && <span className="material-icons text-green-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "interested" ? "bg-yellow-100" : ""}`}
              onClick={() => handleSetActiveStatus("interested")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
              <span className="text-neutral-600">Interested</span>
              {activeStatus === "interested" && <span className="material-icons text-yellow-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "not_interested" ? "bg-red-100" : ""}`}
              onClick={() => handleSetActiveStatus("not_interested")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>
              <span className="text-neutral-600">Not interested</span>
              {activeStatus === "not_interested" && <span className="material-icons text-red-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "not_visited" ? "bg-blue-100" : ""}`}
              onClick={() => handleSetActiveStatus("not_visited")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
              <span className="text-neutral-600">Not visited</span>
              {activeStatus === "not_visited" && <span className="material-icons text-blue-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "no_soliciting" ? "bg-purple-100" : ""}`}
              onClick={() => handleSetActiveStatus("no_soliciting")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
              <span className="text-neutral-600">No soliciting</span>
              {activeStatus === "no_soliciting" && <span className="material-icons text-purple-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            <div 
              className={`flex items-center text-xs px-2 py-1 rounded cursor-pointer ${activeStatus === "call_back" ? "bg-cyan-100" : ""}`}
              onClick={() => handleSetActiveStatus("call_back")}
            >
              <span className="inline-block w-3 h-3 rounded-full bg-cyan-500 mr-1"></span>
              <span className="text-neutral-600">Call back</span>
              {activeStatus === "call_back" && <span className="material-icons text-cyan-500 ml-1" style={{ fontSize: '14px' }}>check</span>}
            </div>
            
            {/* Tip for right-click deletion */}
            <div className="mt-2 text-xs italic text-muted-foreground border-t border-neutral-200 pt-1">
              Tip: Right-click on any pin to delete it
            </div>
          </div>
          
          {/* Add house instructions */}
          {isAddingHouse && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-md p-2 px-4 text-sm font-medium">
              Click anywhere on the map to add a new contact
            </div>
          )}
        </div>
        
        <div className="border-t border-neutral-200 px-4 py-3 flex items-center justify-between bg-neutral-50">
          <div className="text-sm text-neutral-500">
            <button 
              onClick={handleAddAreaSelection}
              className="font-medium hover:text-primary"
            >
              Select visible houses
            </button>
            {selectedContactsCount > 0 && (
              <span className="ml-2">
                <span className="font-medium">{selectedContactsCount} houses</span> selected
              </span>
            )}
          </div>
          {selectedContactsCount > 0 && (
            <button 
              className="px-3 py-1 bg-primary text-white text-sm font-medium rounded"
              onClick={() => {
                // In a real app, this would open a route planning UI
                // with the selected contacts
                console.log("Planning route for", selectedContacts);
              }}
            >
              Plan Route
            </button>
          )}
        </div>
      </div>

      {/* New Contact Dialog */}
      <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <p className="text-sm text-muted-foreground">Fill in contact information and notes</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 items-center gap-2">
              <label htmlFor="fullName" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="fullName"
                name="fullName"
                value={newContactForm.fullName}
                onChange={handleFormChange}
                placeholder="Enter contact's name"
              />
            </div>
            <div className="grid grid-cols-1 items-center gap-2">
              <label htmlFor="address" className="text-sm font-medium">
                Address
              </label>
              <Input
                id="address"
                name="address"
                value={newContactForm.address}
                onChange={handleFormChange}
                placeholder="Enter address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid grid-cols-1 items-center gap-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone (optional)
                </label>
                <Input
                  id="phone"
                  name="phone"
                  value={newContactForm.phone}
                  onChange={handleFormChange}
                  placeholder="Phone number"
                />
              </div>
              <div className="grid grid-cols-1 items-center gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email (optional)
                </label>
                <Input
                  id="email"
                  name="email"
                  value={newContactForm.email}
                  onChange={handleFormChange}
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 items-center gap-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <Select value={newContactForm.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_visited">Not Visited</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="considering">Considering</SelectItem>
                  <SelectItem value="no_soliciting">No Soliciting</SelectItem>
                  <SelectItem value="call_back">Call Back</SelectItem>
                  <SelectItem value="appointment_scheduled">Appointment Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Scheduling Fields - Conditionally shown based on status */}
            {showSchedulingFields && (
              <div className="border rounded-md p-3 bg-slate-50 mt-2">
                <h4 className="text-sm font-medium mb-2">Scheduling Information</h4>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid grid-cols-1 items-center gap-1">
                      <label htmlFor="scheduleDate" className="text-xs font-medium">
                        Date
                      </label>
                      <Input
                        id="scheduleDate"
                        name="scheduleDate"
                        type="date"
                        value={newContactForm.scheduleDate}
                        onChange={handleFormChange}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="grid grid-cols-1 items-center gap-1">
                      <label htmlFor="scheduleTime" className="text-xs font-medium">
                        Time
                      </label>
                      <Input
                        id="scheduleTime"
                        name="scheduleTime"
                        type="time"
                        value={newContactForm.scheduleTime}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="sendConfirmation" 
                        checked={newContactForm.sendConfirmation}
                        onCheckedChange={(checked) => {
                          setNewContactForm(prev => ({
                            ...prev,
                            sendConfirmation: checked === true
                          }));
                        }}
                      />
                      <label htmlFor="sendConfirmation" className="text-xs font-medium cursor-pointer">
                        Send confirmation message
                      </label>
                    </div>
                    
                    {newContactForm.sendConfirmation && (
                      <div className="grid gap-2 mt-1">
                        <div className="grid grid-cols-1 items-center gap-1">
                          <label htmlFor="confirmationTiming" className="text-xs font-medium">
                            When to send
                          </label>
                          <Select 
                            value={newContactForm.confirmationTiming || "before"} 
                            onValueChange={(value) => {
                              setNewContactForm(prev => ({
                                ...prev,
                                confirmationTiming: value
                              }));
                            }}
                          >
                            <SelectTrigger id="confirmationTiming">
                              <SelectValue placeholder="When to send" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="immediate">Send immediately</SelectItem>
                              <SelectItem value="before">Send before appointment</SelectItem>
                              <SelectItem value="both">Send both times</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-1 items-center gap-1">
                          <label htmlFor="confirmationType" className="text-xs font-medium">
                            Confirmation Type
                          </label>
                          <Select 
                            value={newContactForm.confirmationType} 
                            onValueChange={(value) => {
                              setNewContactForm(prev => ({
                                ...prev,
                                confirmationType: value
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text Message</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="both">Both Text & Email</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-1 items-center gap-1">
                          <label htmlFor="reminderTime" className="text-xs font-medium">
                            Send reminder (minutes before)
                          </label>
                          <Select 
                            value={newContactForm.reminderTime.toString()} 
                            onValueChange={(value) => {
                              setNewContactForm(prev => ({
                                ...prev,
                                reminderTime: parseInt(value)
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="120">2 hours</SelectItem>
                              <SelectItem value="1440">1 day</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 items-center gap-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notes (optional)
              </label>
              <Textarea
                id="notes"
                name="notes"
                value={newContactForm.notes}
                onChange={handleFormChange}
                placeholder="Add notes about this contact"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewContactDialog(false);
                setIsAddingHouse(false);
                if (newHouseMarker) {
                  newHouseMarker.setMap(null);
                  setNewHouseMarker(null);
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveContact}
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Adding..." : "Add Contact"}
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
              Are you sure you want to delete {selectedContact?.fullName || "this contact"}?
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => selectedContact && deleteContactMutation.mutate(selectedContact.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}