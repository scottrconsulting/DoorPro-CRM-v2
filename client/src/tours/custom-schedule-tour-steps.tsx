import React from 'react';
import { TourStep } from '@/components/tour/custom-tour';

export const customScheduleTourSteps: TourStep[] = [
  {
    title: 'Tasks & Bookings Schedule',
    target: '[data-tour="schedule-title"]',
    content: (
      <div>
        <p>Welcome to your schedule management center. Here you can track all your appointments, tasks, and follow-ups in one place.</p>
      </div>
    )
  },
  {
    title: 'Schedule Filters',
    target: '[data-tour="schedule-filters"]',
    content: (
      <div>
        <p>Use these filters to view different types of schedules. Switch between Today, Upcoming, or All items to focus on what's important right now.</p>
      </div>
    )
  },
  {
    title: 'Add New Task or Appointment',
    target: '[data-tour="add-schedule-btn"]',
    content: (
      <div>
        <p>Click this button to quickly add a new task or appointment to your schedule. You can set the date, time, and link it to a specific contact.</p>
      </div>
    )
  },
  {
    title: 'Schedule Form',
    target: '[data-tour="schedule-form"]',
    content: (
      <div>
        <p>Fill out this form to create or edit tasks and appointments. You can specify whether it's a task or an appointment, set priorities, and add location details.</p>
      </div>
    ),
    condition: () => document.querySelector('[data-tour="schedule-form"]') !== null
  },
  {
    title: 'Schedule List',
    target: '[data-tour="schedule-list"]',
    content: (
      <div>
        <p>This area displays all your scheduled items, organized by date. Click on any item to edit or delete it.</p>
      </div>
    )
  }
];