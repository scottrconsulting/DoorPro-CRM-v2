import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
