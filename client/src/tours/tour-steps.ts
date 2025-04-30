import { Step } from 'react-joyride';

// Dashboard Tour Steps
export const dashboardTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to DoorPro CRM! This quick tour will help you get familiar with the system.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.sidebar-navigation',
    content: 'This is your main navigation menu. You can access all parts of the application from here.',
    placement: 'right',
  },
  {
    target: '.dashboard-summary',
    content: 'The dashboard gives you a quick overview of your sales performance, contact statistics, and upcoming appointments.',
    placement: 'bottom',
  },
  {
    target: '.dashboard-map',
    content: 'This map shows all your contacts. You can click on pins to view contact details and navigate to their location.',
    placement: 'top',
  },
  {
    target: '.my-location-button',
    content: 'Click here to center the map on your current location. This helps when you're out in the field.',
    placement: 'left',
  },
  {
    target: '.map-controls',
    content: 'You can change map views, zoom in and out, and adjust other map settings here.',
    placement: 'left',
  },
  {
    target: '.theme-toggle',
    content: 'You can switch between light and dark themes based on your preference.',
    placement: 'bottom',
  },
];

// Contacts Tour Steps
export const contactsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'This is the Contacts page where you can manage all your customer information.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.add-contact-button',
    content: 'Click here to add a new contact. You'll need to fill in details like name, address, and contact information.',
    placement: 'bottom',
  },
  {
    target: '.contacts-search',
    content: 'You can search for specific contacts by name, address, or any other information.',
    placement: 'bottom',
  },
  {
    target: '.contact-list',
    content: 'This list shows all your contacts. Click on any contact to view more details and interaction history.',
    placement: 'top',
  },
  {
    target: '.contacts-sort',
    content: 'You can sort contacts by different criteria like name, date added, or last contacted.',
    placement: 'left',
  },
  {
    target: '.contacts-filter',
    content: 'Filter contacts by status, tags, or follow-up requirements.',
    placement: 'left',
  },
];

// Contact Detail Tour Steps
export const contactDetailTourSteps: Step[] = [
  {
    target: 'body',
    content: 'This is the Contact Detail page where you can view and manage all information about a specific contact.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.contact-card-tabs',
    content: 'These tabs organize different types of information about your contact.',
    placement: 'bottom',
  },
  {
    target: '.add-note-button',
    content: 'Add notes about your interactions with this contact to keep track of important details.',
    placement: 'top',
  },
  {
    target: '.add-task-button',
    content: 'Create tasks with due dates to follow up with this contact. You can set priorities and reminders.',
    placement: 'top',
  },
  {
    target: '.schedule-appointment-button',
    content: 'Schedule appointments with this contact. These will appear in your calendar.',
    placement: 'top',
  },
  {
    target: '.record-sale-button',
    content: 'Record sales transactions with this contact. This helps track your performance and contact value.',
    placement: 'top',
  },
  {
    target: '.edit-contact-button',
    content: 'Edit the contact's information if anything changes.',
    placement: 'left',
  },
  {
    target: '.contact-map',
    content: 'This map shows the contact's location. You can get directions from here.',
    placement: 'top',
  },
];

// Schedule Tour Steps
export const scheduleTourSteps: Step[] = [
  {
    target: 'body',
    content: 'The Schedule page helps you manage your appointments, tasks, and follow-ups.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.schedule-view-controls',
    content: 'You can switch between daily, weekly, or monthly views to see your schedule.',
    placement: 'bottom',
  },
  {
    target: '.calendar-navigation',
    content: 'Navigate between time periods using these controls.',
    placement: 'bottom',
  },
  {
    target: '.schedule-appointments',
    content: 'Your scheduled appointments appear here. Click on any appointment to view details or make changes.',
    placement: 'top',
  },
  {
    target: '.schedule-tasks',
    content: 'Tasks appear in purple. You can see their due dates and priority levels at a glance.',
    placement: 'top',
  },
  {
    target: '.add-appointment-button',
    content: 'Quickly add new appointments directly from this page.',
    placement: 'left',
  },
  {
    target: '.add-task-button',
    content: 'Create new tasks with priorities and due dates.',
    placement: 'left',
  },
];

// Routes Tour Steps
export const routesTourSteps: Step[] = [
  {
    target: 'body',
    content: 'The Routes page helps you plan and optimize your sales routes for efficient visits.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.routes-map',
    content: 'This map shows your planned route and all stops you need to make.',
    placement: 'top',
  },
  {
    target: '.optimize-route-button',
    content: 'Automatically optimize your route to minimize travel time between contacts.',
    placement: 'bottom',
  },
  {
    target: '.route-stops-list',
    content: 'This list shows all stops on your route. You can reorder them manually if needed.',
    placement: 'top',
  },
  {
    target: '.add-stop-button',
    content: 'Add more stops to your route from your contacts list.',
    placement: 'left',
  },
];

// Reports Tour Steps
export const reportsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'The Reports page gives you insights into your sales performance and activity.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.reports-date-range',
    content: 'Select a date range to analyze your performance over specific periods.',
    placement: 'bottom',
  },
  {
    target: '.sales-overview-chart',
    content: 'This chart shows your sales performance over time. You can spot trends and patterns.',
    placement: 'top',
  },
  {
    target: '.activity-metrics',
    content: 'These metrics show your level of activity like contacts added, appointments scheduled, and follow-ups completed.',
    placement: 'left',
  },
  {
    target: '.conversion-metrics',
    content: 'See your conversion rates from leads to customers and understand your sales funnel.',
    placement: 'left',
  },
  {
    target: '.export-report-button',
    content: 'Export your reports to share with your team or for further analysis.',
    placement: 'left',
  },
];