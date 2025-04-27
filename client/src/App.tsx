import { Route, Switch, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Territories from "@/pages/territories";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Schedule from "@/pages/schedule";
import Teams from "@/pages/enhanced-teams";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import DirectLogin from "@/pages/direct-login";
import Register from "@/pages/register";
import Upgrade from "@/pages/upgrade";
import Settings from "@/pages/settings";
import Customize from "@/pages/customize";
import CustomizeMessageTemplates from "@/pages/customize-message-templates";
import Chat from "@/pages/chat";
import Routes from "@/pages/routes";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AutoLogin from "@/pages/auto-login";
import AppShell from "@/components/layout/app-shell";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useDirectAuth } from "@/hooks/use-direct-auth";
import { useEffect, useState } from "react";

// Enhanced protected route component that works with both auth systems
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated: isAuthAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { isAuthenticated: isDirectAuthenticated, isLoading: isDirectLoading } = useDirectAuth();
  const [_, navigate] = useLocation();
  
  // Combined auth state - user is authenticated if either system authenticates them
  const isAuthenticated = isAuthAuthenticated || isDirectAuthenticated;
  const isLoading = isAuthLoading && isDirectLoading; // Only loading if both are loading
  
  useEffect(() => {
    // Log authentication state for debugging
    console.log("Protected route - Auth state:", { 
      standard: { isAuthAuthenticated, isAuthLoading },
      token: { isDirectAuthenticated, isDirectLoading },
      combined: { isAuthenticated, isLoading }
    });
    
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, isAuthAuthenticated, isDirectAuthenticated, navigate]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : null;
};

function App() {
  const [mounted, setMounted] = useState(false);

  // After hydration, we can show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <TooltipProvider>
          <Router>
            <Toaster />
            {mounted && (
              <Switch>
                <Route path="/auto-login">
                  <AutoLogin />
                </Route>
                <Route path="/login">
                  <Login />
                </Route>
                <Route path="/direct-login">
                  <DirectLogin />
                </Route>
                <Route path="/register">
                  <Register />
                </Route>
                <Route path="/forgot-password">
                  <ForgotPassword />
                </Route>
                <Route path="/reset-password">
                  <ResetPassword />
                </Route>
                <Route path="/*">
                  <ProtectedRoute>
                    <AppShell>
                      <Switch>
                        <Route path="/">
                          <Dashboard />
                        </Route>
                        <Route path="/territories">
                          <Territories />
                        </Route>
                        <Route path="/contacts/:id">
                          <ContactDetail />
                        </Route>
                        <Route path="/contacts">
                          <Contacts />
                        </Route>
                        <Route path="/schedule">
                          <Schedule />
                        </Route>
                        <Route path="/teams">
                          <Teams />
                        </Route>
                        <Route path="/reports">
                          <Reports />
                        </Route>
                        <Route path="/upgrade">
                          <Upgrade />
                        </Route>
                        <Route path="/settings">
                          <Settings />
                        </Route>
                        <Route path="/customize">
                          <Customize />
                        </Route>
                        <Route path="/customize-message-templates">
                          <CustomizeMessageTemplates />
                        </Route>
                        <Route path="/chat">
                          <Chat />
                        </Route>
                        <Route path="/routes">
                          <Routes />
                        </Route>
                        <Route>
                          <NotFound />
                        </Route>
                      </Switch>
                    </AppShell>
                  </ProtectedRoute>
                </Route>
              </Switch>
            )}
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
