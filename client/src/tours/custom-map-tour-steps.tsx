import React from 'react';
import { TourStep } from '@/components/tour/custom-tour';

// Map-specific tour steps with detailed content and fixed steps
export const customMapTourSteps: TourStep[] = [
  // Step 1: Introduction
  {
    title: 'Map Feature Tour',
    content: (
      <div className="space-y-3">
        <p>
          Welcome to the Interactive Map! This tour will help you learn how to use all the 
          map features effectively to manage contacts and track customer locations.
        </p>
        <p>
          Click <strong>Next</strong> to continue and learn about each map feature in detail.
        </p>
      </div>
    ),
  },
  
  // Step 2: My Location button
  {
    title: 'My Location Feature',
    content: (
      <div className="space-y-3">
        <p>
          The <strong>My Location</strong> button is located in the top-right of the control bar.
        </p>
        <p>
          When clicked, it uses your device's GPS to find your current position and centers the map on your location. 
          Your position will be shown as a blue dot, making it easy to see nearby contacts.
        </p>
        <p>
          The map will automatically track your location every 60 seconds to keep your position updated.
        </p>
      </div>
    ),
  },
  
  // Step 3: Search functionality
  {
    title: 'Address Search',
    content: (
      <div className="space-y-3">
        <p>
          The <strong>search box</strong> at the top of the map lets you quickly find addresses and locations.
        </p>
        <p>
          Enter a street address or location name and press Enter or click the Search button to find it on the map.
          Once found, you can add it as a new contact with the Add Contact button that appears.
        </p>
      </div>
    ),
  },
  
  // Step 4: Map controls
  {
    title: 'Map Type Controls',
    content: (
      <div className="space-y-3">
        <p>
          The <strong>map controls</strong> in the top bar let you switch between different map views:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Map:</strong> Standard street view (default)</li>
          <li><strong>Satellite:</strong> Aerial photography view</li>
          <li><strong>Hybrid:</strong> Satellite imagery with street names</li>
          <li><strong>Terrain:</strong> Physical map with topographical features</li>
        </ul>
        <p>
          Choose the view that works best for your current task.
        </p>
      </div>
    ),
  },
  
  // Step 5: Map interaction
  {
    title: 'Adding & Viewing Contacts',
    content: (
      <div className="space-y-3">
        <p>
          To <strong>add a new contact</strong>, simply click anywhere on the map. This will place a temporary marker and open a form 
          to enter the contact's details.
        </p>
        <p>
          To <strong>view existing contacts</strong>, click on their pins on the map. This will open the contact card 
          with all their information and interaction history.
        </p>
        <p>
          You can also <strong>right-click</strong> on an existing contact pin to quickly access the delete option.
        </p>
      </div>
    ),
  },
  
  // Step 6: Status filter
  {
    title: 'Status Filtering',
    content: (
      <div className="space-y-3">
        <p>
          The <strong>status filter controls</strong> at the bottom of the map let you filter contacts based on their current status.
        </p>
        <p>
          Click on any status button to show only contacts with that status. This is helpful when you want to focus on specific 
          groups such as leads, prospects, or customers that need follow-up.
        </p>
        <p>
          The filter uses the same color coding as your customized status settings, making it easy to identify contacts by status.
        </p>
      </div>
    ),
  },
  
  // Step 7: Tour complete
  {
    title: 'Tour Complete!',
    content: (
      <div className="space-y-3">
        <p>
          Congratulations! You've completed the map tour and learned about all the main map features.
        </p>
        <p>
          Remember that you can click on pins to view contact details and get directions to their locations.
          The activity tracker will automatically log time spent near contact locations to help you track your field work.
        </p>
        <p>
          Click <strong>Finish</strong> to close this tour and start using the map.
        </p>
      </div>
    ),
  },
];