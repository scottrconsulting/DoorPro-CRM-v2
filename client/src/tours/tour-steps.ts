import { Step } from 'react-joyride';

// Dashboard tour steps
export const dashboardTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to DoorPro CRM! This tour will help you get familiar with the dashboard. Let\'s get started!',
    placement: 'center',
    disableBeacon: true,
    title: 'Welcome to DoorPro CRM',
  },
  {
    target: '.add-contact-button',
    content: 'Click here to add new contacts to your CRM. You can add details like name, address, and contact information.',
    placement: 'bottom',
    title: 'Add New Contacts',
  },
  {
    target: '[data-tour="stat-cards"]',
    content: 'These cards show your daily statistics, including visits, conversions, and sales. They give you a quick overview of your performance.',
    placement: 'bottom',
    title: 'Performance Statistics',
  },
  {
    target: '[data-tour="map-view"]',
    content: 'The map shows all your contacts geographically. You can click on pins to view contact details and get directions.',
    placement: 'top',
    title: 'Interactive Map',
  },
  {
    target: '[data-tour="recent-contacts"]',
    content: 'Here you can see your most recent contacts and their status. Click on any contact to view more details.',
    placement: 'top',
    title: 'Recent Contacts',
  },
  {
    target: '[data-tour="schedule-widget"]',
    content: 'View your upcoming appointments and tasks. This helps you stay organized and prioritize your day.',
    placement: 'top',
    title: 'Your Schedule',
  },
  {
    target: '[data-tour="navigation"]',
    content: 'Use this navigation menu to switch between different sections of DoorPro CRM.',
    placement: 'right',
    title: 'Navigation Menu',
  },
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the dashboard tour. Feel free to explore more, and don\'t forget that you can start this tour again by clicking the Help button in the top-right corner.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];

// Contacts page tour steps
export const contactsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Contacts page! This is where you can manage all your customer contacts in one place.',
    placement: 'center',
    disableBeacon: true,
    title: 'Contacts Management',
  },
  {
    target: '.add-contact-button',
    content: 'Click here to add new contacts to your database. All contacts will automatically appear on your map with location pins.',
    placement: 'bottom',
    title: 'Add New Contacts',
  },
  {
    target: '.search-contacts-wrapper',
    content: 'Use this search box to quickly find contacts by name, address, email, or phone number.',
    placement: 'bottom',
    title: 'Search Contacts',
  },
  {
    target: '.status-filter-wrapper',
    content: 'Filter your contacts by status like Interested, Converted, or Not Interested to focus on specific groups.',
    placement: 'bottom',
    title: 'Filter by Status',
  },
  {
    target: 'table',
    content: 'This table shows all your contacts. Click on a contact\'s name to view detailed information and history.',
    placement: 'top',
    title: 'Contact List',
  },
  {
    target: 'body',
    content: 'You can click on a contact\'s address to get directions or click on a contact\'s name to see all details, including notes, tasks, and sales history.',
    placement: 'center',
    title: 'Contact Interactions',
  },
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the contacts tour. Remember that the same contact card appears whether you click a contact from this list or from a map pin.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];

// Schedule page tour steps
export const scheduleTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Schedule page! This is where you can manage your appointments and tasks in one unified view.',
    placement: 'center',
    disableBeacon: true,
    title: 'Schedule Management',
  },
  {
    target: '[data-tour="schedule-title"]',
    content: 'This page shows all of your tasks and appointments in chronological order. It combines both scheduled appointments and your to-do tasks in one place.',
    placement: 'bottom', 
    title: 'Tasks & Bookings',
  },
  {
    target: '.flex.bg-gray-100.rounded-md',
    content: 'Use these filters to view items for Today, Upcoming, or All dates. You can quickly find what you need to focus on right now or plan ahead.',
    placement: 'bottom',
    title: 'View Filters',
  },
  {
    target: '[data-tour="add-schedule-btn"]',
    content: 'Click here to add new appointments or tasks to your schedule. You can create follow-ups, presentations, and booked appointments.',
    placement: 'bottom',
    title: 'Add New Items',
  },
  {
    target: '.bg-white.rounded-lg.shadow-md',
    content: 'Fill out this form to create new appointments or tasks. You can specify details like title, location, date, and time.',
    placement: 'top',
    title: 'Create New Appointments',
  },
  {
    target: '.container',
    content: 'Your schedule items appear here grouped by date. Tasks appear in purple, while appointments are shown in blue. You can click on any item to view details or get directions to the location.',
    placement: 'bottom',
    title: 'Schedule Items',
  },
  {
    target: '[data-tour="navigation"]',
    content: 'Use the navigation sidebar to quickly move between different areas of the application.',
    placement: 'right',
    title: 'Navigation Menu',
  },
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the schedule tour. Remember to keep your schedule updated to stay organized throughout your day.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];

// Settings page tour steps 
export const settingsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Settings page! Here you can customize DoorPro CRM to fit your workflow.',
    placement: 'center',
    disableBeacon: true,
    title: 'Settings & Customization',
  },
  {
    target: '[data-tour="profile-settings"]',
    content: 'Update your personal information, profile picture, and contact details here.',
    placement: 'bottom',
    title: 'Profile Settings',
  },
  {
    target: '[data-tour="dashboard-settings"]',
    content: 'Customize your dashboard layout, widgets, and statistics metrics to show what matters most to you.',
    placement: 'bottom',
    title: 'Dashboard Settings',
  },
  {
    target: '[data-tour="notification-settings"]',
    content: 'Configure when and how you receive notifications about new leads, appointments, and tasks.',
    placement: 'top',
    title: 'Notification Settings',
  },
  {
    target: '[data-tour="team-settings"]',
    content: 'Manage your team members and their permissions (available on Pro plan).',
    placement: 'top',
    title: 'Team Settings',
  },
  {
    target: 'body',
    content: 'That\'s it! You\'ve completed the settings tour. Remember to save your changes after making adjustments.',
    placement: 'center',
    title: 'Tour Complete!',
  },
];