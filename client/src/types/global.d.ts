// Add global type declarations for window object extensions

interface Window {
  google: any;
  initGoogleMaps?: () => void;
  initDrawingManager?: () => void;
}