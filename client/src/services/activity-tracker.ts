// Activity Tracker Service
// Tracks user proximity to contact pins and calculates active door-knocking time

import { Contact } from '@shared/schema';

// Maximum distance in miles to consider a user "actively working" near contacts
const MAX_PROXIMITY_DISTANCE = 0.10; // 0.10 miles = approximately 160 meters

// Millisecond conversion constants
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

interface ActivityState {
  isActive: boolean;         // Whether user is currently active near pins
  activeStartTime: number | null; // Timestamp when activity started
  totalActiveTime: number;   // Total accumulated active time in milliseconds
  lastLocation: { lat: number; lng: number } | null; // Last known user location
  nearbyContactIds: number[]; // IDs of contacts currently near user
}

interface ActivityReport {
  isActive: boolean;
  activeTimeHours: number;
  activeTimeMinutes: number;
  activeTimeSeconds: number;
  formattedTime: string;
  nearbyContactIds: number[];
}

class ActivityTracker {
  private state: ActivityState;
  private contacts: Contact[] = [];
  private locationUpdateInterval: NodeJS.Timeout | null = null;
  private listeners: Array<(report: ActivityReport) => void> = [];

  constructor() {
    this.state = {
      isActive: false,
      activeStartTime: null,
      totalActiveTime: 0,
      lastLocation: null,
      nearbyContactIds: []
    };
  }

  // Initialize the activity tracker with contacts
  public initialize(contacts: Contact[]): void {
    this.contacts = contacts;
    console.log('Activity tracker initialized with', contacts.length, 'contacts');
    
    // Start location updates
    if (!this.locationUpdateInterval) {
      this.locationUpdateInterval = setInterval(() => this.updateLocation(), 60000); // Every 60 seconds
      // Do an immediate update
      this.updateLocation();
    }
  }

  // Update contacts when they change
  public updateContacts(contacts: Contact[]): void {
    this.contacts = contacts;
    console.log('Activity tracker contacts updated with', contacts.length, 'contacts');
    
    // Check if we need to update active status with new contacts
    if (this.state.lastLocation) {
      this.checkProximityToContacts(this.state.lastLocation);
    }
  }

  // Get the current user location and update activity status
  private async updateLocation(): Promise<void> {
    try {
      // Get current position using browser geolocation
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          console.log('Activity tracker: Got user location', currentLocation);
          this.state.lastLocation = currentLocation;
          
          // Check proximity to contacts
          this.checkProximityToContacts(currentLocation);
        },
        (error) => {
          console.error('Activity tracker: Error getting location', error);
        },
        { 
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (error) {
      console.error('Activity tracker: Failed to update location', error);
    }
  }

  // Calculate distance between two points in miles using Haversine formula
  private calculateDistance(
    lat1: number, lon1: number, 
    lat2: number, lon2: number
  ): number {
    // Radius of the Earth in miles
    const earthRadius = 3959; 
    
    // Convert latitude and longitude from degrees to radians
    const latRad1 = this.toRadians(lat1);
    const lonRad1 = this.toRadians(lon1);
    const latRad2 = this.toRadians(lat2);
    const lonRad2 = this.toRadians(lon2);
    
    // Difference in coordinates
    const dLat = latRad2 - latRad1;
    const dLon = lonRad2 - lonRad1;
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latRad1) * Math.cos(latRad2) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;
    
    return distance;
  }
  
  // Convert degrees to radians
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Check if user is near any contacts and update active status
  private checkProximityToContacts(location: { lat: number; lng: number }): void {
    const nearbyContactIds: number[] = [];
    
    // Filter contacts with valid coordinates
    const validContacts = this.contacts.filter(
      contact => contact.latitude && contact.longitude
    );
    
    // Check distance to each contact
    for (const contact of validContacts) {
      // Skip contacts without coordinates
      if (!contact.latitude || !contact.longitude) continue;
      
      const contactLat = parseFloat(contact.latitude);
      const contactLng = parseFloat(contact.longitude);
      
      // Calculate distance
      const distance = this.calculateDistance(
        location.lat, location.lng,
        contactLat, contactLng
      );
      
      // Check if within proximity threshold
      if (distance <= MAX_PROXIMITY_DISTANCE) {
        nearbyContactIds.push(contact.id);
      }
    }
    
    // Update nearby contacts
    this.state.nearbyContactIds = nearbyContactIds;
    
    // Determine if we should start/stop tracking
    const wasActive = this.state.isActive;
    const isNowActive = nearbyContactIds.length > 0;
    
    // State transitions
    if (!wasActive && isNowActive) {
      // Transition: Inactive -> Active
      this.startActivityTimer();
    } else if (wasActive && !isNowActive) {
      // Transition: Active -> Inactive
      this.stopActivityTimer();
    }
    
    // Notify listeners of state change
    this.notifyListeners();
  }

  // Start tracking active time
  private startActivityTimer(): void {
    if (!this.state.isActive) {
      console.log('Activity tracker: Starting activity timer');
      this.state.isActive = true;
      this.state.activeStartTime = Date.now();
      this.notifyListeners();
    }
  }

  // Stop tracking active time and accumulate
  private stopActivityTimer(): void {
    if (this.state.isActive && this.state.activeStartTime !== null) {
      console.log('Activity tracker: Stopping activity timer');
      const now = Date.now();
      const elapsedTime = now - this.state.activeStartTime;
      
      // Add to total time
      this.state.totalActiveTime += elapsedTime;
      
      // Reset active state
      this.state.isActive = false;
      this.state.activeStartTime = null;
      this.notifyListeners();
    }
  }

  // Reset timer and accumulated time
  public resetActivityTime(): void {
    console.log('Activity tracker: Resetting activity time');
    
    // If currently active, stop first
    if (this.state.isActive) {
      this.stopActivityTimer();
    }
    
    // Reset accumulated time
    this.state.totalActiveTime = 0;
    this.notifyListeners();
  }

  // Get current activity report
  public getActivityReport(): ActivityReport {
    // Calculate current active time
    let totalMs = this.state.totalActiveTime;
    
    // Add current session if active
    if (this.state.isActive && this.state.activeStartTime !== null) {
      const now = Date.now();
      totalMs += (now - this.state.activeStartTime);
    }
    
    // Convert to hours, minutes, seconds
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Format time string (HH:MM:SS)
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return {
      isActive: this.state.isActive,
      activeTimeHours: hours,
      activeTimeMinutes: minutes,
      activeTimeSeconds: seconds,
      formattedTime,
      nearbyContactIds: [...this.state.nearbyContactIds]
    };
  }

  // Add an event listener for activity updates
  public addListener(callback: (report: ActivityReport) => void): void {
    this.listeners.push(callback);
  }

  // Remove an event listener
  public removeListener(callback: (report: ActivityReport) => void): void {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  // Notify all listeners of state changes
  private notifyListeners(): void {
    const report = this.getActivityReport();
    this.listeners.forEach(listener => listener(report));
  }

  // Cleanup when component unmounts
  public cleanup(): void {
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval);
      this.locationUpdateInterval = null;
    }
    
    // Stop activity if active
    if (this.state.isActive) {
      this.stopActivityTimer();
    }
    
    // Clear listeners
    this.listeners = [];
  }
}

// Create singleton instance
const activityTracker = new ActivityTracker();

export default activityTracker;