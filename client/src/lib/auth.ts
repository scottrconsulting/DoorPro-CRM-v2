import { apiRequest } from "./queryClient";

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: User;
  message?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email: string;
  fullName: string;
}

export enum UserRole {
  FREE = "free",
  PRO = "pro",
  ADMIN = "admin",
}

export async function getCurrentUser(): Promise<AuthResponse> {
  try {
    const res = await fetch("/api/auth/user", {
      credentials: "include",
    });
    
    if (!res.ok) {
      return { authenticated: false, message: "Not authenticated" };
    }
    
    return await res.json();
  } catch (error) {
    console.error("Auth error:", error);
    return { authenticated: false, message: "Authentication check failed" };
  }
}

export function hasPlanAccess(userRole: string | undefined, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  
  if (userRole === UserRole.ADMIN) return true;
  
  if (requiredRole === UserRole.FREE) return true;
  
  if (requiredRole === UserRole.PRO) {
    return userRole === UserRole.PRO || userRole === UserRole.ADMIN;
  }
  
  return false;
}

export function getPlanName(role?: string): string {
  switch (role) {
    case UserRole.PRO:
      return "Pro";
    case UserRole.ADMIN:
      return "Admin";
    case UserRole.FREE:
    default:
      return "Free";
  }
}

export const PRO_FEATURES = [
  {
    title: "Advanced Analytics",
    description: "Track conversion rates, performance metrics, and territory coverage with detailed reports.",
    icon: "analytics",
  },
  {
    title: "Team Management",
    description: "Add team members, assign territories, and track performance across your entire sales force.",
    icon: "groups",
  },
  {
    title: "Automated Follow-ups",
    description: "Set automated reminders and follow-up sequences to maximize your conversion rate.",
    icon: "autorenew",
  },
  {
    title: "Unlimited Contacts",
    description: "Store an unlimited number of contacts and leads in your database.",
    icon: "contacts",
  },
  {
    title: "Export Data",
    description: "Export your contacts, visits, and reports to CSV or Excel format.",
    icon: "download",
  },
];

export const FREE_PLAN_LIMITS = {
  contacts: 50,
  territories: 1,
  schedules: 10,
};
