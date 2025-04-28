import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { getPlanName, UserRole, FREE_PLAN_LIMITS } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Contact } from "@shared/schema";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DoorProLogo } from "@/components/ui/door-pro-logo";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
      onClose();
      // Additional fallback redirect to ensure we always go to login page
      setTimeout(() => {
        window.location.href = '/direct-login';
      }, 500);
    }
  };

  // Get contacts count for the progress bar
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: !!user,
  });

  const contactsCount = contacts.length;
  const contactsLimit = FREE_PLAN_LIMITS.contacts;
  const contactsPercentage = user?.role === UserRole.FREE
    ? Math.min(Math.round((contactsCount / contactsLimit) * 100), 100)
    : 0;

  const isActive = (path: string) => location === path;

  const translateClass = isOpen ? "translate-x-0" : "translate-x-[-100%]";

  return (
    <div className={`fixed inset-0 z-20 transform transition-transform duration-300 ease-in-out ${translateClass}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="absolute inset-y-0 left-0 w-64 bg-background shadow-lg h-full flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center">
            <Link href="/" className="flex items-center font-sans text-xl font-semibold">
              <DoorProLogo className="mr-2" />
              <span className="text-primary">DoorPro CRM</span>
            </Link>
            <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
              {getPlanName(user?.role)}
            </span>
          </div>
          <div className="flex items-center">
            <ThemeToggle />
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted ml-1"
              aria-label="Close menu"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto">
          {/* Dashboard links */}
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dashboard
            </div>
            <Link 
              href="/" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>dashboard</span>
              <span>Overview</span>
            </Link>
            <Link 
              href="/territories" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/territories") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/territories") ? "text-primary" : "text-muted-foreground"}`}>map</span>
              <span>Territories</span>
            </Link>
            <Link 
              href="/contacts" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/contacts") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/contacts") ? "text-primary" : "text-muted-foreground"}`}>people</span>
              <span>Contacts</span>
            </Link>
            <Link 
              href="/schedule" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/schedule") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/schedule") ? "text-primary" : "text-muted-foreground"}`}>calendar_today</span>
              <span>Schedule</span>
            </Link>
            <Link 
              href="/teams" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/teams") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/teams") ? "text-primary" : "text-muted-foreground"}`}>groups</span>
              <span>Teams</span>
              {user?.role === UserRole.FREE && (
                <span className="ml-auto bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">Pro</span>
              )}
            </Link>
            <Link 
              href="/reports" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/reports") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/reports") ? "text-primary" : "text-muted-foreground"}`}>bar_chart</span>
              <span>Reports</span>
              {user?.role === UserRole.FREE && (
                <span className="ml-auto bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">Pro</span>
              )}
            </Link>
            <Link 
              href="/chat" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/chat")
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/chat") ? "text-primary" : "text-muted-foreground"}`}>chat</span>
              <span>Chat</span>
            </Link>
            <Link 
              href="/routes" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/routes") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/routes") ? "text-primary" : "text-muted-foreground"}`}>directions</span>
              <span>Route Planner</span>
            </Link>
          </div>

          {/* Settings links */}
          <div className="py-2 border-t border-border">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Settings
            </div>
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/settings") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/settings") ? "text-primary" : "text-muted-foreground"}`}>settings</span>
              <span>Settings</span>
            </Link>
            <Link
              href="/customize"
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/customize") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/customize") ? "text-primary" : "text-muted-foreground"}`}>palette</span>
              <span>Customize</span>
            </Link>
            <Link
              href="/upgrade"
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/upgrade") 
                ? "text-foreground bg-muted border-l-4 border-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/upgrade") ? "text-primary" : "text-muted-foreground"}`}>upgrade</span>
              <span>Upgrade Plan</span>
            </Link>
          </div>

          {/* Free plan progress */}
          {user?.role === UserRole.FREE && (
            <div className="p-4 border-t border-border">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Free plan: {contactsCount}/{contactsLimit} contacts used</p>
                <Progress value={contactsPercentage} className="h-2 mt-2" />
                <Link 
                  href="/upgrade"
                  onClick={onClose}
                  className="w-full mt-3 bg-primary text-primary-foreground py-2 px-4 rounded-md text-sm font-medium hover:bg-primary/90 inline-block text-center"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Logout button - Fixed at bottom */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
          >
            <span className="material-icons mr-3 text-muted-foreground">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}