import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, Footprints, Play, Square, RotateCcw } from 'lucide-react';
import activityTracker from '@/services/activity-tracker';
import { Contact } from '@shared/schema';

interface ActivityReport {
  isActive: boolean;
  activeTimeHours: number;
  activeTimeMinutes: number;
  activeTimeSeconds: number;
  formattedTime: string;
  nearbyContactIds: number[];
}

export function ActivityTrackerWidget() {
  const [activityReport, setActivityReport] = useState<ActivityReport>({
    isActive: false,
    activeTimeHours: 0,
    activeTimeMinutes: 0,
    activeTimeSeconds: 0,
    formattedTime: '00:00:00',
    nearbyContactIds: []
  });

  // Fetch contacts to initialize the activity tracker
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    refetchInterval: 60000, // Refetch every minute to get new contacts
  });

  // Update activity tracker when contacts change
  useEffect(() => {
    if (contacts) {
      activityTracker.updateContacts(contacts);
    }
  }, [contacts]);

  // Initialize activity tracker and set up listener
  useEffect(() => {
    // Initialize with empty array, will be updated when contacts are loaded
    activityTracker.initialize([]);

    // Set up listener for activity updates
    const handleActivityUpdate = (report: ActivityReport) => {
      setActivityReport(report);
    };

    // Register listener
    activityTracker.addListener(handleActivityUpdate);

    // Clean up on unmount
    return () => {
      activityTracker.removeListener(handleActivityUpdate);
      activityTracker.cleanup();
    };
  }, []);

  // Handle manual reset
  const handleReset = () => {
    activityTracker.resetActivityTime();
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center">
          <Footprints className="w-5 h-5 mr-2" /> 
          Door-Knocking Activity
          {activityReport.isActive && (
            <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-300">
              Active
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Time spent near contact pins (0.10 mile radius)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="text-4xl font-bold tracking-wider flex items-center">
            <Clock className="mr-3 h-6 w-6 text-primary" />
            <span>{activityReport.formattedTime}</span>
          </div>
        </div>
        
        <div className="mt-2">
          <div className="flex justify-between mb-1">
            <span className="text-sm">Status:</span>
            <span className={`text-sm font-medium ${activityReport.isActive ? 'text-green-600' : 'text-gray-500'}`}>
              {activityReport.isActive ? 'Tracking Time' : 'Not Tracking'}
            </span>
          </div>
          
          <div className="flex justify-between mb-1">
            <span className="text-sm">Nearby Contacts:</span>
            <span className="text-sm font-medium">
              {activityReport.nearbyContactIds.length}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-1">
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleReset}
          className="text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" /> Reset Timer
        </Button>
        
        <div className="flex items-center text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 mr-1" /> 
          <span>0.10 mile radius</span>
        </div>
      </CardFooter>
    </Card>
  );
}