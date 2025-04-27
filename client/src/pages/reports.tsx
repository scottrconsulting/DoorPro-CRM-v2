import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Contact, Visit } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPlanAccess, UserRole } from "@/lib/auth";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export default function Reports() {
  const { user } = useAuth();
  const [hasProAccess, setHasProAccess] = useState(false);

  // Check if user has pro access
  useEffect(() => {
    if (user) {
      setHasProAccess(hasPlanAccess(user.role, UserRole.PRO));
    }
  }, [user]);

  // Get data for reports
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: hasProAccess,
  });

  const { data: visits = [], isLoading: isLoadingVisits } = useQuery<Visit[]>({
    queryKey: ["/api/visits"],
    enabled: hasProAccess,
  });

  // Calculate general stats
  const totalContacts = contacts.length;
  const totalVisits = visits.length;
  
  // Count statuses
  const contactsByStatus = contacts.reduce((acc: Record<string, number>, contact) => {
    acc[contact.status] = (acc[contact.status] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate conversion rate
  const convertedContacts = contacts.filter(contact => contact.status === "converted").length;
  const conversionRate = totalContacts > 0 ? (convertedContacts / totalContacts) * 100 : 0;
  
  // Format for pie chart
  const pieChartData = Object.entries(contactsByStatus).map(([status, count]) => {
    const label = status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return {
      name: label,
      value: count,
    };
  });
  
  // Colors for pie chart
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];
  
  // Calculate visits by day for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const formattedDate = format(date, 'yyyy-MM-dd');
    
    // Count visits for this date
    const visitsCount = visits.filter(visit => {
      const visitDate = new Date(visit.visitDate);
      return format(visitDate, 'yyyy-MM-dd') === formattedDate;
    }).length;
    
    return {
      date: format(date, 'MM/dd'),
      visits: visitsCount,
    };
  }).reverse();
  
  // Calculate visits by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const visitsByDayOfWeek = dayNames.map(day => {
    const dayIndex = dayNames.indexOf(day);
    
    // Count visits for this day of week
    const visitsCount = visits.filter(visit => {
      const visitDate = new Date(visit.visitDate);
      return getDay(visitDate) === dayIndex;
    }).length;
    
    return {
      day,
      visits: visitsCount,
    };
  });

  // If not Pro, show upgrade screen
  if (!hasProAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-2 border-primary">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <span className="material-icons text-primary text-6xl mb-4">analytics</span>
              <h2 className="text-2xl font-bold text-center mb-3">Advanced Analytics & Reports</h2>
              <p className="text-neutral-600 text-center mb-6 max-w-lg">
                Unlock detailed analytics, conversion tracking, and performance reports with a Pro subscription.
                Gain valuable insights to optimize your door-to-door sales strategy.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md mb-8">
                <div className="bg-neutral-100 rounded-lg p-3 flex items-center">
                  <span className="material-icons text-primary mr-2">check_circle</span>
                  <span className="text-sm">Conversion Analytics</span>
                </div>
                <div className="bg-neutral-100 rounded-lg p-3 flex items-center">
                  <span className="material-icons text-primary mr-2">check_circle</span>
                  <span className="text-sm">Performance Tracking</span>
                </div>
                <div className="bg-neutral-100 rounded-lg p-3 flex items-center">
                  <span className="material-icons text-primary mr-2">check_circle</span>
                  <span className="text-sm">Territory Insights</span>
                </div>
                <div className="bg-neutral-100 rounded-lg p-3 flex items-center">
                  <span className="material-icons text-primary mr-2">check_circle</span>
                  <span className="text-sm">Exportable Reports</span>
                </div>
              </div>
              <Link href="/upgrade">
                <Button size="lg" className="px-8">Upgrade to Pro</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoadingContacts || isLoadingVisits) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-sans text-neutral-800">Reports & Analytics</h1>
        <p className="text-neutral-500">Track your performance and conversion metrics</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500">Total Contacts</span>
              <span className="material-icons text-primary">people</span>
            </div>
            <div className="text-3xl font-bold">{totalContacts}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500">Total Visits</span>
              <span className="material-icons text-primary">door_front</span>
            </div>
            <div className="text-3xl font-bold">{totalVisits}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500">Conversion Rate</span>
              <span className="material-icons text-primary">trending_up</span>
            </div>
            <div className="text-3xl font-bold">{conversionRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500">Converted</span>
              <span className="material-icons text-primary">check_circle</span>
            </div>
            <div className="text-3xl font-bold">{convertedContacts}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contacts by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} contacts`, 'Count']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={last7Days}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="visits" name="Visits" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contact Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pieChartData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Contacts" fill="#3B82F6">
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="activity">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Visits by Day of Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={visitsByDayOfWeek}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="visits" name="Visits" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Today's Activity</CardTitle>
                  <div className="text-sm bg-green-100 text-green-800 rounded-full px-3 py-1">
                    {visits.filter(v => isToday(new Date(v.visitDate))).length} visits today
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80 overflow-auto">
                  <div className="text-sm text-muted-foreground mb-2">
                    {isToday(new Date()) ? "Tracking all door activity for today" : "No activity recorded today"}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits
                        .filter(visit => isToday(new Date(visit.visitDate)))
                        .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                        .map(visit => {
                          // Find the associated contact for this visit
                          const contact = contacts.find(c => c.id === visit.contactId);
                          
                          return (
                            <TableRow key={visit.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(visit.visitDate), "h:mm a")}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {contact?.address || "Unknown Address"}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  contact?.status === "converted" ? "bg-green-100 text-green-800" :
                                  contact?.status === "not_interested" ? "bg-red-100 text-red-800" :
                                  contact?.status === "appointment_scheduled" ? "bg-blue-100 text-blue-800" :
                                  "bg-gray-100 text-gray-800"
                                }`}>
                                  {contact?.status?.replace(/_/g, ' ') || "Unknown"}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {visit.notes || "No notes"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      
                      {visits.filter(visit => isToday(new Date(visit.visitDate))).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            No door activity recorded today
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Daily Activity Detail</CardTitle>
              <p className="text-sm text-muted-foreground">
                Complete record of all doors knocked and leads entered with timestamps
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits
                    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
                    .slice(0, 50) // Limit to most recent 50 for performance
                    .map(visit => {
                      // Find the associated contact for this visit
                      const contact = contacts.find(c => c.id === visit.contactId);
                      const visitDate = new Date(visit.visitDate);
                      
                      return (
                        <TableRow key={visit.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(visitDate, "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(visitDate, "h:mm a")}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {contact?.address || "Unknown Address"}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                              contact?.status === "converted" ? "bg-green-100 text-green-800" :
                              contact?.status === "not_interested" ? "bg-red-100 text-red-800" :
                              contact?.status === "appointment_scheduled" ? "bg-blue-100 text-blue-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {contact?.status?.replace(/_/g, ' ') || "Unknown"}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {visit.notes || "No notes"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  
                  {visits.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        No activity recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
