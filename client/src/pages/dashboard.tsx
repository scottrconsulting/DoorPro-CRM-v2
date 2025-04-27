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

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-sans text-neutral-800">
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-neutral-500">Here's your activity summary for today</p>
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Today's Visits"
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
          title="Conversions"
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
          title="Follow-ups"
          value={followUps.length}
          icon="schedule"
          iconBgColor="bg-yellow-100"
          trend={{
            value: "2",
            label: "urgent today",
            isPositive: false
          }}
        />
        
        {/* Territory stat card removed as requested */}
      </div>

      {/* Map Section - Enhanced with ability to click on houses */}
      <EnhancedMapViewer onSelectContact={handleContactSelect} />

      {/* Recent Contacts & Schedule Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <ContactList />
        </div>
        <ScheduleWidget />
      </div>
      
      {/* Feature Highlights - For Free Account */}
      {user?.role === 'free' && (
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="font-medium text-neutral-800">Upgrade to DoorPro CRM Pro</h2>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PRO_FEATURES.slice(0, 3).map((feature, index) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-4 flex flex-col">
                  <span className={`material-icons text-primary text-xl mb-2`}>{feature.icon}</span>
                  <h3 className="text-sm font-medium text-neutral-800 mb-1">{feature.title}</h3>
                  <p className="text-sm text-neutral-600 flex-grow">{feature.description}</p>
                  <span className="mt-2 text-xs bg-neutral-100 text-neutral-500 px-2 py-1 rounded">Pro Feature</span>
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
