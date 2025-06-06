import React, { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ContactForm from "@/components/contacts/contact-form";
import { ContactCard } from "@/components/contacts/contact-card";
import { CustomTour } from "@/components/tour/custom-tour";
import { customMapTourSteps } from "@/tours/custom-map-tour-steps";
import { getStatusColor, getStatusLabel } from "@/lib/status-helpers";
import type { Contact, ContactStatus } from "@/shared/schema";

interface MapViewerProps {
  onSelectContact?: (contactId: number) => void;
}

export default function EnhancedMapViewer({ onSelectContact }: MapViewerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Map and UI state
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLegend, setShowLegend] = useState(true);

  // Contact and interaction state
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactCard, setShowContactCard] = useState(false);
  const [isAddingHouse, setIsAddingHouse] = useState(false);
  const [newHouseMarker, setNewHouseMarker] = useState<google.maps.Marker | null>(null);
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newContactCoords, setNewContactCoords] = useState<{lat: number; lng: number} | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  // Location and timing state
  const [userMarker, setUserMarker] = useState<google.maps.Marker | null>(null);
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseUpTime, setMouseUpTime] = useState<number | null>(null);
  const [activeStatus, setActiveStatus] = useState<ContactStatus>("not_visited");
  const [showSchedulingFields, setShowSchedulingFields] = useState(false);

  // Fetch contacts
  const { data: contacts = [], refetch: refetchContacts } = useQuery({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const response = await fetch('/api/contacts', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    }
  });

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        const { Map } = await google.maps.importLibrary("maps") as google.maps.MapsLibrary;

        const mapInstance = new Map(mapRef.current!, {
          zoom: 13,
          center: { lat: 40.7128, lng: -74.0060 }, // Default to NYC
          mapTypeId: mapType,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          gestureHandling: 'greedy'
        });

        setMap(mapInstance);
        setLoading(false);

        // Add click listeners
        mapInstance.addListener('click', handleMapClick);
        mapInstance.addListener('mousedown', (e: google.maps.MapMouseEvent) => {
          setMouseDownTime(Date.now());
        });

        // Try to get user location
        getCurrentLocation(mapInstance);

      } catch (error) {
        console.error('Error initializing map:', error);
        setLoading(false);
      }
    };

    initMap();
  }, [mapType]);

  // Handle map click for adding contacts
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !map) return;

    const clickTime = Date.now();
    const isLongPress = mouseDownTime && (clickTime - mouseDownTime) > 500;

    if (isLongPress || isAddingHouse) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      try {
        // Geocode the coordinates to get address
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: { lat, lng } });

        if (result.results && result.results.length > 0) {
          const address = result.results[0].formatted_address;

          // Open ContactForm directly
          setClickedLocation({ lat, lng, address });
          setIsContactFormOpen(true);
          setIsAddingHouse(false);

          // Clear any existing new house marker
          if (newHouseMarker) {
            newHouseMarker.setMap(null);
          }

        } else {
          toast({
            title: "Address not found",
            description: "Could not find address for this location",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        toast({
          title: "Error",
          description: "Could not get address for this location",
          variant: "destructive"
        });
      }
    }

    setMouseDownTime(null);
    setMouseUpTime(clickTime);
  }, [mouseDownTime, isAddingHouse, map, newHouseMarker, toast]);

  // Handle contact marker click
  const handleContactClick = useCallback((contact: Contact) => {
    if (!isAddingHouse) {
      setSelectedContact(contact);
      setShowContactCard(true);
      if (onSelectContact) {
        onSelectContact(contact.id);
      }
    }
  }, [isAddingHouse, onSelectContact]);

  // Get current location
  const getCurrentLocation = useCallback((mapInstance: google.maps.Map) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          mapInstance.setCenter(pos);

          // Add user location marker
          if (userMarker) {
            userMarker.setMap(null);
          }

          const marker = new google.maps.Marker({
            position: pos,
            map: mapInstance,
            title: "Your Location",
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="%232563eb"%3E%3Ccircle cx="12" cy="12" r="8"/%3E%3C/svg%3E',
              scaledSize: new google.maps.Size(20, 20),
            }
          });

          setUserMarker(marker);
        },
        () => {
          console.log("Location permission denied or unavailable");
        }
      );
    }
  }, [userMarker]);

  // Handle address search
  const handleAddressSearch = useCallback(async () => {
    if (!searchQuery.trim() || !map) return;

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: searchQuery });

      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        map.setCenter(location);
        map.setZoom(16);
      } else {
        toast({
          title: "Address not found",
          description: "Could not find the specified address",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search error",
        description: "Could not search for address",
        variant: "destructive"
      });
    }
  }, [searchQuery, map, toast]);

  // Render contact markers
  useEffect(() => {
    if (!map || !contacts.length) return;

    const markers: google.maps.Marker[] = [];

    contacts.forEach((contact) => {
      if (contact.latitude && contact.longitude) {
        const statusColor = getStatusColor(contact.status as ContactStatus);

        const marker = new google.maps.Marker({
          position: { lat: contact.latitude, lng: contact.longitude },
          map,
          title: contact.name,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${encodeURIComponent(statusColor.replace('bg-', '').replace('-500', ''))}"%3E%3Cpath d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/%3E%3C/svg%3E`,
            scaledSize: new google.maps.Size(24, 24),
          }
        });

        marker.addListener('click', () => handleContactClick(contact));
        markers.push(marker);
      }
    });

    return () => {
      markers.forEach(marker => marker.setMap(null));
    };
  }, [map, contacts, handleContactClick]);

  // Handle My Location button
  const handleMyLocationClick = useCallback(() => {
    if (map) {
      getCurrentLocation(map);
    }
  }, [map, getCurrentLocation]);

  

  return (
    <div className="relative w-full h-full">
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

      {/* Control Panel - Right Side */}
      <div className="absolute top-14 right-4 flex flex-col gap-2 z-10">
        <div className="bg-white p-2 rounded-lg shadow-lg flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMyLocationClick}
          >
            My Location
          </Button>

          <Button
            variant={isAddingHouse ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAddingHouse(!isAddingHouse)}
          >
            {isAddingHouse ? "Cancel Add" : "Add Contact"}
          </Button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-10 max-w-xs">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm">Contact Status</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLegend(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          <div className="space-y-1 text-xs">
            {(['not_visited', 'no_answer', 'presented', 'scheduled', 'sold'] as ContactStatus[]).map((status) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                <span>{getStatusLabel(status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">Loading map...</p>
          </div>
        </div>
      )}

      {/* Contact Form for adding new contacts */}
      <ContactForm
        isOpen={isContactFormOpen}
        onClose={() => {
          setIsContactFormOpen(false);
          setClickedLocation(null);
        }}
        onSuccess={(newContact) => {
          setIsContactFormOpen(false);
          setClickedLocation(null);
          setIsAddingHouse(false);
          queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
        }}
        initialContact={clickedLocation ? {
          address: clickedLocation.address || `${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)}`,
          latitude: clickedLocation.lat.toString(),
          longitude: clickedLocation.lng.toString(),
        } : undefined}
      />

      {/* Contact Card for viewing/editing existing contacts */}
      {selectedContact && (
        <ContactCard
          contactId={selectedContact.id}
          isOpen={showContactCard}
          onClose={() => {
            setShowContactCard(false);
            setSelectedContact(null);
          }}
        />
      )}

      {/* Custom Map Tour */}
      <CustomTour 
        steps={customMapTourSteps} 
        tourName="map" 
      />
    </div>
  );
}