import { useState, useEffect, useCallback } from 'react';

// Custom hook for long press gesture
export function useLongPress(callback: () => void, ms = 1000) {
  const [pressing, setPressing] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);

  // Set up timer when press starts
  const start = useCallback(() => {
    setPressing(true);
    setLongPressTriggered(false);
    
    // Use window.setTimeout to get a number for the timer ID
    const timerId = window.setTimeout(() => {
      setPressing(false);
      setLongPressTriggered(true);
      callback();
    }, ms);
    
    setTimer(timerId);
  }, [callback, ms]);

  // Clear timer when press ends
  const stop = useCallback(() => {
    setPressing(false);
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }
  }, [timer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [timer]);

  return {
    // These handlers can be spread on any element to add long press functionality
    handlers: {
      onMouseDown: start,
      onMouseUp: stop,
      onMouseLeave: stop,
      onTouchStart: start,
      onTouchEnd: stop,
    },
    pressing, // True while the user is pressing
    longPressTriggered, // True after a long press was triggered
  };
}