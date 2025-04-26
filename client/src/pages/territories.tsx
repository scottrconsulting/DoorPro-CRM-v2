import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Territory, InsertTerritory } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useGoogleMaps } from "@/hooks/use-maps";
import { UserRole, hasPlanAccess, FREE_PLAN_LIMITS } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "your-api-key";

export default function Territories() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [newTerritoryName, setNewTerritoryName] = useState("");
  const [newTerritoryDescription, setNewTerritoryDescription] = useState("");
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);

  // Get territories list
  const { data: territories = [], isLoading } = useQuery<Territory[]>({
    queryKey: ["/api/territories"],
  });

  // Initialize map
  const {
    mapRef,
    map,
    isLoaded,
    loading: mapLoading,
    panTo,
  } = useGoogleMaps(GOOGLE_MAPS_API_KEY, {
    center: { lat: 39.8283, lng: -98.5795 },
    zoom: 5,
  });

  // Drawing and polygons
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const [polygons, setPolygons] = useState<google.maps.Polygon[]>([]);

  // Create territory mutation
  const createTerritoryMutation = useMutation({
    mutationFn: async (territory: InsertTerritory) => {
      const res = await apiRequest("POST", "/api/territories", territory);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/territories"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Territory created",
        description: "Your territory was successfully created",
      });
      setNewTerritoryName("");
      setNewTerritoryDescription("");
      setDrawingPoints([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to create territory",
        description: "There was an error creating your territory",
        variant: "destructive",
      });
    },
  });

  // Update territory mutation
  const updateTerritoryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Territory> }) => {
      const res = await apiRequest("PUT", `/api/territories/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/territories"] });
      setSelectedTerritory(null);
      toast({
        title: "Territory updated",
        description: "Your territory was successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update territory",
        description: "There was an error updating your territory",
        variant: "destructive",
      });
    },
  });

  // Delete territory mutation
  const deleteTerritoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/territories/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/territories"] });
      setSelectedTerritory(null);
      toast({
        title: "Territory deleted",
        description: "Your territory was successfully deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete territory",
        description: "There was an error deleting your territory",
        variant: "destructive",
      });
    },
  });

  // Setup drawing manager when map is loaded
  useEffect(() => {
    if (!isLoaded || !map) return;

    if (window.google.maps.drawing) {
      const manager = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
          fillColor: "#3B82F6",
          fillOpacity: 0.3,
          strokeColor: "#2563EB",
          strokeWeight: 2,
          editable: true,
          zIndex: 1,
        },
      });

      manager.setMap(map);
      setDrawingManager(manager);

      // Listen for polygon complete
      google.maps.event.addListener(manager, 'polygoncomplete', function(polygon) {
        const points = polygon.getPath().getArray().map(point => ({
          lat: point.lat(),
          lng: point.lng(),
        }));
        setDrawingPoints(points);
        setDrawingMode(false);
        manager.setDrawingMode(null);
        
        setPolygons(prev => [...prev, polygon]);
      });
    }

    return () => {
      if (drawingManager) {
        drawingManager.setMap(null);
      }
    };
  }, [map, isLoaded]);

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    if (!drawingManager) return;
    
    if (drawingMode) {
      drawingManager.setDrawingMode(null);
    } else {
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    }
    
    setDrawingMode(!drawingMode);
  };

  // Clear all drawings
  const clearDrawings = () => {
    polygons.forEach(polygon => polygon.setMap(null));
    setPolygons([]);
    setDrawingPoints([]);
  };

  // Show territory on map
  const showTerritoryOnMap = (territory: Territory) => {
    setSelectedTerritory(territory);
    
    if (!map || !territory.coordinates || !territory.coordinates.length) return;
    
    clearDrawings();
    
    const bounds = new google.maps.LatLngBounds();
    const polygonPath = territory.coordinates.map(coord => {
      bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      return new google.maps.LatLng(coord.lat, coord.lng);
    });
    
    const polygon = new google.maps.Polygon({
      paths: polygonPath,
      fillColor: "#3B82F6",
      fillOpacity: 0.3,
      strokeColor: "#2563EB",
      strokeWeight: 2,
      editable: false,
      map: map,
    });
    
    setPolygons([polygon]);
    map.fitBounds(bounds);
  };

  // Create territory
  const handleCreateTerritory = () => {
    if (!newTerritoryName.trim()) {
      toast({
        title: "Territory name required",
        description: "Please enter a name for your territory",
        variant: "destructive",
      });
      return;
    }

    if (drawingPoints.length < 3) {
      toast({
        title: "Define territory area",
        description: "Please draw your territory on the map first",
        variant: "destructive",
      });
      return;
    }

    createTerritoryMutation.mutate({
      userId: user?.id || 0,
      name: newTerritoryName,
      description: newTerritoryDescription,
      coordinates: drawingPoints,
      coverage: 0,
    });
  };

  // Check if user is at territory limit
  const isAtTerritoryLimit = user?.role === UserRole.FREE && territories.length >= FREE_PLAN_LIMITS.territories;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-neutral-800">Territories</h1>
          <p className="text-neutral-500">Manage your sales territories and coverage</p>
        </div>
        <div className="mt-4 md:mt-0">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isAtTerritoryLimit}
            className="flex items-center"
          >
            <span className="material-icons text-sm mr-1">add</span>
            Create Territory
          </Button>
          {isAtTerritoryLimit && (
            <p className="text-xs text-red-500 mt-1">
              Free plan limited to {FREE_PLAN_LIMITS.territories} territory. Please upgrade to Pro.
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : territories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <span className="material-icons text-6xl text-neutral-300 mb-4">map</span>
            <h3 className="text-xl font-medium text-neutral-700 mb-2">No Territories</h3>
            <p className="text-neutral-500 mb-6 text-center max-w-md">
              Create a territory to start organizing your door-to-door sales areas and track your coverage.
            </p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isAtTerritoryLimit}
            >
              <span className="material-icons mr-2">add_location</span>
              Create Your First Territory
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((territory) => (
            <Card key={territory.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{territory.name}</CardTitle>
                  <button 
                    onClick={() => showTerritoryOnMap(territory)}
                    className="p-1 rounded hover:bg-neutral-100"
                  >
                    <span className="material-icons text-neutral-600">visibility</span>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {territory.description && (
                  <p className="text-neutral-600 text-sm mb-3">{territory.description}</p>
                )}
                <div className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Coverage</span>
                    <span className="font-medium">{territory.coverage || 0}%</span>
                  </div>
                  <Progress value={territory.coverage || 0} className="h-2 mt-1" />
                </div>
                <div className="flex justify-end mt-4 space-x-2">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this territory?")) {
                        deleteTerritoryMutation.mutate(territory.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Territory Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create New Territory</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="territory-name">Territory Name</Label>
                  <Input
                    id="territory-name"
                    value={newTerritoryName}
                    onChange={(e) => setNewTerritoryName(e.target.value)}
                    placeholder="e.g., North Seattle"
                  />
                </div>
                
                <div>
                  <Label htmlFor="territory-description">Description</Label>
                  <Textarea
                    id="territory-description"
                    value={newTerritoryDescription}
                    onChange={(e) => setNewTerritoryDescription(e.target.value)}
                    placeholder="Optional description of this territory"
                    rows={4}
                  />
                </div>
                
                <div>
                  <Label>Territory Drawing</Label>
                  <div className="flex space-x-2 mt-2">
                    <Button
                      type="button"
                      onClick={toggleDrawingMode}
                      variant={drawingMode ? "default" : "outline"}
                      className="flex-1"
                    >
                      {drawingMode ? "Drawing..." : "Draw on Map"}
                    </Button>
                    <Button
                      type="button"
                      onClick={clearDrawings}
                      variant="outline"
                      disabled={drawingPoints.length === 0}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  {drawingPoints.length > 0 && (
                    <div className="mt-2 text-xs text-neutral-500">
                      Territory area defined with {drawingPoints.length} points
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 h-[400px] rounded-md overflow-hidden border">
              <div ref={mapRef} className="w-full h-full" />
              {mapLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTerritory}
              disabled={createTerritoryMutation.isPending}
            >
              {createTerritoryMutation.isPending ? "Creating..." : "Create Territory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
