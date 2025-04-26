import { useAuth } from "@/hooks/use-auth";
import { getPlanName, UserRole, FREE_PLAN_LIMITS } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@shared/schema";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
      onClose();
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
      <div className="absolute inset-0 bg-neutral-800 opacity-50" onClick={onClose}></div>
      <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-lg h-full flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-neutral-200 shrink-0">
          <div className="flex items-center">
            <Link href="/" className="font-sans text-xl font-semibold text-primary">
              DoorPro CRM
            </Link>
            <span className="ml-1 text-xs bg-neutral-200 px-1.5 py-0.5 rounded-md text-neutral-700">
              {getPlanName(user?.role)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100"
            aria-label="Close menu"
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        
        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto">
          {/* Dashboard links */}
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Dashboard
            </div>
            <Link 
              href="/" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/") ? "text-primary" : "text-neutral-500"}`}>dashboard</span>
              <span>Overview</span>
            </Link>
            <Link 
              href="/territories" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/territories") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/territories") ? "text-primary" : "text-neutral-500"}`}>map</span>
              <span>Territories</span>
            </Link>
            <Link 
              href="/contacts" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/contacts") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/contacts") ? "text-primary" : "text-neutral-500"}`}>people</span>
              <span>Contacts</span>
            </Link>
            <Link 
              href="/schedule" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/schedule") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/schedule") ? "text-primary" : "text-neutral-500"}`}>calendar_today</span>
              <span>Schedule</span>
            </Link>
            <Link 
              href="/teams" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/teams") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/teams") ? "text-primary" : "text-neutral-500"}`}>groups</span>
              <span>Teams</span>
              {user?.role === UserRole.FREE && (
                <span className="ml-auto bg-neutral-200 text-neutral-600 text-xs px-1.5 py-0.5 rounded">Pro</span>
              )}
            </Link>
            <Link 
              href="/reports" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/reports") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/reports") ? "text-primary" : "text-neutral-500"}`}>bar_chart</span>
              <span>Reports</span>
              {user?.role === UserRole.FREE && (
                <span className="ml-auto bg-neutral-200 text-neutral-600 text-xs px-1.5 py-0.5 rounded">Pro</span>
              )}
            </Link>
            <Link 
              href="/chat" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/chat") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/chat") ? "text-primary" : "text-neutral-500"}`}>chat</span>
              <span>Team Chat</span>
            </Link>
            <Link 
              href="/routes" 
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/routes") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/routes") ? "text-primary" : "text-neutral-500"}`}>directions</span>
              <span>Route Planner</span>
            </Link>
          </div>
          
          {/* Settings links */}
          <div className="py-2 border-t border-neutral-200">
            <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Settings
            </div>
            <Link
              href="/settings"
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/settings") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/settings") ? "text-primary" : "text-neutral-500"}`}>settings</span>
              <span>Preferences</span>
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center px-4 py-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
            >
              <span className="material-icons mr-3 text-neutral-500">account_circle</span>
              <span>Account</span>
            </Link>
            <Link
              href="/upgrade"
              onClick={onClose}
              className={`flex items-center px-4 py-2 ${isActive("/upgrade") 
                ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
            >
              <span className={`material-icons mr-3 ${isActive("/upgrade") ? "text-primary" : "text-neutral-500"}`}>upgrade</span>
              <span>Upgrade Plan</span>
            </Link>
          </div>
          
          {/* Free plan progress */}
          {user?.role === UserRole.FREE && (
            <div className="p-4 border-t border-neutral-200">
              <div className="bg-neutral-100 rounded-lg p-3">
                <p className="text-sm text-neutral-600">Free plan: {contactsCount}/{contactsLimit} contacts used</p>
                <Progress value={contactsPercentage} className="h-2 mt-2" />
                <Link 
                  href="/upgrade"
                  onClick={onClose}
                  className="w-full mt-3 bg-primary text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary-dark inline-block text-center"
                >
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          )}
        </div>
        
        {/* Logout button - Fixed at bottom */}
        <div className="p-4 border-t border-neutral-200 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-left text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 rounded-md"
          >
            <span className="material-icons mr-3 text-neutral-500">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
