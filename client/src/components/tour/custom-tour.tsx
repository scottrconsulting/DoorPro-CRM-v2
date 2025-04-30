import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTour } from '@/contexts/tour-context';

export interface TourStep {
  title: string;
  content: React.ReactNode;
  image?: string;
}

interface CustomTourProps {
  steps: TourStep[];
  tourName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CustomTour: React.FC<CustomTourProps> = ({ steps, tourName, isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { endTour } = useTour();
  
  // Reset step counter when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);
  
  // Complete the tour when all steps are done or when manually closed
  const completeTour = () => {
    endTour(tourName);
    onClose();
  };

  // Move to next step or complete tour if at the end
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };
  
  // Move to previous step
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  // Skip the tour
  const handleSkip = () => {
    completeTour();
  };
  
  // Current step details
  const step = steps[currentStep];
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && completeTour()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{step?.title}</DialogTitle>
          <DialogDescription className="text-right text-sm text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {/* Tour content */}
          <div className="text-base">{step?.content}</div>
          
          {/* Optional image */}
          {step?.image && (
            <div className="mt-4">
              <img 
                src={step.image} 
                alt={`Illustration for ${step.title}`} 
                className="w-full rounded-md border border-gray-200"
              />
            </div>
          )}
        </div>
        
        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          
          <div>
            <Button variant="ghost" onClick={handleSkip} className="mr-2">
              Skip Tour
            </Button>
            <Button onClick={handleNext}>
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomTour;