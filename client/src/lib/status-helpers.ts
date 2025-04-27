// Helper functions for consistent status formatting across the application

/**
 * Properly formats a status string for display.
 * Converts snake_case to Title Case with spaces.
 * 
 * @param status The status value from the database (e.g., "not_visited", "call_back")
 * @param statusLabels Optional map of custom status labels from user settings
 * @returns Properly formatted status label (e.g., "Not Visited", "Call Back")
 */
export function getStatusLabel(status: string, statusLabels?: Record<string, string>): string {
  // Use custom label if provided
  if (statusLabels && statusLabels[status]) {
    return statusLabels[status];
  }
  
  // Otherwise format status by capitalizing each word
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Gets a CSS color class based on the status.
 * 
 * @param status The status from the database
 * @returns A Tailwind CSS class for text or background color
 */
export function getStatusColor(status: string): string {
  // Map of status to Tailwind color classes
  const colorMap: Record<string, string> = {
    not_visited: 'bg-blue-500',
    interested: 'bg-yellow-500',
    not_interested: 'bg-red-500',
    call_back: 'bg-blue-500',
    appointment_scheduled: 'bg-orange-500',
    converted: 'bg-green-500',
    no_soliciting: 'bg-purple-500',
    considering: 'bg-purple-500',
  };
  
  return colorMap[status] || 'bg-blue-500';
}

/**
 * Gets an inline style object for a hex color.
 * 
 * @param status The status from the database
 * @param pinColors Optional map of custom pin colors 
 * @returns React CSS properties object or undefined
 */
export function getColorStyle(status: string, pinColors?: Record<string, string>): React.CSSProperties | undefined {
  if (pinColors && pinColors[status]) {
    const customColor = pinColors[status];
    if (customColor.startsWith('#')) {
      return { backgroundColor: customColor };
    }
  }
  return undefined;
}

/**
 * Returns a badge component configuration for status badges.
 * 
 * @param status The status from the database
 * @returns Configuration with background, text color and label
 */
export function getStatusBadgeConfig(status: string): { bg: string; text: string; label: string } {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    interested: {
      bg: "bg-green-100",
      text: "text-green-800",
      label: getStatusLabel("interested"),
    },
    not_interested: {
      bg: "bg-red-100",
      text: "text-red-800",
      label: getStatusLabel("not_interested"),
    },
    converted: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      label: getStatusLabel("converted"),
    },
    considering: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      label: getStatusLabel("considering"),
    },
    call_back: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      label: getStatusLabel("call_back"),
    },
    appointment_scheduled: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      label: getStatusLabel("appointment_scheduled"),
    },
    not_visited: {
      bg: "bg-blue-100",
      text: "text-blue-800", 
      label: getStatusLabel("not_visited"),
    },
    no_soliciting: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: getStatusLabel("no_soliciting"),
    },
  };

  return config[status] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: getStatusLabel(status),
  };
}