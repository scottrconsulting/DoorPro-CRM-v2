import { ReactNode, useState, useEffect } from "react";
import Sidebar from "@/components/common/sidebar";
import MobileMenu from "@/components/common/mobile-menu";
import { useAuth } from "@/hooks/use-auth";
import { getPlanName } from "@/lib/auth";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { DoorProLogo } from "@/components/ui/door-pro-logo";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const isMobile = useIsMobile();
  // Track user's online status
  const { isActive } = useOnlineStatus();

  // Close mobile menu on route change
  useEffect(() => {
    if (!isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 bg-background shadow-sm border-b border-border md:hidden z-10">
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-full hover:bg-muted text-foreground"
            aria-label="Menu"
          >
            <span className="material-icons">menu</span>
          </button>
          <div className="flex items-center">
            <Link href="/" className="flex items-center font-sans text-lg font-semibold">
              <DoorProLogo className="mr-2" />
              <span className="text-primary">DoorPro CRM</span>
            </Link>
            <span className="ml-1 text-xs bg-neutral-200 px-1.5 py-0.5 rounded-md text-neutral-700">
              {getPlanName(user?.role)}
            </span>
          </div>
          <Link href="/settings" className="p-2 rounded-full hover:bg-neutral-100" aria-label="User menu">
            <span className="material-icons">account_circle</span>
          </Link>
        </div>
      </header>

      {/* Sidebar Navigation - Hidden on mobile */}
      <Sidebar />

      {/* Mobile Nav Menu - Slides in */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="pt-16 md:pt-0 flex-1 overflow-y-auto">
          {children}

          {/* Footer */}
          <footer className="bg-background border-t border-border py-4 px-6">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} DoorPro CRM. All rights reserved.
              </div>
              <div className="flex items-center space-x-4 mt-2 md:mt-0">
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Terms
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Privacy
                </a>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  Support
                </a>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
