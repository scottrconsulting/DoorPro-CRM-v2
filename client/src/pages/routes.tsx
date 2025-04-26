import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Contact, Schedule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Navigation, MapPin, CheckCircle2 } from "lucide-react";
import { useGoogleMaps } from "@/lib/maps";

// Type for optimized route
interface RouteStop {
  contact: Contact;
  order: number;
  distance?: number;
  duration?: string;
}

// Google Maps API key from environment variable
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export default function Routes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [routeType, setRouteType] = useState<string>("optimized");
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>(google.maps.TravelMode.DRIVING);
  const [showScheduled, setShowScheduled] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Fetch contacts
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });

  // Fetch schedules
  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ["/api/schedules"],
    enabled: !!user && showScheduled,
  });

  // Filter schedules for selected date
  const filteredSchedules = schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.startTime).toISOString().split('T')[0];
    return scheduleDate === selectedDate;
  });

  // Filter to get contacts with schedules for today
  const contactsWithSchedules = contacts.filter(contact => {
    return filteredSchedules.some(schedule => 
      schedule.contactIds && schedule.contactIds.includes(contact.id)
    );
  });

  // Display contacts based on filter
  const displayContacts = showScheduled ? contactsWithSchedules : contacts;

  // Initialize Google Maps
  useEffect(() => {
    if (!mapRef.current || map) return;

    const initMap = async () => {
      // Check if Google Maps API is loaded
      if (!window.google || !window.google.maps) {
        toast({
          title: "Maps API Error",
          description: "Google Maps API failed to load",
          variant: "destructive",
        });
        return;
      }

      const mapInstance = new google.maps.Map(mapRef.current!, {
        center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
        zoom: 4,
        mapTypeControl: true,
        streetViewControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });

      setMap(mapInstance);
      setDirectionsService(new google.maps.DirectionsService());
      
      const renderer = new google.maps.DirectionsRenderer({
        map: mapInstance,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeWeight: 5,
        },
      });
      setDirectionsRenderer(renderer);

      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setUserLocation(userPos);
            mapInstance.setCenter(userPos);
            mapInstance.setZoom(11);

            // Add marker for user's position
            new google.maps.Marker({
              position: userPos,
              map: mapInstance,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF",
              },
              title: "Your Location",
            });
          },
          () => {
            toast({
              title: "Location Error",
              description: "Unable to get your current location",
              variant: "destructive",
            });
          }
        );
      }
    };

    initMap();
  }, [map, toast]);

  // Toggle contact selection
  const toggleContactSelection = (contact: Contact) => {
    if (selectedContacts.some(c => c.id === contact.id)) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  // Calculate route
  const calculateRoute = async () => {
    if (!directionsService || !directionsRenderer || !map || selectedContacts.length === 0) {
      toast({
        title: "Unable to calculate route",
        description: "Please select at least one contact and ensure maps is loaded",
        variant: "destructive",
      });
      return;
    }

    setIsCalculating(true);

    try {
      // Get addresses from contacts
      const locations = selectedContacts.map(contact => ({
        contact,
        geocoded: false,
        latLng: null as google.maps.LatLngLiteral | null,
      }));

      // Geocode addresses
      const geocoder = new google.maps.Geocoder();
      for (const location of locations) {
        try {
          const result = await geocoder.geocode({ address: location.contact.address });
          if (result.results[0]?.geometry?.location) {
            location.geocoded = true;
            location.latLng = {
              lat: result.results[0].geometry.location.lat(),
              lng: result.results[0].geometry.location.lng(),
            };
          }
        } catch (error) {
          console.error("Geocoding error:", error);
        }
      }

      // Filter out locations that couldn't be geocoded
      const validLocations = locations.filter(loc => loc.geocoded && loc.latLng);
      
      if (validLocations.length === 0) {
        throw new Error("None of the selected contacts have valid addresses");
      }

      // Start from user's location or first contact if user location not available
      const origin = userLocation || validLocations[0].latLng!;
      
      // For routes with multiple stops
      if (validLocations.length > 1) {
        if (routeType === "optimized") {
          // Use Directions API for route optimization with waypoints
          const waypoints = validLocations.map(loc => ({
            location: new google.maps.LatLng(loc.latLng!.lat, loc.latLng!.lng),
            stopover: true,
          }));
          
          const request: google.maps.DirectionsRequest = {
            origin,
            destination: origin, // Return to starting point
            waypoints,
            travelMode,
            optimizeWaypoints: true, // Let Google optimize the route
          };
          
          directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);
              
              // Create optimized route from the result
              const optimizedWaypoints = result.routes[0].waypoint_order;
              const legs = result.routes[0].legs;
              
              const route: RouteStop[] = optimizedWaypoints.map((waypointIndex, idx) => {
                const location = validLocations[waypointIndex];
                const leg = legs[idx];
                return {
                  contact: location.contact,
                  order: idx + 1,
                  distance: leg.distance?.value ?? 0,
                  duration: leg.duration?.text ?? "",
                };
              });
              
              setOptimizedRoute(route);
            } else {
              throw new Error(`Directions request failed: ${status}`);
            }
            setIsCalculating(false);
          });
        } else {
          // Sequential route (in order of selection)
          // Create markers for each location
          validLocations.forEach((location, index) => {
            new google.maps.Marker({
              position: location.latLng!,
              map: map,
              label: `${index + 1}`,
              title: location.contact.fullName,
            });
          });
          
          // Fit bounds to show all markers
          const bounds = new google.maps.LatLngBounds();
          validLocations.forEach(loc => bounds.extend(loc.latLng!));
          map.fitBounds(bounds);
          
          // Create sequential route
          setOptimizedRoute(validLocations.map((location, index) => ({
            contact: location.contact,
            order: index + 1,
          })));
          setIsCalculating(false);
        }
      } else {
        // Single destination
        const destination = validLocations[0].latLng!;
        
        const request: google.maps.DirectionsRequest = {
          origin,
          destination,
          travelMode,
        };
        
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);
            
            // Create single-stop route
            const leg = result.routes[0].legs[0];
            setOptimizedRoute([{
              contact: validLocations[0].contact,
              order: 1,
              distance: leg.distance?.value ?? 0,
              duration: leg.duration?.text ?? "",
            }]);
          } else {
            throw new Error(`Directions request failed: ${status}`);
          }
          setIsCalculating(false);
        });
      }
    } catch (error) {
      console.error("Route calculation error:", error);
      toast({
        title: "Route Calculation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      setIsCalculating(false);
    }
  };

  // Navigate to a specific address using platform-specific maps
  const navigateToAddress = (address: string) => {
    // Detect device type
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile device - open in Google Maps app
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    } else {
      // Desktop - open in browser
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    }
  };

  // Format distance to miles
  const formatDistance = (meters?: number) => {
    if (!meters) return '';
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="md:w-1/3 flex flex-col">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Route Planner</CardTitle>
              <CardDescription>Plan your sales route efficiently</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="routeType">Route Type</Label>
                <Select value={routeType} onValueChange={setRouteType}>
                  <SelectTrigger id="routeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optimized">Optimized (Shortest Route)</SelectItem>
                    <SelectItem value="sequential">Sequential (In Order)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="travelMode">Travel Mode</Label>
                <Select 
                  value={travelMode} 
                  onValueChange={(value) => setTravelMode(value as google.maps.TravelMode)}
                >
                  <SelectTrigger id="travelMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={google.maps.TravelMode.DRIVING}>Driving</SelectItem>
                    <SelectItem value={google.maps.TravelMode.WALKING}>Walking</SelectItem>
                    <SelectItem value={google.maps.TravelMode.BICYCLING}>Bicycling</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="showScheduled" 
                  checked={showScheduled} 
                  onCheckedChange={(checked) => setShowScheduled(checked as boolean)}
                />
                <Label htmlFor="showScheduled">Show only scheduled contacts</Label>
              </div>

              {showScheduled && (
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={calculateRoute} 
                disabled={isCalculating || selectedContacts.length === 0}
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Navigation className="mr-2 h-4 w-4" />
                    Calculate Route
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="flex-grow overflow-auto">
            <CardHeader>
              <CardTitle>Select Contacts</CardTitle>
              <CardDescription>
                {selectedContacts.length} contacts selected
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[400px]">
              {isLoadingContacts ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : displayContacts.length > 0 ? (
                <div className="space-y-2">
                  {displayContacts.map((contact) => (
                    <div 
                      key={contact.id} 
                      className="flex items-center p-2 rounded-md hover:bg-neutral-100 cursor-pointer"
                      onClick={() => toggleContactSelection(contact)}
                    >
                      <Checkbox 
                        checked={selectedContacts.some(c => c.id === contact.id)}
                        className="mr-2" 
                        onCheckedChange={() => toggleContactSelection(contact)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{contact.fullName}</div>
                        <div className="text-sm text-neutral-500 truncate">{contact.address}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-neutral-500">
                  {showScheduled 
                    ? "No scheduled contacts for this date" 
                    : "No contacts available"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:w-2/3 flex flex-col">
          <div 
            ref={mapRef} 
            className="h-[400px] w-full rounded-md border border-neutral-200 mb-4"
          ></div>
          
          {optimizedRoute.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimized Route</CardTitle>
                <CardDescription>
                  {optimizedRoute.length} stops in optimal order
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[300px]">
                <div className="space-y-2">
                  {optimizedRoute.map((stop) => (
                    <div 
                      key={stop.contact.id} 
                      className="flex items-center p-3 border rounded-md"
                    >
                      <div className="h-8 w-8 bg-primary text-white rounded-full flex items-center justify-center mr-3">
                        {stop.order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{stop.contact.fullName}</div>
                        <div className="text-sm text-neutral-500 truncate">{stop.contact.address}</div>
                        {stop.duration && (
                          <div className="text-xs text-neutral-400">
                            {formatDistance(stop.distance)} - {stop.duration}
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => navigateToAddress(stop.contact.address)}
                        className="ml-2"
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}