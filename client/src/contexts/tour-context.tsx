import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface TourContextType {
  isTourActive: boolean;
  activeTour: string | null;
  startTour: (tourName: string) => void;
  endTour: () => void;
  completedTours: Record<string, boolean>;
  markTourComplete: (tourName: string) => void;
  resetTours: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>({});
  const [location] = useLocation();

  // Load tour completion status from localStorage
  useEffect(() => {
    const savedTours = localStorage.getItem('doorpro-completed-tours');
    if (savedTours) {
      try {
        setCompletedTours(JSON.parse(savedTours));
      } catch (error) {
        console.error('Error parsing completed tours:', error);
      }
    }
  }, []);

  // Save tour completion status to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('doorpro-completed-tours', JSON.stringify(completedTours));
  }, [completedTours]);

  // End active tour when navigation happens
  useEffect(() => {
    if (isTourActive) {
      endTour();
    }
  }, [location]);

  const startTour = (tourName: string) => {
    setActiveTour(tourName);
    setIsTourActive(true);
  };

  const endTour = () => {
    setIsTourActive(false);
    setActiveTour(null);
  };

  const markTourComplete = (tourName: string) => {
    setCompletedTours(prev => ({
      ...prev,
      [tourName]: true
    }));
  };

  const resetTours = () => {
    setCompletedTours({});
    localStorage.removeItem('doorpro-completed-tours');
  };

  return (
    <TourContext.Provider 
      value={{ 
        isTourActive, 
        activeTour, 
        startTour, 
        endTour, 
        completedTours, 
        markTourComplete, 
        resetTours 
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}