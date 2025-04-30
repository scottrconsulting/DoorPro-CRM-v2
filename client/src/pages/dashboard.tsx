import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Contact, Visit, Customization, Sale } from "@shared/schema";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/stat-card";
import EnhancedMapViewer from "@/components/dashboard/enhanced-map-viewer";
import ContactList from "@/components/dashboard/contact-list";
import ScheduleWidget from "@/components/dashboard/schedule-widget";
import { ActivityTrackerWidget } from "@/components/dashboard/activity-tracker-widget";
import { PRO_FEATURES } from "@/lib/auth";
import ContactCard from "@/components/contacts/contact-card";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { 
  DASHBOARD_WIDGETS, 
  DASHBOARD_WIDGET_LABELS, 
  STATISTICS_METRICS, 
  STATISTICS_METRIC_LABELS,
  STATISTICS_METRIC_ICONS 
} from "@shared/schema";
import TourGuide from "@/components/tour/tour-guide";
import { dashboardTourSteps } from "@/tours/tour-steps";
import { useTour } from "@/contexts/tour-context";
import { HelpCircle } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const { startTour, completedTours } = useTour();
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);

  // Show welcome message for new users
  useEffect(() => {
    // Check if this is the user's first time (no completed tours)
    if (Object.keys(completedTours).length === 0) {
      setShowWelcomeMessage(true);
    }
  }, [completedTours]);

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

  // Fetch sales data for statistics
  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    enabled: !!user
  });

  // Get user's widget preferences with defaults
  const enabledWidgets = customization?.dashboardWidgets || DASHBOARD_WIDGETS;
  const widgetOrder = customization?.dashboardWidgetOrder || DASHBOARD_WIDGETS;
  const widgetLabels = customization?.dashboardWidgetLabels || {};
  const metricLabels = customization?.statisticsMetricLabels || {};
  
  // Get selected statistics metrics or use defaults
  const selectedStatistics = customization?.statisticsMetrics || 
    ["today_visits", "conversions", "follow_ups", "sales_count"];

  // Define a type for statistic metrics
  type StatisticMetric = {
    value: string | number;
    trend: {
      value: string;
      label: string;
      isPositive: boolean;
    }
  };
  
  // Calculate all statistics metrics
  const statisticsData = useMemo<Record<string, StatisticMetric>>(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Filter for today's data
    const todayVisits = visits.filter(visit => {
      const visitDate = new Date(visit.visitDate);
      return (
        visitDate.getDate() === today.getDate() &&
        visitDate.getMonth() === today.getMonth() &&
        visitDate.getFullYear() === today.getFullYear()
      );
    });
    
    // Filter for yesterday's data for trend comparison
    const yesterdayVisits = visits.filter(visit => {
      const visitDate = new Date(visit.visitDate);
      return (
        visitDate.getDate() === yesterday.getDate() &&
        visitDate.getMonth() === yesterday.getMonth() &&
        visitDate.getFullYear() === yesterday.getFullYear()
      );
    });
    
    // Calculate status-based metrics
    const statusCounts = {
      converted: contacts.filter(contact => contact.status === "converted").length,
      interested: contacts.filter(contact => 
        contact.status === "interested" || contact.status === "considering"
      ).length,
      not_interested: contacts.filter(contact => contact.status === "not_interested").length,
      no_soliciting: contacts.filter(contact => contact.status === "no_soliciting").length,
      check_back: contacts.filter(contact => contact.status === "check_back").length,
      presented: contacts.filter(contact => contact.status === "presented").length,
      booked: contacts.filter(contact => contact.status === "booked").length,
      no_answer: contacts.filter(contact => contact.status === "no_answer").length,
    };
    
    // Calculate sales metrics
    const todaySales = sales.filter(sale => {
      if (!sale.saleDate) return false;
      
      // Parse the sale date string into a proper Date object
      const saleDate = new Date(sale.saleDate);
      
      // Check if it's a valid date
      if (isNaN(saleDate.getTime())) {
        console.warn("Invalid sale date found:", sale.saleDate);
        return false;
      }
      
      // Compare with today's date
      return (
        saleDate.getDate() === today.getDate() &&
        saleDate.getMonth() === today.getMonth() &&
        saleDate.getFullYear() === today.getFullYear()
      );
    });
    
    console.log("Today's sales:", todaySales);
    
    // Calculate total sales amount with better error handling
    const salesTotal = todaySales.reduce((sum, sale) => {
      // Ensure we're dealing with a numeric amount
      const amount = Number(sale.amount);
      return isNaN(amount) ? sum : sum + amount;
    }, 0);
    
    // Calculate time worked - this will be replaced by activity tracker
    // For now we'll use a simple calculation based on visits
    const totalMinutesWorked = visits.reduce((total, visit) => {
      if (!visit.visitDate) return total;
      
      // Simple calculation - assume 15 minutes per visit
      return total + 15;
    }, 0);
    
    const hoursWorked = Math.floor(totalMinutesWorked / 60);
    const minutesWorked = totalMinutesWorked % 60;
    const timeWorkedFormatted = `${hoursWorked}h ${minutesWorked}m`;
    
    return {
      today_visits: {
        value: todayVisits.length,
        trend: {
          value: yesterdayVisits.length > 0 
            ? `${Math.round((todayVisits.length / yesterdayVisits.length - 1) * 100)}%` 
            : "N/A",
          label: "from yesterday",
          isPositive: todayVisits.length >= yesterdayVisits.length
        }
      },
      conversions: {
        value: statusCounts.converted,
        trend: {
          value: contacts.length > 0 
            ? `${Math.round((statusCounts.converted / contacts.length) * 100)}%` 
            : "0%",
          label: "conversion rate",
          isPositive: true
        }
      },
      follow_ups: {
        value: statusCounts.interested,
        trend: {
          value: "2", // This would need to be calculated based on priority
          label: "urgent today",
          isPositive: false
        }
      },
      sales_count: {
        value: todaySales.length,
        trend: {
          value: todaySales.length > 0 ? "+1" : "0",
          label: "from yesterday",
          isPositive: todaySales.length > 0
        }
      },
      sales_amount: {
        value: `$${salesTotal.toFixed(2)}`,
        trend: {
          value: todaySales.length > 0 ? `$${(salesTotal / todaySales.length).toFixed(2)}` : "$0",
          label: "avg per sale",
          isPositive: todaySales.length > 0
        }
      },
      doors_knocked: {
        value: todayVisits.length,
        trend: {
          value: yesterdayVisits.length > 0 
            ? `${Math.round((todayVisits.length / yesterdayVisits.length - 1) * 100)}%` 
            : "N/A",
          label: "from yesterday",
          isPositive: todayVisits.length >= yesterdayVisits.length
        }
      },
      time_worked: {
        value: timeWorkedFormatted,
        trend: {
          value: hoursWorked > 0 ? `${(totalMinutesWorked / visits.length).toFixed(0)}m` : "0m",
          label: "avg per visit",
          isPositive: true
        }
      },
      appointments: {
        value: statusCounts.booked,
        trend: {
          value: statusCounts.booked > 0 ? "+1" : "0", 
          label: "from yesterday",
          isPositive: statusCounts.booked > 0
        }
      },
      not_interested: {
        value: statusCounts.not_interested,
        trend: {
          value: contacts.length > 0 
            ? `${Math.round((statusCounts.not_interested / contacts.length) * 100)}%` 
            : "0%",
          label: "of all contacts",
          isPositive: false
        }
      },
      no_soliciting: {
        value: statusCounts.no_soliciting,
        trend: {
          value: contacts.length > 0 
            ? `${Math.round((statusCounts.no_soliciting / contacts.length) * 100)}%` 
            : "0%",
          label: "of all contacts",
          isPositive: false
        }
      },
      check_back: {
        value: statusCounts.check_back,
        trend: {
          value: "Coming up", 
          label: "follow-ups",
          isPositive: true
        }
      },
      presented: {
        value: statusCounts.presented,
        trend: {
          value: contacts.length > 0 
            ? `${Math.round((statusCounts.presented / contacts.length) * 100)}%` 
            : "0%",
          label: "presentation rate",
          isPositive: true
        }
      }
    };
  }, [contacts, visits, sales]);

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
            <div key="stats" className="mb-6" data-tour="stat-cards">
              <p className="text-muted-foreground mb-3">Here's your activity summary for today</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {selectedStatistics.map(metricId => {
                  // Get metric data
                  const metricData = statisticsData[metricId];
                  if (!metricData) return null;
                  
                  // Get background color based on metric type
                  let iconBgColor = "bg-blue-100";
                  
                  if (metricId.includes("sale")) {
                    iconBgColor = "bg-green-100"; // Sales metrics
                  } else if (metricId.includes("time")) {
                    iconBgColor = "bg-purple-100"; // Time metrics
                  } else if (metricId === "not_interested" || metricId === "no_soliciting") {
                    iconBgColor = "bg-red-100"; // Negative metrics
                  } else if (metricId === "presented" || metricId === "check_back") {
                    iconBgColor = "bg-yellow-100"; // Potential metrics
                  } else if (metricId === "appointments" || metricId === "booked") {
                    iconBgColor = "bg-orange-100"; // Appointment metrics
                  }
                  
                  return (
                    <StatCard
                      key={metricId}
                      title={metricLabels[metricId] || STATISTICS_METRIC_LABELS[metricId] || metricId}
                      value={metricData.value}
                      icon={STATISTICS_METRIC_ICONS[metricId] || "analytics"}
                      iconBgColor={iconBgColor}
                      trend={metricData.trend}
                    />
                  );
                })}
              </div>
            </div>
          );
        case "map":
          return (
            <div key="map" className="mb-6" data-tour="map-view">
              <h2 className="font-semibold text-xl mb-3">{widgetLabels["map"] || DASHBOARD_WIDGET_LABELS["map"]}</h2>
              <div className="rounded-lg h-[500px]">
                <EnhancedMapViewer 
                  onSelectContact={(contactId) => setSelectedContactId(contactId)} 
                />
              </div>
            </div>
          );
        case "contacts":
          return (
            <div key="contacts" className="mb-6" data-tour="recent-contacts">
              <ContactList 
                title={widgetLabels["contacts"] || DASHBOARD_WIDGET_LABELS["contacts"]} 
              />
            </div>
          );
        case "schedule":
          return (
            <div key="schedule" className="mb-6" data-tour="schedule-widget">
              <ScheduleWidget 
                title={widgetLabels["schedule"] || DASHBOARD_WIDGET_LABELS["schedule"]} 
              />
            </div>
          );
        case "activity_tracker":
          return (
            <div key="activity_tracker" className="mb-6">
              <h2 className="font-semibold text-xl mb-3">
                {widgetLabels["activity_tracker"] || DASHBOARD_WIDGET_LABELS["activity_tracker"]}
              </h2>
              <ActivityTrackerWidget />
            </div>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="p-4 md:p-6">
      {/* Tour Guide Component */}
      <TourGuide steps={dashboardTourSteps} tourName="dashboard" />
      
      {/* Welcome Banner for New Users */}
      {showWelcomeMessage && (
        <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-4 bg-primary/20 rounded-full p-2">
                <span className="material-icons text-primary">emoji_objects</span>
              </div>
              <div>
                <h3 className="font-medium text-lg">Welcome to DoorPro CRM!</h3>
                <p className="text-muted-foreground">New here? Take a quick tour to learn how to get the most out of DoorPro.</p>
              </div>
            </div>
            <Button 
              onClick={() => {
                startTour('dashboard');
                setShowWelcomeMessage(false);
              }}
              className="ml-4 md:ml-0"
            >
              Start Tour
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-foreground">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
          </h1>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="mr-2"
            onClick={() => startTour('dashboard')}
            aria-label="Help"
          >
            <HelpCircle size={20} className="text-muted-foreground" />
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

      {/* Contact Card - Using new consolidated component */}
      {selectedContactId && (
        <ContactCard
          contactId={selectedContactId}
          isOpen={true}
          onClose={() => setSelectedContactId(null)}
        />
      )}
    </div>
  );
}