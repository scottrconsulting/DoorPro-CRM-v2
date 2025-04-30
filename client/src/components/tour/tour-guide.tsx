import { useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { useTour } from '@/contexts/tour-context';

interface TourGuideProps {
  steps: Step[];
  tourName: string;
}

const TourGuide = ({ steps, tourName }: TourGuideProps) => {
  const { currentTour, endTour } = useTour();
  
  // Handle tour callbacks to respond to tour events
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    
    // Check if the tour has been completed or skipped
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      // Mark the tour as completed when user finishes or skips
      endTour(tourName);
    }
    
    // For debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Joyride callback:', type, status, data);
    }
  };
  
  return (
    <Joyride
      steps={steps}
      run={currentTour === tourName}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#0554f8', // Primary blue color to match theme
          textColor: '#4b5563',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
          zIndex: 10000,
        },
        spotlight: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        buttonBack: {
          marginRight: 10,
        },
        buttonSkip: {
          color: '#6b7280',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
};

export default TourGuide;