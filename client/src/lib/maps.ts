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

// This function returns the icon for a given status, fixing color consistency issues
export function getMarkerIcon(status: string, pinColors?: Record<string, string>): { url: string; scaledSize: { width: number; height: number } } {
  // Google Maps only supports these specific colors for its marker icons
  const validGoogleColors = ["red", "blue", "green", "yellow", "purple", "orange", "pink"];
  
  // Fixed color mappings - These MUST match the legend colors in the UI (enhanced-map-viewer.tsx)
  // Updated based on user feedback to fix color mismatches
  const defaultColors: Record<string, string> = {
    converted: "green",   // Green in legend
    interested: "yellow", // Yellow in legend
    appointment_scheduled: "orange",
    call_back: "blue",    // Blue in legend
    considering: "purple",
    not_interested: "red", // Red in legend
    not_visited: "blue",   // Blue in legend
    no_soliciting: "purple" // Purple in legend
  };
  
  // Get color from pin customization if available, otherwise use default
  let colorName = "blue"; // Default fallback
  
  // First check for customized colors
  if (pinColors && pinColors[status]) {
    colorName = pinColors[status].toLowerCase();
  } 
  // Otherwise use our predetermined defaults
  else if (defaultColors[status]) {
    colorName = defaultColors[status];
  }
  
  // Ensure we're using a valid Google Maps color
  if (!validGoogleColors.includes(colorName)) {
    // Map to closest available color if not a valid Google marker color
    const colorMap: Record<string, string> = {
      // Common color names mapped to Google's limited palette
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
      "salmon": "red"
    };
    
    colorName = colorMap[colorName] || "blue"; // Default to blue if no match
  }
  
  // Ensure the color is one of the valid Google marker colors
  if (!validGoogleColors.includes(colorName)) {
    colorName = "blue"; // Final safety fallback
  }
  
  return {
    url: `https://maps.google.com/mapfiles/ms/icons/${colorName}-dot.png`,
    scaledSize: { width: 32, height: 32 },
  };
}
