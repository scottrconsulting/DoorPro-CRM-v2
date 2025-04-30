import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the tour state type
interface TourState {
  completedTours: Record<string, boolean>;
  currentTour: string | null;
  startTour: (tourName: string) => void;
  endTour: (tourName: string) => void;
  resetTour: (tourName: string) => void;
  resetAllTours: () => void;
}

// Create the context with default values
const TourContext = createContext<TourState>({
  completedTours: {},
  currentTour: null,
  startTour: () => {},
  endTour: () => {},
  resetTour: () => {},
  resetAllTours: () => {},
});

// Define props for the TourProvider component
interface TourProviderProps {
  children: ReactNode;
}

// Storage key for storing completed tours in localStorage
const STORAGE_KEY = 'doorpro-completed-tours';

// Create the Tour Provider component
export const TourProvider = ({ children }: TourProviderProps) => {
  // Load completed tours from localStorage or use empty object if none exists
  const loadCompletedTours = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Error loading completed tours from localStorage:', error);
      return {};
    }
  };

  // Initialize state with loaded tours and no current tour
  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>(loadCompletedTours);
  const [currentTour, setCurrentTour] = useState<string | null>(null);

  // Save completed tours to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedTours));
    } catch (error) {
      console.error('Error saving completed tours to localStorage:', error);
    }
  }, [completedTours]);

  // Start a tour - set it as the current tour
  const startTour = (tourName: string) => {
    setCurrentTour(tourName);
  };

  // End a tour - mark it as completed and clear current tour
  const endTour = (tourName: string) => {
    setCompletedTours((prev) => ({
      ...prev,
      [tourName]: true,
    }));
    if (currentTour === tourName) {
      setCurrentTour(null);
    }
  };

  // Reset a specific tour - mark it as not completed
  const resetTour = (tourName: string) => {
    setCompletedTours((prev) => {
      const newCompletedTours = { ...prev };
      delete newCompletedTours[tourName];
      return newCompletedTours;
    });
  };

  // Reset all tours - clear all completed tours
  const resetAllTours = () => {
    setCompletedTours({});
    setCurrentTour(null);
  };

  // Create the context value with all state and functions
  const value = {
    completedTours,
    currentTour,
    startTour,
    endTour,
    resetTour,
    resetAllTours,
  };

  // Return the provider with the context value
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

// Custom hook for accessing the tour context
export const useTour = () => useContext(TourContext);