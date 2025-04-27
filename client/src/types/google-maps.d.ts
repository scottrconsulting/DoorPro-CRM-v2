// Type declaration file for Google Maps Drawing library
// This is needed because the @types/google.maps package doesn't include the drawing library by default

declare namespace google.maps {
  namespace drawing {
    class DrawingManager extends google.maps.MVCObject {
      constructor(options?: DrawingManagerOptions);
      setMap(map: google.maps.Map | null): void;
      setOptions(options: DrawingManagerOptions): void;
      setDrawingMode(drawingMode: OverlayType | null): void;
    }

    interface DrawingManagerOptions {
      drawingMode?: OverlayType | null;
      drawingControl?: boolean;
      drawingControlOptions?: DrawingControlOptions;
      circleOptions?: CircleOptions;
      markerOptions?: MarkerOptions;
      polygonOptions?: PolygonOptions;
      polylineOptions?: PolylineOptions;
      rectangleOptions?: RectangleOptions;
    }

    interface DrawingControlOptions {
      position?: google.maps.ControlPosition;
      drawingModes?: OverlayType[];
    }

    enum OverlayType {
      CIRCLE = 'circle',
      MARKER = 'marker',
      POLYGON = 'polygon',
      POLYLINE = 'polyline',
      RECTANGLE = 'rectangle'
    }
  }

  // Add Polygon type which is missing in some TypeScript declarations
  class Polygon {
    constructor(options?: PolygonOptions);
    getPath(): MVCArray<LatLng>;
    setMap(map: Map | null): void;
    setOptions(options: PolygonOptions): void;
    setPath(path: MVCArray<LatLng> | LatLng[] | LatLngLiteral[]): void;
  }
}

// Add initDrawingManager to Window interface
interface Window {
  initDrawingManager?: () => void;
}