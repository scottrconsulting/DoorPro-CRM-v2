import { useEffect, useState, useMemo, useCallback } from "react";
import { useGoogleMaps } from "@/hooks/use-maps";
import { geocodeAddress, getMarkerIcon, getCurrentLocation } from "@/lib/maps";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "your-api-key";

interface MapViewerProps {
  onSelectContact?: (contactId: number) => void;
}

export default function MapViewer({ onSelectContact }: MapViewerProps) {
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  
  // Fetch contacts
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Initialize map with default location (US center)
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

  return (
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
        </div>
      </div>
      
      <div className="map-container relative">
        <div ref={mapRef} className="w-full h-full" />
        
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
          <div className="flex items-center text-xs">
            <span className="inline-block w-3 h-3 rounded-full bg-success mr-1"></span>
            <span className="text-neutral-600">Converted</span>
          </div>
          <div className="flex items-center text-xs">
            <span className="inline-block w-3 h-3 rounded-full bg-warning mr-1"></span>
            <span className="text-neutral-600">Follow up</span>
          </div>
          <div className="flex items-center text-xs">
            <span className="inline-block w-3 h-3 rounded-full bg-error mr-1"></span>
            <span className="text-neutral-600">Not interested</span>
          </div>
          <div className="flex items-center text-xs">
            <span className="inline-block w-3 h-3 rounded-full bg-primary mr-1"></span>
            <span className="text-neutral-600">Not visited</span>
          </div>
        </div>
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
  );
}
