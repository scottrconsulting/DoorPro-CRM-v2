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
  
  // IMPORTANT: These colors MUST match the legend colors shown in the UI buttons exactly
  // The keys here are status values stored in the database, values are Google marker colors
  const defaultColors: Record<string, string> = {
    converted: "green",             // Green button in legend
    interested: "yellow",           // Yellow button in legend
    appointment_scheduled: "orange", // Orange button in legend
    call_back: "blue",              // Blue button in legend
    considering: "purple",          // Purple when needed
    not_interested: "red",          // Red button in legend
    not_visited: "blue",            // Blue button in legend
    no_soliciting: "purple"         // Purple button in legend
  };
  
  // Default fallback color if no match is found
  let colorName = "blue";
  
  // Check for custom colors from user settings
  if (pinColors && status in pinColors) {
    const customColor = pinColors[status];
    
    // If it's a hex color, map to closest Google color
    if (customColor.startsWith('#')) {
      colorName = mapHexToGoogleColor(customColor);
      console.log(`Mapping hex color ${customColor} for status '${status}' to Google color: ${colorName}`);
    } 
    // Otherwise try to use the color name directly
    else {
      let namedColor = customColor.toLowerCase();
      
      // Handle named colors that aren't in Google's valid colors
      if (!validGoogleColors.includes(namedColor)) {
        const colorMap: Record<string, string> = {
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
        
        colorName = colorMap[namedColor] || "blue";
        console.log(`Mapping named color ${namedColor} for status '${status}' to Google color: ${colorName}`);
      } else {
        colorName = namedColor;
        console.log(`Using direct color name ${colorName} for status '${status}'`);
      }
    }
  }
  // If no custom color defined, fall back to default colors
  else if (status in defaultColors) {
    colorName = defaultColors[status];
    console.log(`Using default color ${colorName} for status '${status}'`);
  }
  
  // Final validation to ensure we're using a valid Google Maps color
  if (!validGoogleColors.includes(colorName)) {
    console.log(`Invalid color ${colorName} for status '${status}', falling back to blue`);
    colorName = "blue"; 
  }
  
  console.log(`Final pin color for status '${status}': ${colorName}`);
  
  return {
    url: `https://maps.google.com/mapfiles/ms/icons/${colorName}-dot.png`,
    scaledSize: { width: 32, height: 32 },
  };
}

// Function to map hex colors to the closest Google Maps marker color
function mapHexToGoogleColor(hexColor: string): string {
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
}
