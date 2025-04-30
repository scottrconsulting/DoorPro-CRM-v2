import React from 'react';
import { TourStep } from '@/components/tour/custom-tour';

export const customDashboardTourSteps: TourStep[] = [
  {
    title: 'Welcome to Your Dashboard',
    content: (
      <div>
        <p>This is your command center for daily sales activities. From here, you can access all the tools you need to manage your field sales operations.</p>
      </div>
    )
  },
  {
    title: 'Activity Statistics',
    content: (
      <div>
        <p>These cards show your key performance metrics for the day. You can track visits, conversions, appointments, and sales all in one place.</p>
      </div>
    )
  },
  {
    title: 'Interactive Map',
    content: (
      <div>
        <p>The map shows all your contacts and their status. You can click on any pin to view contact details or add new contacts directly from the map.</p>
        <p>Use the "My Location" button to center the map on your current position.</p>
      </div>
    )
  },
  {
    title: 'Recent Activity',
    content: (
      <div>
        <p>This section shows your most recent interactions with contacts, including visits, calls, and notes.</p>
      </div>
    )
  },
  {
    title: 'Quick Actions',
    content: (
      <div>
        <p>Use these shortcuts to quickly add new contacts, schedule appointments, or record sales.</p>
      </div>
    )
  }
];