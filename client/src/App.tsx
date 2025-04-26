import { Switch, Route, useLocation } from "wouter";
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
import Reports from "@/pages/reports";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Upgrade from "@/pages/upgrade";
import Settings from "@/pages/settings";
import AppShell from "@/components/layout/app-shell";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";

function AuthenticatedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/territories" component={Territories} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/:id" component={ContactDetail} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/reports" component={Reports} />
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const [_, setLocation] = useLocation();

  // If still loading auth status, show nothing yet to prevent flashing
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      {isAuthenticated ? (
        <Route component={AuthenticatedApp} />
      ) : (
        <Route>
          {() => {
            setLocation("/login");
            return null;
          }}
        </Route>
      )}
    </Switch>
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
          <Toaster />
          {mounted && <AuthRouter />}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
