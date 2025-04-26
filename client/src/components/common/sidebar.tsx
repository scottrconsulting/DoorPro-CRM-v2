import { useAuth } from "@/hooks/use-auth";
import { getPlanName, UserRole, FREE_PLAN_LIMITS } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@shared/schema";

export default function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

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

  const { logout } = useAuth();
  
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <nav className="hidden md:flex md:w-64 flex-shrink-0 flex-col bg-white border-r border-neutral-200 h-full">
      <div className="p-4 flex items-center justify-between border-b border-neutral-200">
        <div className="flex items-center">
          <Link href="/" className="font-sans text-xl font-semibold text-primary">
            DoorPro CRM
          </Link>
          <span className="ml-1 text-xs bg-neutral-200 px-1.5 py-0.5 rounded-md text-neutral-700">
            {getPlanName(user?.role)}
          </span>
        </div>
      </div>
      
      <div className="flex flex-col flex-grow overflow-y-auto">
        <div className="py-2">
          <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Dashboard
          </div>
          <Link 
            href="/"
            className={`flex items-center px-4 py-2 ${isActive("/") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/") ? "text-primary" : "text-neutral-500"}`}>dashboard</span>
            <span>Overview</span>
          </Link>
          <Link 
            href="/territories"
            className={`flex items-center px-4 py-2 ${isActive("/territories") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/territories") ? "text-primary" : "text-neutral-500"}`}>map</span>
            <span>Territories</span>
          </Link>
          <Link 
            href="/contacts"
            className={`flex items-center px-4 py-2 ${isActive("/contacts") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/contacts") ? "text-primary" : "text-neutral-500"}`}>people</span>
            <span>Contacts</span>
          </Link>
          <Link 
            href="/schedule"
            className={`flex items-center px-4 py-2 ${isActive("/schedule") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/schedule") ? "text-primary" : "text-neutral-500"}`}>calendar_today</span>
            <span>Schedule</span>
          </Link>
          <Link 
            href="/teams"
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
        </div>
        
        <div className="py-2 border-t border-neutral-200">
          <div className="px-4 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Settings
          </div>
          <Link 
            href="/settings"
            className={`flex items-center px-4 py-2 ${isActive("/settings") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/settings") ? "text-primary" : "text-neutral-500"}`}>settings</span>
            <span>Preferences</span>
          </Link>
          <Link 
            href="/settings"
            className="flex items-center px-4 py-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <span className="material-icons mr-3 text-neutral-500">account_circle</span>
            <span>Account</span>
          </Link>
          <Link 
            href="/upgrade"
            className={`flex items-center px-4 py-2 ${isActive("/upgrade") 
              ? "text-neutral-800 bg-neutral-100 border-l-4 border-primary" 
              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/upgrade") ? "text-primary" : "text-neutral-500"}`}>upgrade</span>
            <span>Upgrade Plan</span>
            {user?.role === UserRole.FREE && (
              <span className="ml-auto text-xs text-primary">View</span>
            )}
          </Link>
        </div>
        
        {user?.role === UserRole.FREE && (
          <div className="p-4 border-t border-neutral-200">
            <div className="bg-neutral-100 rounded-lg p-3">
              <p className="text-sm text-neutral-600">Free plan: {contactsCount}/{contactsLimit} contacts used</p>
              <Progress value={contactsPercentage} className="h-2 mt-2" />
              <Link 
                href="/upgrade"
                className="w-full mt-3 bg-primary text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-primary-dark inline-block text-center"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}
        
        {/* Logout button */}
        <div className="mt-auto p-4 border-t border-neutral-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-left text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 rounded-md"
          >
            <span className="material-icons mr-3 text-neutral-500">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
