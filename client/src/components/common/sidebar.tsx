import { useAuth } from "@/hooks/use-auth";
import { getPlanName, UserRole, FREE_PLAN_LIMITS } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@shared/schema";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
      // Additional fallback redirect to ensure we always go to login page
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    }
  };

  return (
    <nav className="hidden md:flex md:w-64 flex-shrink-0 flex-col bg-background border-r border-border h-full">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center">
          <Link href="/" className="font-sans text-xl font-semibold text-primary">
            DoorPro CRM
          </Link>
          <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
            {getPlanName(user?.role)}
          </span>
        </div>
        <ThemeToggle />
      </div>
      
      <div className="flex flex-col flex-grow overflow-y-auto">
        <div className="py-2">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dashboard
          </div>
          <Link 
            href="/"
            className={`flex items-center px-4 py-2 ${isActive("/") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>dashboard</span>
            <span>Overview</span>
          </Link>
          <Link 
            href="/territories"
            className={`flex items-center px-4 py-2 ${isActive("/territories") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/territories") ? "text-primary" : "text-muted-foreground"}`}>map</span>
            <span>Territories</span>
          </Link>
          <Link 
            href="/contacts"
            className={`flex items-center px-4 py-2 ${isActive("/contacts") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/contacts") ? "text-primary" : "text-muted-foreground"}`}>people</span>
            <span>Contacts</span>
          </Link>
          <Link 
            href="/schedule"
            className={`flex items-center px-4 py-2 ${isActive("/schedule") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/schedule") ? "text-primary" : "text-muted-foreground"}`}>calendar_today</span>
            <span>Schedule</span>
          </Link>
          <Link 
            href="/teams"
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
            href="/chat"
            className={`flex items-center px-4 py-2 ${isActive("/chat") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/chat") ? "text-primary" : "text-muted-foreground"}`}>chat</span>
            <span>Team Chat</span>
          </Link>
          <Link 
            href="/routes"
            className={`flex items-center px-4 py-2 ${isActive("/routes") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/routes") ? "text-primary" : "text-muted-foreground"}`}>directions</span>
            <span>Route Planner</span>
          </Link>
          <Link 
            href="/reports"
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
        </div>
        
        <div className="py-2 border-t border-border">
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Settings
          </div>
          <Link 
            href="/settings"
            className={`flex items-center px-4 py-2 ${isActive("/settings") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/settings") ? "text-primary" : "text-muted-foreground"}`}>settings</span>
            <span>Preferences</span>
          </Link>
          <Link 
            href="/customize"
            className={`flex items-center px-4 py-2 ${isActive("/customize") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/customize") ? "text-primary" : "text-muted-foreground"}`}>palette</span>
            <span>Customize</span>
          </Link>
          <Link 
            href="/settings"
            className="flex items-center px-4 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <span className="material-icons mr-3 text-muted-foreground">account_circle</span>
            <span>Account</span>
          </Link>
          <Link 
            href="/upgrade"
            className={`flex items-center px-4 py-2 ${isActive("/upgrade") 
              ? "text-foreground bg-muted border-l-4 border-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <span className={`material-icons mr-3 ${isActive("/upgrade") ? "text-primary" : "text-muted-foreground"}`}>upgrade</span>
            <span>Upgrade Plan</span>
            {user?.role === UserRole.FREE && (
              <span className="ml-auto text-xs text-primary">View</span>
            )}
          </Link>
        </div>
        
        {user?.role === UserRole.FREE && (
          <div className="p-4 border-t border-border">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Free plan: {contactsCount}/{contactsLimit} contacts used</p>
              <Progress value={contactsPercentage} className="h-2 mt-2" />
              <Link 
                href="/upgrade"
                className="w-full mt-3 bg-primary text-primary-foreground py-2 px-4 rounded-md text-sm font-medium hover:bg-primary/90 inline-block text-center"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        )}
        
        {/* Logout button */}
        <div className="mt-auto p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
          >
            <span className="material-icons mr-3 text-muted-foreground">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
