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
import SimpleLogin from "@/pages/simple-login";
import LoginFix from "@/pages/login-fix";
import Register from "@/pages/register";
import EnhancedRegister from "@/pages/enhanced-register";
import EmailVerification from "@/pages/email-verification";
import Upgrade from "@/pages/upgrade";
import Settings from "@/pages/settings";
import Customize from "@/pages/customize";
import CustomizeMessageTemplates from "@/pages/customize-message-templates";
import Chat from "@/pages/chat-improved";
import Routes from "@/pages/routes";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import AutoLogin from "@/pages/auto-login";
import AppShell from "@/components/layout/app-shell";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useDirectAuth } from "@/hooks/use-direct-auth";
import { useEffect, useState } from "react";

// Import our tour provider
import { TourProvider } from "@/contexts/tour-context";

// Import our new simple protected route
import SimpleProtectedRoute from "./components/SimpleProtectedRoute";

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
          <TourProvider>
            <Router>
              <Toaster />
              {mounted && (
                <Switch>
                  <Route path="/auto-login">
                    <AutoLogin />
                  </Route>
                  <Route path="/login">
                    <DirectLogin />
                  </Route>
                  <Route path="/direct-login">
                    <DirectLogin />
                  </Route>
                  <Route path="/register">
                    <EnhancedRegister />
                  </Route>
                  <Route path="/register-classic">
                    <Register />
                  </Route>
                  <Route path="/verify-email">
                    <EmailVerification />
                  </Route>
                  <Route path="/forgot-password">
                    <ForgotPassword />
                  </Route>
                  <Route path="/reset-password">
                    <ResetPassword />
                  </Route>
                  <Route path="/*">
                    <SimpleProtectedRoute>
                      <AppShell>
                        <Switch>
                          <Route path="/">
                            <Dashboard />
                          </Route>
                          {/* Temporarily hidden until core features are stable */}
                          <Route path="/territories">
                            <NotFound />
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
                          {/* Temporarily hidden until core features are stable */}
                          <Route path="/teams">
                            <NotFound />
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
                          {/* Temporarily hidden until core features are stable */}
                          <Route path="/chat">
                            <NotFound />
                          </Route>
                          <Route path="/routes">
                            <Routes />
                          </Route>
                          <Route>
                            <NotFound />
                          </Route>
                        </Switch>
                      </AppShell>
                    </SimpleProtectedRoute>
                  </Route>
                </Switch>
              )}
            </Router>
          </TourProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
