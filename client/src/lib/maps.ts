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

// Get user's current location
export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        }
      );
    } else {
      resolve(null);
    }
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
  
  // Create an SVG pin marker with the specified color
  return `data:image/svg+xml;utf-8,
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path fill="${fillColor}" d="M18 0C8.1 0 0 8.1 0 18c0 13.6 18 30 18 30s18-16.4 18-30C36 8.1 27.9 0 18 0z"/>
      <text x="18" y="22" font-family="Arial" font-size="16" font-weight="bold" text-anchor="middle" fill="white">${labelChar}</text>
    </svg>`;
}

// This function returns the icon for a given status using custom SVG markers for accurate colors
export function getMarkerIcon(status: string, pinColors?: Record<string, string>, statusLabels?: Record<string, string>): { url: string; scaledSize: { width: number; height: number } } {
  // Default colors for statuses if no custom color is provided
  const defaultColors: Record<string, string> = {
    converted: "#00c853",           // Green
    interested: "#ffd600",          // Yellow
    appointment_scheduled: "#ff9800", // Orange
    call_back: "#2196f3",           // Blue
    considering: "#9c27b0",         // Purple
    not_interested: "#f44336",      // Red
    not_visited: "#2196f3",         // Blue
    no_soliciting: "#9c27b0"        // Purple
  };
  
  // Determine the color to use
  let color: string;
  
  // First try custom colors from user settings
  if (pinColors && status in pinColors) {
    color = pinColors[status];
  } 
  // Then fall back to default color map
  else if (status in defaultColors) {
    color = defaultColors[status];
  }
  // Last resort fallback
  else {
    color = "#2196f3"; // Default blue
  }
  
  // Get the proper label for this status (for advanced markers with letters)
  const label = statusLabels?.[status] || 
    status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  // For now, we're using standard Google Maps markers due to compatibility issues
  // We'll map any custom color to the closest available Google Maps marker color
  const googleColor = mapHexToGoogleColor(color);
  
  // Standard Google Maps markers with limited colors
  return {
    url: `https://maps.google.com/mapfiles/ms/icons/${googleColor}-dot.png`,
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
