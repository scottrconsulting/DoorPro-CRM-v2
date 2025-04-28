import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';

// Define how often to update the "last active" time (in milliseconds)
const ACTIVITY_UPDATE_INTERVAL = 60000; // 1 minute

// Define inactivity threshold (in milliseconds)
const INACTIVITY_THRESHOLD = 5 * 60000; // 5 minutes

export function useOnlineStatus() {
  const { user } = useAuth();
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [isActive, setIsActive] = useState(true);
  
  // Update user's online status on mount and when activity state changes
  useEffect(() => {
    if (!user) return;
    
    const updateOnlineStatus = async (status: boolean) => {
      try {
        await apiRequest("POST", "/api/profile/online-status", { isOnline: status });
      } catch (error) {
        console.error("Failed to update online status:", error);
      }
    };

    // Update status when component mounts and when active state changes
    updateOnlineStatus(isActive);
    
    // Cleanup: set offline when component unmounts
    return () => {
      updateOnlineStatus(false);
    };
  }, [user, isActive]);
  
  // Periodically update last active timestamp while user is active
  useEffect(() => {
    if (!user || !isActive) return;
    
    const updateLastActive = async () => {
      try {
        await apiRequest("POST", "/api/profile/last-active", {});
        setLastActivity(new Date());
      } catch (error) {
        console.error("Failed to update last active time:", error);
      }
    };
    
    // Update immediately on mount
    updateLastActive();
    
    // Set up interval for periodic updates
    const interval = setInterval(updateLastActive, ACTIVITY_UPDATE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [user, isActive]);
  
  // Monitor user activity
  useEffect(() => {
    if (!user) return;
    
    const resetInactivityTimer = () => {
      setLastActivity(new Date());
      if (!isActive) {
        setIsActive(true);
      }
    };
    
    // Check for inactivity
    const checkActivity = () => {
      const now = new Date();
      const timeSinceLastActivity = now.getTime() - lastActivity.getTime();
      
      if (timeSinceLastActivity > INACTIVITY_THRESHOLD) {
        setIsActive(false);
      }
    };
    
    // Set up activity monitoring
    const activityInterval = setInterval(checkActivity, 30000); // Check every 30 seconds
    
    // Event listeners for user activity
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'mousemove'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });
    
    // Cleanup event listeners
    return () => {
      clearInterval(activityInterval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [user, lastActivity, isActive]);
  
  return { isActive, lastActivity };
}