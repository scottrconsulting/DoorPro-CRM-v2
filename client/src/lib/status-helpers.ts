// Helper functions for consistent status formatting across the application
import { DEFAULT_PIN_COLORS } from "@shared/schema";

/**
 * Properly formats a status string for display.
 * Converts snake_case to Title Case with spaces.
 * 
 * @param status The status value from the database (e.g., "not_visited", "call_back")
 * @param statusLabels Optional map of custom status labels from user settings
 * @returns Properly formatted status label (e.g., "Not Visited", "Call Back")
 */
export function getStatusLabel(status: string, statusLabels?: Record<string, string>): string {
  // Map not_visited to no_answer for display purposes
  const mappedStatus = status === 'not_visited' ? 'no_answer' : status;
  
  // Use custom label if provided
  if (statusLabels) {
    // First check for direct match
    if (statusLabels[status]) {
      return statusLabels[status];
    }
    // Then check for mapped status match
    if (mappedStatus !== status && statusLabels[mappedStatus]) {
      return statusLabels[mappedStatus];
    }
  }
  
  // Handle special cases directly
  if (status === 'not_visited') {
    return 'No Answer';
  }
  
  // Otherwise format status by capitalizing each word
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Gets a CSS color class based on the status.
 * Uses DEFAULT_PIN_COLORS from schema as the single source of truth.
 * 
 * @param status The status from the database
 * @param pinColors Optional custom pin colors from user settings
 * @returns A Tailwind CSS class for text or background color
 */
export function getStatusColor(status: string, pinColors?: Record<string, string>): string {
  // Map not_visited to no_answer for consistent handling
  const mappedStatus = status === 'not_visited' ? 'no_answer' : status;
  
  // Use custom pin colors if available
  if (pinColors && pinColors[mappedStatus]) {
    const customColor = pinColors[mappedStatus];
    // Convert named colors to Tailwind classes
    const colorClassMap: Record<string, string> = {
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'green': 'bg-green-500',
      'yellow': 'bg-yellow-500',
      'purple': 'bg-purple-500',
      'orange': 'bg-orange-500',
      'pink': 'bg-pink-500',
    };
    return colorClassMap[customColor.toLowerCase()] || 'bg-blue-500';
  }
  
  // Use DEFAULT_PIN_COLORS as the base mapping
  const defaultColor = DEFAULT_PIN_COLORS[mappedStatus as keyof typeof DEFAULT_PIN_COLORS];
  if (defaultColor) {
    const colorClassMap: Record<string, string> = {
      'red': 'bg-red-500',
      'blue': 'bg-blue-500',
      'green': 'bg-green-500',
      'yellow': 'bg-yellow-500',
      'purple': 'bg-purple-500',
      'orange': 'bg-orange-500',
      'pink': 'bg-pink-500',
    };
    return colorClassMap[defaultColor.toLowerCase()] || 'bg-blue-500';
  }
  
  // Fallback for backward compatibility
  const legacyColorMap: Record<string, string> = {
    interested: 'bg-yellow-500',
    call_back: 'bg-yellow-500',
    appointment_scheduled: 'bg-blue-500',
    converted: 'bg-green-500',
    considering: 'bg-purple-500',
  };
  
  return legacyColorMap[status] || 'bg-blue-500';
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
 * @param statusLabels Optional map of custom status labels from user settings
 * @returns Configuration with background, text color and label
 */
export function getStatusBadgeConfig(status: string, statusLabels?: Record<string, string>): { bg: string; text: string; label: string } {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    // Consistent with DEFAULT_PIN_COLORS mapping from schema.ts
    no_answer: {
      bg: "bg-pink-100",
      text: "text-pink-800",
      label: getStatusLabel("no_answer", statusLabels),
    },
    not_visited: {  // For backward compatibility
      bg: "bg-pink-100",
      text: "text-pink-800",
      label: getStatusLabel("no_answer", statusLabels), // Map to no_answer for custom labels
    },
    presented: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      label: getStatusLabel("presented", statusLabels),
    },
    booked: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      label: getStatusLabel("booked", statusLabels),
    },
    sold: {
      bg: "bg-green-100",
      text: "text-green-800",
      label: getStatusLabel("sold", statusLabels),
    },
    not_interested: {
      bg: "bg-red-100",
      text: "text-red-800",
      label: getStatusLabel("not_interested", statusLabels),
    },
    no_soliciting: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      label: getStatusLabel("no_soliciting", statusLabels),
    },
    check_back: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      label: getStatusLabel("check_back", statusLabels),
    },
    // Other statuses for backward compatibility
    interested: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      label: getStatusLabel("interested", statusLabels),
    },
    converted: {
      bg: "bg-green-100",
      text: "text-green-800",
      label: getStatusLabel("converted", statusLabels),
    },
    considering: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      label: getStatusLabel("considering", statusLabels),
    },
    call_back: {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      label: getStatusLabel("call_back", statusLabels),
    },
    appointment_scheduled: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      label: getStatusLabel("appointment_scheduled", statusLabels),
    },
  };

  return config[status] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    label: getStatusLabel(status, statusLabels),
  };
}