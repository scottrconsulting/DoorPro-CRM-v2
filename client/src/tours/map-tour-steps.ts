import { Step } from 'react-joyride';

// Map-specific tour steps
export const mapTourSteps: Step[] = [
  // Step 1: Introduction
  {
    target: 'body',
    content: 'Welcome to the Interactive Map! This tour will help you learn how to use the map features effectively.',
    placement: 'center',
    disableBeacon: true,
    title: 'Map Feature Tour',
  },
  
  // Step 2: My Location button - Using simplified selector
  {
    target: 'button.location-button',
    content: 'Click this button to locate your current position on the map. Your location will be shown as a blue dot, and the map will automatically center on your position.',
    placement: 'bottom',
    title: 'My Location',
  },
  
  // Step 3: Search functionality - Using simplified selector
  {
    target: 'input[placeholder="Search for an address..."]',
    content: 'Use this search box to find addresses. Enter an address and press Enter to search, then you can add it as a new contact.',
    placement: 'bottom',
    title: 'Address Search',
  },
  
  // Step 4: Map controls - Using class-based selector
  {
    target: '.map-controls button:first-child',
    content: 'These controls let you switch between map views: Map (default street view), Satellite (aerial photos), Hybrid (combination), or Terrain (topographical features).',
    placement: 'right',
    title: 'Map Type Controls',
  },
  
  // Step 5: Map interaction - Using the map container directly
  {
    target: '.map-container',
    content: 'Click anywhere on the map to add a new contact at that location. You can also click on existing pins to view contact details.',
    placement: 'top',
    title: 'Adding & Viewing Contacts',
  },
  
  // Step 6: Status filter - Simplified selector
  {
    target: '.status-filter',
    content: 'Filter contacts on the map by their status. This helps you focus on specific groups like leads, prospects, or customers.',
    placement: 'top',
    title: 'Status Filtering',
  },
  
  // Step 7: Tour complete
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the map tour. Remember that you can click on pins to view contact details and get directions to their locations.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];