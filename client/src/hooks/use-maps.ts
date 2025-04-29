import { useState, useEffect, useRef, useCallback } from "react";

interface MapOptions {
  apiKey: string;
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
  mapTypeId?: string;
  mapId?: string;
  onLoad?: (map: any) => void;
}

interface UseMapResult {
  mapRef: React.RefObject<HTMLDivElement>;
  map: any | null;
  loading: boolean;
  error: Error | null;
  isLoaded: boolean;
  setMapType: (type: "roadmap" | "satellite" | "hybrid" | "terrain") => void;
  panTo: (position: { lat: number; lng: number }) => void;
  addMarker: (position: { lat: number; lng: number }, options?: any) => any | null;
  clearMarkers: () => void;
  isInStreetView: () => boolean;
  exitStreetView: () => void;
}

export function useGoogleMaps(options: MapOptions): UseMapResult & {
  isInStreetView: () => boolean;
  exitStreetView: () => void;
} {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const streetViewRef = useRef<any>(null);

  // Initialize Google Maps API
  useEffect(() => {
    if (isLoaded) return;

    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        setIsLoaded(true);
        setLoading(false);
        return;
      }

      // Define a callback function that will be called when the API is loaded
      window.initGoogleMaps = () => {
        setIsLoaded(true);
        setLoading(false);
      };
      
      // Create the script element with the recommended loading pattern
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${options.apiKey}&libraries=places,drawing,geometry,marker&callback=initGoogleMaps`;
      script.async = true; // Make sure async is set to true
      
      script.onerror = () => {
        setError(new Error("Failed to load Google Maps API"));
        setLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [options.apiKey, isLoaded]);

  // Initialize map when API is loaded and container is ready
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    try {
      // Include mapId if provided for Advanced Markers support
      const mapOptions: any = {
        center: options.center,
        zoom: options.zoom,
        mapTypeId: options.mapTypeId || google.maps.MapTypeId.ROADMAP,
        fullscreenControl: false,
        streetViewControl: true,
        mapTypeControl: false,
        gestureHandling: 'greedy', // Allow single-finger panning on all devices
      };
      
      // Add mapId if provided (needed for Advanced Markers)
      if (options.mapId) {
        mapOptions.mapId = options.mapId;
      }
      
      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      
      // Store a reference to the StreetViewPanorama for easier access
      streetViewRef.current = newMap.getStreetView();
      
      // Listen for street view status changes
      if (streetViewRef.current) {
        google.maps.event.addListener(streetViewRef.current, 'visible_changed', () => {
          // When street view visibility changes, we can update UI elements if needed
          console.log("Street view visible:", streetViewRef.current.getVisible());
        });
      }

      setMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to initialize map"));
    }
  }, [isLoaded, mapRef, map, options]);

  // Set map type
  const setMapType = useCallback((type: "roadmap" | "satellite" | "hybrid" | "terrain") => {
    if (!map) return;
    
    switch (type) {
      case "satellite":
        map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
        break;
      case "hybrid":
        map.setMapTypeId(google.maps.MapTypeId.HYBRID);
        break;
      case "terrain":
        map.setMapTypeId(google.maps.MapTypeId.TERRAIN);
        break;
      case "roadmap":
      default:
        map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
        break;
    }
  }, [map]);

  // Pan to a location
  const panTo = useCallback((position: { lat: number; lng: number }) => {
    if (!map) return;
    
    map.panTo(position);
  }, [map]);

  // Add a marker to the map - supports both traditional markers and advanced SVG markers
  const addMarker = useCallback((position: { lat: number; lng: number }, options?: any) => {
    if (!map) return null;
    
    // Check if the icon URL is an SVG data URL (custom colored pin)
    const useSvgMarker = options?.icon?.url && 
                         typeof options.icon.url === 'string' && 
                         options.icon.url.startsWith('data:image/svg+xml');
    
    let marker;
    
    // Using standard markers for now due to compatibility issues
    // This simplifies our implementation and avoids potential call stack errors
    marker = new google.maps.Marker({
      position,
      map,
      ...options,
    });
    
    /* Temporarily disabled advanced markers due to compatibility issues
    // Use advanced marker element for SVG markers if available
    if (useSvgMarker && window.google?.maps?.marker?.AdvancedMarkerElement) {
      try {
        // Create an advanced marker with the SVG content
        const svgContent = decodeURIComponent(options.icon.url.split(',')[1]);
        
        // Create a div to hold the SVG content
        const markerDiv = document.createElement('div');
        markerDiv.innerHTML = svgContent;
        markerDiv.style.cursor = 'pointer'; // Make it clickable
        
        // Set up the advanced marker
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position,
          map,
          content: markerDiv,
          title: options.title || '',
        });
        
        // Add custom properties for compatibility with standard markers
        marker.addListener = (event: string, handler: Function) => {
          markerDiv.addEventListener(event, handler);
          return { remove: () => markerDiv.removeEventListener(event, handler) };
        };
        
        marker.setMap = (newMap: any) => {
          // @ts-ignore - property exists on AdvancedMarkerElement
          marker.map = newMap;
        };
        
        console.log('Created SVG Advanced Marker');
      } catch (error) {
        console.error('Failed to create advanced marker, falling back to standard marker', error);
        // Fall back to standard marker if advanced marker creation fails
        marker = new google.maps.Marker({
          position,
          map,
          ...options,
        });
      }
    } else {
      // Use standard marker for non-SVG icons or if advanced markers aren't available
      marker = new google.maps.Marker({
        position,
        map,
        ...options,
      });
    }
    */
    
    markersRef.current.push(marker);
    return marker;
  }, [map]);

  // Clear all markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  }, []);
  
  // Check if the map is currently in street view mode
  const isInStreetView = useCallback(() => {
    if (!map || !streetViewRef.current) return false;
    return streetViewRef.current.getVisible();
  }, [map]);
  
  // Exit street view and return to the map
  const exitStreetView = useCallback(() => {
    if (!map || !streetViewRef.current) return;
    if (streetViewRef.current.getVisible()) {
      streetViewRef.current.setVisible(false);
    }
  }, [map]);

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
    isInStreetView,
    exitStreetView,
  };
}
