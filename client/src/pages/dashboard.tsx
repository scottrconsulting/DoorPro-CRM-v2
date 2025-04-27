import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Contact, Visit, Customization } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/stat-card";
import EnhancedMapViewer from "@/components/dashboard/enhanced-map-viewer";
import ContactList from "@/components/dashboard/contact-list";
import ScheduleWidget from "@/components/dashboard/schedule-widget";
import { PRO_FEATURES } from "@/lib/auth";
import ContactDetailModal from "@/components/contacts/contact-detail-modal";
import { format } from "date-fns";
import { DASHBOARD_WIDGETS, DASHBOARD_WIDGET_LABELS } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);

  // Fetch data for dashboard statistics
  const { data: contacts = [], refetch: refetchContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: visits = [], refetch: refetchVisits } = useQuery<Visit[]>({
    queryKey: ["/api/visits"],
  });
  
  // Get user's customization settings
  const { data: customization } = useQuery<Customization>({
    queryKey: ["/api/customizations/current"],
    enabled: !!user
  });

  // Get user's widget preferences with defaults
  const enabledWidgets = customization?.dashboardWidgets || DASHBOARD_WIDGETS;
  const widgetOrder = customization?.dashboardWidgets || DASHBOARD_WIDGETS;
  const widgetLabels = customization?.dashboardWidgetLabels || {};

  // Count today's visits
  const todayVisits = visits.filter(visit => {
    const visitDate = new Date(visit.visitDate);
    const today = new Date();
    return (
      visitDate.getDate() === today.getDate() &&
      visitDate.getMonth() === today.getMonth() &&
      visitDate.getFullYear() === today.getFullYear()
    );
  });

  // Count conversions (contacts with 'converted' status)
  const conversions = contacts.filter(contact => contact.status === "converted");
  
  // Count follow-ups (contacts with 'interested' or 'considering' status)
  const followUps = contacts.filter(
    contact => contact.status === "interested" || contact.status === "considering"
  );

  // Removed territory coverage calculation as it wasn't reflecting real stats

  const handleContactSelect = (contactId: number) => {
    setSelectedContactId(contactId);
  };

  // Render dashboard widgets in the user's custom order
  const renderWidgets = () => {
    // Filter to only enabled widgets in the correct order
    // Use non-empty enabledWidgets array, otherwise fallback to all widgets
    const filteredWidgets = (enabledWidgets.length > 0) 
      ? widgetOrder.filter(widget => enabledWidgets.includes(widget))
      : widgetOrder;
      
    return filteredWidgets.map(widgetId => {
      switch (widgetId) {
        case "stats":
          return (
            <div key="stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                title={widgetLabels["today_visits"] || DASHBOARD_WIDGET_LABELS["today_visits"]}
                value={todayVisits.length}
                icon="door_front"
                iconBgColor="bg-blue-100"
                trend={{
                  value: "20%",
                  label: "from yesterday",
                  isPositive: true
                }}
              />
              
              <StatCard
                title={widgetLabels["conversions"] || DASHBOARD_WIDGET_LABELS["conversions"]}
                value={conversions.length}
                icon="check_circle"
                iconBgColor="bg-green-100"
                trend={{
                  value: contacts.length > 0 ? `${Math.round((conversions.length / contacts.length) * 100)}%` : "0%",
                  label: "conversion rate",
                  isPositive: true
                }}
              />
              
              <StatCard
                title={widgetLabels["follow_ups"] || DASHBOARD_WIDGET_LABELS["follow_ups"]}
                value={followUps.length}
                icon="schedule"
                iconBgColor="bg-yellow-100"
                trend={{
                  value: "2",
                  label: "urgent today",
                  isPositive: false
                }}
              />
            </div>
          );
        case "map":
          return (
            <div key="map" className="mb-6">
              <EnhancedMapViewer onSelectContact={handleContactSelect} />
            </div>
          );
        case "contacts":
          return (
            <div key="contacts" className="mb-6">
              <ContactList 
                title={widgetLabels["contacts"] || DASHBOARD_WIDGET_LABELS["contacts"]} 
              />
            </div>
          );
        case "schedule":
          return (
            <div key="schedule" className="mb-6">
              <ScheduleWidget 
                title={widgetLabels["schedule"] || DASHBOARD_WIDGET_LABELS["schedule"]} 
              />
            </div>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-foreground">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-muted-foreground">Here's your activity summary for today</p>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button 
            variant="ghost" 
            className="flex items-center" 
            onClick={() => {
              refetchContacts();
              refetchVisits();
            }}
            title="Refresh data"
          >
            <span className="material-icons text-sm mr-1">refresh</span> Refresh
          </Button>
          <Link href="/contacts">
            <Button variant="outline" className="flex items-center">
              <span className="material-icons text-sm mr-1">add</span> Add Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Render widgets in user's custom order */}
      {renderWidgets()}
      
      {/* Feature Highlights - For Free Account */}
      {user?.role === 'free' && (
        <div className="mt-6 bg-background rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium text-foreground">Upgrade to DoorPro CRM Pro</h2>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRO_FEATURES.slice(0, 3).map((feature, index) => (
                <div key={index} className="border border-border rounded-lg p-4 flex flex-col">
                  <span className={`material-icons text-primary text-xl mb-2`}>{feature.icon}</span>
                  <h3 className="text-sm font-medium text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground flex-grow">{feature.description}</p>
                  <span className="mt-2 text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Pro Feature</span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-center">
              <Link href="/upgrade">
                <Button className="px-6 py-2">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Contact Detail Modal */}
      {selectedContactId && (
        <ContactDetailModal
          contactId={selectedContactId}
          isOpen={true}
          onClose={() => setSelectedContactId(null)}
        />
      )}
    </div>
  );
}
