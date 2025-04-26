import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { geocodeAddress, getMarkerIcon, getCurrentLocation } from "@/lib/maps";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Contact, InsertContact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  const [newHouseMarker, setNewHouseMarker] = useState<google.maps.Marker | null>(null);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newContactCoords, setNewContactCoords] = useState<{lat: number; lng: number} | null>(null);
  const [newContactForm, setNewContactForm] = useState({
    fullName: "",
    address: "",
    phone: "",
    email: "",
    status: "not_visited",
    notes: ""
  });
  
  // Work timer state - using refs to avoid render loops 
  const workTimerRef = useRef(0);
  const timerActiveRef = useRef(true);
  const lastActivityRef = useRef(Date.now());
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
  } = useGoogleMaps(GOOGLE_MAPS_API_KEY, {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5,
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", contactData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
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

  // Auto-detect user location on map load
  useEffect(() => {
    const getUserLocation = async () => {
      if (isLoaded && map) {
        try {
          const position = await getCurrentLocation();
          if (position) {
            panTo(position);
            map.setZoom(16); // Zoom in close enough to see houses
            console.log("Auto-detected user location and centered map");
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
  }, [isLoaded, map, panTo, toast]);

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
          marker.addListener("click", () => {
            if (onSelectContact) {
              onSelectContact(contact.id);
            }
          });
        }
      }
    });
  }, [contacts, isLoaded, map, clearMarkers, addMarker, isLoadingContacts, onSelectContact]);

  // Set up click listener for adding houses - can click anywhere on the map
  useEffect(() => {
    if (!isLoaded || !map || !window.google) return;
    
    const mapClickListener = map.addListener("click", async (e: any) => {
      if (!e.latLng) return;
      
      // Check if the click is on an existing contact marker
      // If it is, the existing marker's click handler will handle it
      const clickedFeature = map.data?.getFeatureAt?.(e.latLng);
      if (clickedFeature) return;
      
      // If we're not in adding house mode, don't add a new marker, but still show the form
      // This way users can click anywhere on map without toggling "Add House" mode
      
      // Remove the previous marker if it exists
      if (newHouseMarker) {
        newHouseMarker.setMap(null);
      }
      
      // Create a new marker where the user clicked
      const marker = addMarker(e.latLng.toJSON(), {
        title: "New Contact",
        draggable: true,
        animation: window.google.maps.Animation.DROP,
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
          setNewContactForm((prev) => ({ 
            ...prev, 
            address,
            // Add current timestamp for visited
            notes: `Initial contact: ${new Date().toLocaleString()}`
          }));
          setShowNewContactDialog(true);
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
      // Clean up the listener when the component unmounts
      window.google.maps.event.removeListener(mapClickListener);
    };
  }, [isLoaded, map, addMarker, newHouseMarker, toast]);

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
      
      // If inactive for more than 30 minutes (1800000 ms), pause the timer
      if (now - lastActivityRef.current > 1800000 && timerActiveRef.current) {
        timerActiveRef.current = false;
        
        // Save work time to localStorage or could send to server in real app
        const workTimeData = {
          userId: user?.id,
          date: new Date().toISOString().split('T')[0],
          duration: workTimerRef.current,
          endTime: new Date().toISOString(),
        };
        localStorage.setItem(`workTime_${user?.id}_${new Date().toISOString().split('T')[0]}`, 
                            JSON.stringify(workTimeData));
        
        toast({
          title: "Timer paused",
          description: "No activity detected for 30 minutes",
        });
      }
      
      // Only increment if active
      if (timerActiveRef.current) {
        workTimerRef.current += 1;
      }
    }, 1000);
    
    // Track mouse movement and map interaction as activity
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      
      // If timer was inactive, restart it
      if (!timerActiveRef.current) {
        timerActiveRef.current = true;
        toast({
          title: "Timer resumed",
          description: "Activity detected",
        });
      }
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
  const handleMapTypeChange = (type: "roadmap" | "satellite") => {
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

    createContactMutation.mutate({
      userId: user?.id || 0,
      fullName: newContactForm.fullName,
      address: newContactForm.address,
      phone: newContactForm.phone,
      email: newContactForm.email,
      status: newContactForm.status,
      notes: newContactForm.notes,
      latitude: newContactCoords.lat.toString(),
      longitude: newContactCoords.lng.toString(),
    });
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
                timerActiveRef.current = !timerActiveRef.current;
                // Force re-render
                setTimerDisplay(workTimerRef.current);
              }} 
              variant={timerActiveRef.current ? "outline" : "default"}
              size="sm"
            >
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
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-2">
            <div className="text-xs font-medium mb-1">Contact Status</div>
            <div className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span>
              <span className="text-neutral-600">Converted</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
              <span className="text-neutral-600">Follow up</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"></span>
              <span className="text-neutral-600">Not interested</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
              <span className="text-neutral-600">Not visited</span>
            </div>
            <div className="flex items-center text-xs">
              <span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
              <span className="text-neutral-600">No soliciting</span>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
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
    </>
  );
}