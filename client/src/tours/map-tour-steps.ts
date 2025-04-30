import { Step } from 'react-joyride';

// Map-specific tour steps - Using the simplest possible selectors
export const mapTourSteps: Step[] = [
  // Introduction - Step 1
  {
    target: 'body',
    content: 'Welcome to the Interactive Map! This tour will help you learn how to use the map features effectively.',
    placement: 'center',
    disableBeacon: true,
    title: 'Map Feature Tour',
  },
  
  // My Location button - Step 2
  // Using body first to avoid skipping and then we'll show content about My Location
  {
    target: 'body',
    content: 'The "My Location" button (in the top right) locates your current position on the map. Your location will be shown as a blue dot, and the map will automatically center on your position.',
    placement: 'bottom',
    title: 'My Location Feature',
  },
  
  // Search functionality - Step 3
  {
    target: 'body',
    content: 'The search box (in the top bar) lets you find addresses. Enter an address and press Enter to search, then you can add it as a new contact.',
    placement: 'bottom',
    title: 'Address Search',
  },
  
  // Map controls - Step 4
  {
    target: 'body',
    content: 'The map controls (Map, Satellite, Hybrid, Terrain buttons) let you switch between different map views to better visualize the terrain and buildings.',
    placement: 'right',
    title: 'Map Type Controls',
  },
  
  // Map interaction - Step 5
  {
    target: 'body',
    content: 'Click anywhere on the map to add a new contact at that location. You can also click on existing pins to view contact details.',
    placement: 'top',
    title: 'Adding & Viewing Contacts',
  },
  
  // Status filter - Step 6
  {
    target: 'body',
    content: 'The filter controls at the bottom of the map let you filter contacts by their status. This helps you focus on specific groups like leads, prospects, or customers.',
    placement: 'bottom',
    title: 'Status Filtering',
  },
  
  // Tour complete - Step 7
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the map tour. Remember that you can click on pins to view contact details and get directions to their locations.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];