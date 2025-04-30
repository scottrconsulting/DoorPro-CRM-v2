import React from 'react';
import { TourStep } from '@/components/tour/custom-tour';

export const customContactsTourSteps: TourStep[] = [
  {
    title: 'Contact Management',
    content: (
      <div>
        <p>This is your contact management center. From here, you can view, add, edit, and manage all your contacts in one place.</p>
      </div>
    )
  },
  {
    title: 'Search & Filter',
    content: (
      <div>
        <p>Use these tools to quickly find contacts by name, address, status, or other attributes.</p>
      </div>
    )
  },
  {
    title: 'Contact List',
    content: (
      <div>
        <p>This table shows all your contacts with key information. Click on any contact to view their complete profile and history.</p>
      </div>
    )
  },
  {
    title: 'Add New Contact',
    content: (
      <div>
        <p>Click the "Add Contact" button to create a new contact record. All contacts are automatically added to your interactive map.</p>
      </div>
    )
  },
  {
    title: 'Contact Actions',
    content: (
      <div>
        <p>Quick actions for each contact allow you to schedule appointments, log visits, record sales, or add notes with a single click.</p>
      </div>
    )
  }
];