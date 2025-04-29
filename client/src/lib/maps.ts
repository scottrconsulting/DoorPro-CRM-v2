export interface IGeocodingResult {
  address: string;
  latitude: string;
  longitude: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

// Geocode an address to get coordinates
export async function geocodeAddress(address: string): Promise<IGeocodingResult | null> {
  try {
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results);
        } else {
          resolve(null);
        }
      });
    });

    if (!result) return null;

    const location = result[0].geometry.location;
    let city = "";
    let state = "";
    let zipCode = "";
    
    // Extract address components
    if (result[0].address_components) {
      for (const component of result[0].address_components) {
        // City
        if (component.types.includes("locality")) {
          city = component.long_name;
        }
        // State
        else if (component.types.includes("administrative_area_level_1")) {
          state = component.short_name; // Use short_name for state codes (e.g., CA, NY)
        }
        // Zip code
        else if (component.types.includes("postal_code")) {
          zipCode = component.long_name;
        }
      }
    }
    
    return {
      address: result[0].formatted_address,
      latitude: location.lat().toString(),
      longitude: location.lng().toString(),
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// Store the most recent successful location
let lastKnownLocation: { lat: number; lng: number } | null = null;

// Check if on a mobile device
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Get user's current location with improved location strategy
export async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.log('Geolocation API not available in this browser');
      if (lastKnownLocation) {
        resolve(lastKnownLocation);
      } else {
        reject(new Error('Geolocation not available and no previous location found'));
      }
      return;
    }
    
    // Always request high accuracy for proper real-time tracking
    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // Longer timeout for better location acquisition
      maximumAge: 0 // Always get a fresh reading each time for real-time movement
    };
    
    console.log('Requesting real-time GPS location...');
    
    // Set a timeout for location acquisition
    const timeoutId = setTimeout(() => {
      console.log('Geolocation request timed out');
      if (lastKnownLocation) {
        console.log('Using last known position while trying again');
        resolve(lastKnownLocation);
      } else {
        reject(new Error('Location acquisition timed out and no previous location available'));
      }
    }, 12000);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        
        // Store successful location for future use
        lastKnownLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        console.log('Got precise location:', lastKnownLocation);
        resolve(lastKnownLocation);
      },
      (error) => {
        clearTimeout(timeoutId);
        console.log('Geolocation error:', error.message);
        
        if (error.code === 1) {
          console.log('Location permission denied. Please enable location services in your device settings and browser permissions.');
        } else if (error.code === 2) {
          console.log('Position unavailable. Your device may not have GPS or it failed to acquire position.');
        } else if (error.code === 3) {
          console.log('Location request timed out. Please try again in an area with better GPS reception or WiFi connection.');
        }
        
        // Use the last known location if we have one
        if (lastKnownLocation) {
          console.log('Using last known position while trying to acquire new location');
          resolve(lastKnownLocation);
        } else {
          console.log('No previous location known, cannot determine current position');
          // Reject the promise instead of using a default location
          reject(new Error('Cannot determine location. Please ensure location services are enabled.'));
        }
      },
      options
    );
  });
}

// Calculate distance between two points
export function calculateDistance(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  // Haversine formula
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

// Get optimal route between multiple points
export async function getOptimalRoute(
  origin: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[],
  destination: { lat: number; lng: number }
): Promise<google.maps.DirectionsResult | null> {
  try {
    const directionsService = new google.maps.DirectionsService();
    
    const waypts = waypoints.map(point => ({
      location: new google.maps.LatLng(point.lat, point.lng),
      stopover: true,
    }));

    const result = await new Promise<google.maps.DirectionsResult | null>((resolve, reject) => {
      directionsService.route(
        {
          origin: new google.maps.LatLng(origin.lat, origin.lng),
          destination: new google.maps.LatLng(destination.lat, destination.lng),
          waypoints: waypts,
          optimizeWaypoints: true,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (status === google.maps.DirectionsStatus.OK && response) {
            resolve(response);
          } else {
            resolve(null);
          }
        }
      );
    });

    return result;
  } catch (error) {
    console.error("Routing error:", error);
    return null;
  }
}

// Get marker icon based on contact status
export function getUserAvatarIcon(type: 'male' | 'female'): { url: string; scaledSize: { width: number; height: number } } {
  if (type === 'male') {
    return {
      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
      scaledSize: { width: 40, height: 40 }
    };
  } else {
    return {
      url: "https://maps.google.com/mapfiles/ms/icons/pink-dot.png",
      scaledSize: { width: 40, height: 40 }
    };
  }
}

/**
 * Returns an SVG marker pin with any color
 * @param color The color for the marker (hex, rgb, or color name)
 * @param label Optional label for the marker (first letter will be used)
 */
export function createSvgMarker(color: string, label?: string): string {
  // Ensure color has a valid format
  const fillColor = color.startsWith('#') || color.startsWith('rgb') ? color : `#3b82f6`; // Default to blue if not valid
  const labelChar = label ? label.charAt(0).toUpperCase() : '';
  
  // Determine text color based on background brightness (white or black)
  const isWhiteOrLight = fillColor === '#ffffff' || fillColor === 'white' || 
    (fillColor.startsWith('#') && parseInt(fillColor.slice(1), 16) > 0xcccccc);
  
  const textColor = isWhiteOrLight ? 'black' : 'white';
  
  // Add a stroke for white markers to make them visible against map background
  const strokeAttr = isWhiteOrLight ? 'stroke="#000000" stroke-width="1.5"' : '';
  
  // Create an SVG pin marker with the specified color
  return `data:image/svg+xml;utf-8,
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path fill="${fillColor}" ${strokeAttr} d="M18 0C8.1 0 0 8.1 0 18c0 13.6 18 30 18 30s18-16.4 18-30C36 8.1 27.9 0 18 0z"/>
      <text x="18" y="22" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="${textColor}">${labelChar}</text>
    </svg>`;
}

// This function returns the icon for a given status using Google Maps markers
export function getMarkerIcon(status: string, pinColors?: Record<string, string>, statusLabels?: Record<string, string>): { url: string; scaledSize: { width: number; height: number } } {
  // Default status to color mapping (based on the user's requirements)
  const defaultStatusColors: Record<string, string> = {
    not_interested: "red",
    booked: "blue",           // Booked appointments use blue
    presented: "orange",
    no_answer: "pink",        // No Answer uses pink
    check_back: "yellow",     // Check Back/Follow-up uses yellow
    converted: "green",
    sold: "green",
    unknown: "blue",
    not_visited: "pink",      // For backward compatibility, map not_visited to pink as well
    interested: "yellow",
    appointment_scheduled: "blue", // Match with booked
    call_back: "yellow",      // Match with check_back
    no_soliciting: "purple"
  };
  
  // Get color from customization if available, otherwise use defaults
  let markerColor: string = "blue"; // Default fallback
  
  if (pinColors && status in pinColors) {
    // Only use the color if it's one of the standard Google marker colors
    const customColor = pinColors[status].toLowerCase();
    if (["red", "blue", "green", "yellow", "purple", "orange", "pink"].includes(customColor)) {
      markerColor = customColor;
    }
  } else if (status in defaultStatusColors) {
    markerColor = defaultStatusColors[status];
  }
  
  // Use standard Google Maps markers for maximum compatibility
  return {
    url: `https://maps.google.com/mapfiles/ms/icons/${markerColor}-dot.png`,
    scaledSize: { width: 32, height: 32 },
  };
}

// Function to map hex colors to the closest Google Maps marker color (for fallback)
function mapHexToGoogleColor(hexColor: string): string {
  // If it's already a named color, try to map directly
  if (!hexColor.startsWith('#')) {
    const namedColorMap: Record<string, string> = {
      "red": "red",
      "blue": "blue", 
      "green": "green",
      "yellow": "yellow",
      "purple": "purple",
      "orange": "orange",
      "pink": "pink",
      "teal": "green",
      "lime": "green",
      "aqua": "blue",
      "cyan": "blue",
      "magenta": "purple",
      "violet": "purple",
      "indigo": "purple",
      "amber": "yellow",
      "gold": "yellow",
      "maroon": "red",
      "crimson": "red",
      "salmon": "red",
      "brown": "orange",
      "gray": "purple",
      "grey": "purple"
    };
    
    // Try to find a direct mapping, otherwise fallback
    const mappedColor = namedColorMap[hexColor.toLowerCase()];
    if (mappedColor) return mappedColor;
  }
  
  // Handle hex colors by converting to RGB
  try {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Define Google Maps marker colors in RGB
    const googleColors = {
      "red": [255, 0, 0],
      "blue": [0, 0, 255],
      "green": [0, 128, 0],
      "yellow": [255, 255, 0],
      "purple": [128, 0, 128],
      "orange": [255, 165, 0],
      "pink": [255, 192, 203]
    };
    
    // Find the closest color by Euclidean distance in RGB space
    let closestColor = "blue";
    let minDistance = Number.MAX_VALUE;
    
    for (const [color, rgb] of Object.entries(googleColors)) {
      const distance = Math.sqrt(
        Math.pow(r - rgb[0], 2) + 
        Math.pow(g - rgb[1], 2) + 
        Math.pow(b - rgb[2], 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }
    }
    
    return closestColor;
  } catch (error) {
    console.error("Error parsing color:", error);
    return "blue"; // Fallback color if parsing fails
  }
}
