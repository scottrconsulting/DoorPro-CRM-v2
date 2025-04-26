import { Switch, Route, useLocation, Router } from "wouter";
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
import Teams from "@/pages/teams";
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Upgrade from "@/pages/upgrade";
import Settings from "@/pages/settings";
import AppShell from "@/components/layout/app-shell";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

// This component is now integrated into the ProtectedRoute usage

// Protected route wrapper component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [_, navigate] = useLocation();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);
  
  useEffect(() => {
    // Log authentication state for debugging
    console.log("Auth state:", { isAuthenticated, isLoading });
  }, [isAuthenticated, isLoading]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }

  // Include the component directly in render, not as function call
  return <Component />;
}

function AuthRouter() {
  return (
    <>
      <Route path="/login"><Login /></Route>
      <Route path="/register"><Register /></Route>
      
      {/* Protected routes */}
      <Route path="/">
        <ProtectedRoute component={() => (
          <AppShell>
            <Route path="/"><Dashboard /></Route>
            <Route path="/territories"><Territories /></Route>
            <Route path="/contacts"><Contacts /></Route>
            <Route path="/contacts/:id"><ContactDetail /></Route>
            <Route path="/schedule"><Schedule /></Route>
            <Route path="/teams"><Teams /></Route>
            <Route path="/reports"><Reports /></Route>
            <Route path="/upgrade"><Upgrade /></Route>
            <Route path="/settings"><Settings /></Route>
            <Route path="/:rest*"><NotFound /></Route>
          </AppShell>
        )} />
      </Route>
    </>
  );
}

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
            {mounted && <AuthRouter />}
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
