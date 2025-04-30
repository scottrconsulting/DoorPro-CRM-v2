import { useEffect, useRef } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useTour } from '@/contexts/tour-context';

interface TourGuideProps {
  steps: Step[];
  tourName: string;
}

const TourGuide = ({ steps, tourName }: TourGuideProps) => {
  const { isTourActive, activeTour, endTour, markTourComplete } = useTour();
  const runTour = isTourActive && activeTour === tourName;
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (runTour && !hasRunRef.current) {
        endTour();
      }
    };
  }, [endTour, runTour]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      hasRunRef.current = true;
      markTourComplete(tourName);
      endTour();
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={runTour}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#6366f1',
          textColor: '#374151',
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
        },
        tooltip: {
          padding: '20px',
          borderRadius: '8px',
        },
        buttonNext: {
          backgroundColor: '#6366f1',
          color: '#ffffff',
          fontSize: '14px',
          padding: '8px 16px',
          borderRadius: '4px',
        },
        buttonBack: {
          marginRight: '8px',
          fontSize: '14px',
          padding: '8px 16px',
          borderRadius: '4px',
        },
        buttonSkip: {
          color: '#6b7280',
          fontSize: '14px',
        },
      }}
    />
  );
};

export default TourGuide;