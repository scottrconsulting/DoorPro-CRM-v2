import { Step } from 'react-joyride';

// Map-specific tour steps - Removed problematic step 2 and renumbered
export const mapTourSteps: Step[] = [
  // Introduction - Step 1
  {
    target: 'body',
    content: 'Welcome to the Interactive Map! This tour will help you learn how to use the map features effectively.',
    placement: 'center',
    disableBeacon: true,
    title: 'Map Feature Tour',
  },
  
  // Now Step 2 (formerly Step 3) - Search functionality 
  {
    target: 'body',
    content: 'The search box (in the top bar) lets you find addresses. Enter an address and press Enter to search, then you can add it as a new contact.',
    placement: 'bottom',
    title: 'Address Search',
  },
  
  // Now Step 3 (formerly Step 4) - Map controls
  {
    target: 'body',
    content: 'The map controls (Map, Satellite, Hybrid, Terrain buttons) let you switch between different map views to better visualize the terrain and buildings.',
    placement: 'right',
    title: 'Map Type Controls',
  },
  
  // Now Step 4 (formerly Step 5) - Map interaction
  {
    target: 'body',
    content: 'Click anywhere on the map to add a new contact at that location. You can also click on existing pins to view contact details.',
    placement: 'top',
    title: 'Adding & Viewing Contacts',
  },
  
  // Now Step 5 (formerly Step 6) - Status filter
  {
    target: 'body',
    content: 'The filter controls at the bottom of the map let you filter contacts by their status. This helps you focus on specific groups like leads, prospects, or customers.',
    placement: 'bottom',
    title: 'Status Filtering',
  },
  
  // Now Step 6 (formerly Step 7) - My Location button
  {
    target: 'body',
    content: 'The "My Location" button (in the top right) locates your current position on the map. Your location will be shown as a blue dot, and the map will automatically center on your position.',
    placement: 'bottom',
    title: 'My Location Feature',
  },
  
  // Now Step 7 (new) - Tour complete
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the map tour. Remember that you can click on pins to view contact details and get directions to their locations.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];