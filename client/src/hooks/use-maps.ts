import { useState, useEffect, useRef, useCallback } from "react";

interface MapOptions {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  mapTypeId?: google.maps.MapTypeId;
}

interface UseMapResult {
  mapRef: React.RefObject<HTMLDivElement>;
  map: google.maps.Map | null;
  loading: boolean;
  error: Error | null;
  isLoaded: boolean;
  setMapType: (type: "roadmap" | "satellite") => void;
  panTo: (position: { lat: number; lng: number }) => void;
  addMarker: (position: { lat: number; lng: number }, options?: any) => google.maps.Marker | null;
  clearMarkers: () => void;
}

export function useGoogleMaps(apiKey: string, options: MapOptions): UseMapResult {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Initialize Google Maps API
  useEffect(() => {
    if (isLoaded) return;

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsLoaded(true);
        setLoading(false);
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoaded(true);
        setLoading(false);
      };

      script.onerror = () => {
        setError(new Error("Failed to load Google Maps API"));
        setLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [apiKey, isLoaded]);

  // Initialize map when API is loaded and container is ready
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    try {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: options.center,
        zoom: options.zoom,
        mapTypeId: options.mapTypeId || google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: true,
        mapTypeControl: false,
      });

      setMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to initialize map"));
    }
  }, [isLoaded, mapRef, map, options]);

  // Set map type
  const setMapType = useCallback((type: "roadmap" | "satellite") => {
    if (!map) return;
    
    map.setMapTypeId(
      type === "satellite" ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP
    );
  }, [map]);

  // Pan to a location
  const panTo = useCallback((position: { lat: number; lng: number }) => {
    if (!map) return;
    
    map.panTo(position);
  }, [map]);

  // Add a marker to the map
  const addMarker = useCallback((position: { lat: number; lng: number }, options?: any) => {
    if (!map) return null;
    
    const marker = new google.maps.Marker({
      position,
      map,
      ...options,
    });
    
    markersRef.current.push(marker);
    return marker;
  }, [map]);

  // Clear all markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  }, []);

  return {
    mapRef,
    map,
    loading,
    error,
    isLoaded,
    setMapType,
    panTo,
    addMarker,
    clearMarkers,
  };
}
