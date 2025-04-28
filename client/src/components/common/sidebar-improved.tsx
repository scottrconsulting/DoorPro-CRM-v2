import { useDirectAuth } from "@/hooks/use-direct-auth";
import { getPlanName, UserRole, FREE_PLAN_LIMITS } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { Contact } from "@shared/schema";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DoorProLogo } from "@/components/ui/door-pro-logo";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function SidebarImproved() {
  const { user, logout } = useDirectAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hovered, setHovered] = useState<boolean>(false);

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
  
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
      // Additional fallback redirect to ensure we always go to login page
      window.location.href = '/direct-login';
    }
  };

  // Check user preference in localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setCollapsed(savedState === 'true');
    }
  }, []);

  // Save preference when changed
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Calculate sidebar width based on collapsed state
  const sidebarWidth = collapsed ? 'md:w-16' : 'md:w-64';

  return (
    <nav 
      className={`hidden md:flex ${sidebarWidth} flex-shrink-0 flex-col bg-background border-r border-border h-full overflow-hidden transition-all duration-300 ease-in-out relative`}
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Collapse Toggle Button */}
      <button 
        className="absolute top-4 -right-3 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center shadow-sm z-10 hover:bg-muted"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={`px-4 py-3 flex flex-col ${collapsed ? 'items-center' : ''} border-b border-border`}>
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center font-sans text-xl font-semibold whitespace-nowrap">
                <DoorProLogo className="mr-2 flex-shrink-0" />
                <span className="text-primary">DoorPro CRM</span>
              </Link>
              <ThemeToggle />
            </div>
            <div className="flex items-center mt-1">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground whitespace-nowrap flex-shrink-0">
                {getPlanName(user?.role)}
              </span>
            </div>
          </>
        ) : (
          <Link href="/" aria-label="Home" className="flex justify-center">
            <DoorProLogo className="h-6 w-6" />
          </Link>
        )}
      </div>
      
      <div className="flex flex-col flex-grow overflow-y-auto">
        <div className="py-2">
          {!collapsed && (
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dashboard
            </div>
          )}

          <NavItem 
            href="/" 
            icon="dashboard" 
            label="Overview" 
            isActive={isActive("/")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/contacts" 
            icon="people" 
            label="Contacts" 
            isActive={isActive("/contacts")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/schedule" 
            icon="calendar_today" 
            label="Schedule" 
            isActive={isActive("/schedule")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/routes" 
            icon="directions" 
            label="Routes" 
            isActive={isActive("/routes")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/reports" 
            icon="bar_chart" 
            label="Reports" 
            isActive={isActive("/reports")} 
            collapsed={collapsed} 
            badge={user?.role === UserRole.FREE ? "Pro" : undefined}
          />
        </div>
        
        <div className="py-2 border-t border-border">
          {!collapsed && (
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Settings
            </div>
          )}
          
          <NavItem 
            href="/settings" 
            icon="settings" 
            label="Settings" 
            isActive={isActive("/settings")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/customize" 
            icon="palette" 
            label="Customize" 
            isActive={isActive("/customize")} 
            collapsed={collapsed} 
          />
          
          <NavItem 
            href="/upgrade" 
            icon="upgrade" 
            label="Upgrade" 
            isActive={isActive("/upgrade")} 
            collapsed={collapsed} 
          />
        </div>
        
        {user?.role === UserRole.FREE && !collapsed && (
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
          {collapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center w-full h-9 rounded-md hover:bg-muted"
                    aria-label="Logout"
                  >
                    <span className="material-icons text-muted-foreground">logout</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Logout</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
            >
              <span className="material-icons mr-3 text-muted-foreground">logout</span>
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Expanded sidebar on hover when collapsed */}
      {collapsed && hovered && (
        <div className="absolute top-0 left-16 w-64 h-full bg-background border-r border-border shadow-lg z-20 overflow-y-auto">
          <div className="px-4 py-3 flex flex-col border-b border-border">
            <div className="flex items-center justify-between w-full">
              <Link href="/" className="flex items-center font-sans text-xl font-semibold whitespace-nowrap">
                <DoorProLogo className="mr-2 flex-shrink-0" />
                <span className="text-primary">DoorPro CRM</span>
              </Link>
              <ThemeToggle />
            </div>
            <div className="flex items-center mt-1">
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground whitespace-nowrap flex-shrink-0">
                {getPlanName(user?.role)}
              </span>
            </div>
          </div>
          
          <div className="py-2">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dashboard
            </div>
            
            <SidebarLink href="/" icon="dashboard" label="Overview" isActive={isActive("/")} />
            <SidebarLink href="/contacts" icon="people" label="Contacts" isActive={isActive("/contacts")} />
            <SidebarLink href="/schedule" icon="calendar_today" label="Schedule" isActive={isActive("/schedule")} />
            <SidebarLink href="/routes" icon="directions" label="Routes" isActive={isActive("/routes")} />
            <SidebarLink 
              href="/reports" 
              icon="bar_chart" 
              label="Reports" 
              isActive={isActive("/reports")} 
              badge={user?.role === UserRole.FREE ? "Pro" : undefined}
            />
          </div>
          
          <div className="py-2 border-t border-border">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Settings
            </div>
            <SidebarLink href="/settings" icon="settings" label="Settings" isActive={isActive("/settings")} />
            <SidebarLink href="/customize" icon="palette" label="Customize" isActive={isActive("/customize")} />
            <SidebarLink href="/upgrade" icon="upgrade" label="Upgrade Plan" isActive={isActive("/upgrade")} />
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
        </div>
      )}
    </nav>
  );
}

interface NavItemProps {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
  collapsed: boolean;
  badge?: string;
}

function NavItem({ href, icon, label, isActive, collapsed, badge }: NavItemProps) {
  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              href={href}
              className={`flex items-center justify-center h-10 my-1 mx-2 rounded-md ${isActive 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <span className={`material-icons ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {icon}
              </span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <Link 
      href={href}
      className={`flex items-center px-4 py-2 ${isActive 
        ? "text-foreground bg-muted border-l-4 border-primary" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <span className={`material-icons mr-3 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded flex-shrink-0">
          {badge}
        </span>
      )}
    </Link>
  );
}

interface SidebarLinkProps {
  href: string;
  icon: string;
  label: string;
  isActive: boolean;
  badge?: string;
}

function SidebarLink({ href, icon, label, isActive, badge }: SidebarLinkProps) {
  return (
    <Link 
      href={href}
      className={`flex items-center px-4 py-2 ${isActive 
        ? "text-foreground bg-muted border-l-4 border-primary" 
        : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <span className={`material-icons mr-3 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded flex-shrink-0">
          {badge}
        </span>
      )}
    </Link>
  );
}