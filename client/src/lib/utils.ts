import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Z-Index hierarchy for consistent layering
export const Z_INDEX = {
  MODAL: 9999,
  DROPDOWN: 1000,
  SCROLL_BUTTONS: 100,
  NAVIGATION: 50,
  CONTENT: 1,
} as const;

// Safe zone requirements for different screen sizes
export const SAFE_ZONES = {
  DESKTOP: 20,
  TABLET: 24,
  MOBILE: 32,
  TOUCH_TARGET: 44,
} as const;

// Utility classes for scroll button positioning
export const scrollButtonClasses = {
  base: "absolute flex items-center justify-center transition-colors bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-accent",
  vertical: "h-8 w-8 rounded-full",
  horizontal: "h-6 w-12 rounded-md",
  positioning: {
    up: "top-2 left-1/2 -translate-x-1/2",
    down: "bottom-2 left-1/2 -translate-x-1/2", 
    left: "left-2 top-1/2 -translate-y-1/2",
    right: "right-2 top-1/2 -translate-y-1/2",
  },
  mobile: "min-h-[44px] min-w-[44px] p-2",
  desktop: "h-8 w-8 p-1",
};

/**
 * Helper function to detect if running in direct domain vs preview mode
 * This helps identify cross-domain authentication issues
 */
export function isExternalBrowserTab(): boolean {
  if (typeof window === 'undefined') return false;
  
  // If we're running in a production domain
  const isExternalTab = window.location.host.includes('replit.app');
  const isPreviewHost = window.location.host.includes('picard.replit.dev');
  
  return isExternalTab && !isPreviewHost;
}

/**
 * Opens the application in Replit preview mode which has better authentication support
 */
export function openInPreviewMode(): void {
  window.open('https://replit.com/@ScottRConsult/door-pro-crm?v=1', '_blank');
}
