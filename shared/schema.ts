import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Pre-defined customization options for various elements
export const PIN_COLORS = ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'teal', 'pink', 'brown', 'gray'];
export const CONTACT_STATUSES = ['not_visited', 'interested', 'not_interested', 'converted', 'considering', 'no_soliciting', 'call_back', 'appointment_scheduled', 'no_answer'];
export const QUICK_ACTIONS = ['no_answer', 'not_interested', 'call_back', 'no_soliciting'];

export const DASHBOARD_WIDGETS = [
  "stats",
  "map", 
  "contacts",
  "schedule",
  "territory_coverage",
  "contacts_added_today",
  "appointments_today",
  "recent_sales",
  "weekly_goal_progress"
];

export const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  "stats": "Statistics",
  "map": "Territory Map",
  "contacts": "Recent Contacts",
  "schedule": "Schedule",
  "today_visits": "Today's Visits",
  "conversions": "Conversions",
  "follow_ups": "Follow-ups",
  "territory_coverage": "Territory Coverage",
  "contacts_added_today": "New Contacts Today",
  "appointments_today": "Today's Appointments",
  "recent_sales": "Recent Sales",
  "weekly_goal_progress": "Weekly Goal Progress"
};

// Teams model for grouping users
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  managerId: integer("manager_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for team billing
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  subscriptionStatus: text("subscription_status"), // active, past_due, unpaid, canceled, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User model with different subscription levels
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("free"), // free, pro, admin
  teamId: integer("team_id").references(() => teams.id),
  isManager: boolean("is_manager").default(false),
  status: text("status").default("active").notNull(), // active, pending, inactive
  title: text("title"), // job title for team members
  stripeCustomerId: text("stripe_customer_id"), // Individual customer ID (if not part of a team)
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID for individual subscriptions
  subscriptionStatus: text("subscription_status"), // active, past_due, unpaid, canceled, etc.
  invitationToken: text("invitation_token"), // For team member invitations
  invitationExpiry: timestamp("invitation_expiry"), // Expiry time for invitations
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contact model for storing customers/leads
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fullName: text("full_name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull(), // interested, not_interested, converted, considering, no_soliciting
  latitude: text("latitude"),
  longitude: text("longitude"),
  notes: text("notes"),
  source: text("source"), // how the lead was acquired
  company: text("company"), // company or organization the contact belongs to
  tags: json("tags").$type<string[]>(), // tags for categorizing contacts
  customerSince: timestamp("customer_since"), // when they became a customer (if converted)
  preferredContactMethod: text("preferred_contact_method"), // email, phone, in-person
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Visit model for tracking interactions with contacts
export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  visitType: text("visit_type").notNull(), // initial, follow_up, presentation, sale, etc.
  notes: text("notes"),
  outcome: text("outcome"), // positive, negative, neutral, sale
  followUpNeeded: boolean("follow_up_needed").default(false),
  followUpDate: timestamp("follow_up_date"),
  visitDate: timestamp("visit_date").notNull().defaultNow(),
});

// Schedule model for planning routes and follow-ups
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  type: text("type").notNull(), // route, follow_up, appointment, presentation
  location: text("location"),
  contactIds: json("contact_ids").$type<number[]>(), // Array of contact IDs for routes
  reminderSent: boolean("reminder_sent").default(false),
  reminderTime: timestamp("reminder_time"), // When to send reminder
  confirmationMethod: text("confirmation_method"), // email, sms, both, none
  confirmationStatus: text("confirmation_status"), // pending, confirmed, rescheduled, cancelled
  calendarEventId: text("calendar_event_id"), // ID for external calendar integration
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Territory model for tracking sales areas
export const territories = pgTable("territories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  coordinates: json("coordinates").$type<{ lat: number; lng: number }[]>(),
  coverage: integer("coverage").default(0), // Percentage covered
  targetDensity: integer("target_density").default(0), // Target number of contacts per area
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Sales model for tracking sales/deals
export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  product: text("product").notNull(), // what was sold
  saleDate: timestamp("sale_date").notNull(),
  status: text("status").notNull(), // pending, completed, refunded, cancelled
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  commission: doublePrecision("commission"), // for sales commission tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks model for tracking to-dos and follow-ups
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").references(() => contacts.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"), // pending, completed, cancelled
  priority: text("priority").default("medium"), // low, medium, high
  completed: boolean("completed").default(false),
  completedDate: timestamp("completed_date"),
  reminderDate: timestamp("reminder_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Documents model for storing files related to contacts
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").references(() => contacts.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, image, spreadsheet, etc.
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(), // in bytes
  description: text("description"),
  category: text("category").default("general"), // contract, invoice, etc.
  uploadDate: timestamp("upload_date").notNull().defaultNow(),
});

// Customization settings model for user/team preferences
export const customizations = pgTable("customizations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  teamId: integer("team_id").references(() => teams.id),
  // App-wide customizations
  theme: text("theme").default("light"), // light, dark, system
  primaryColor: text("primary_color").default("blue"),
  colorScheme: text("color_scheme"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  fontFamily: text("font_family"),
  logoUrl: text("logo_url"),
  enableDarkMode: boolean("enable_dark_mode").default(true),
  
  // Map customizations
  pinColors: json("pin_colors").$type<Record<string, string>>().default({}), // status -> color mapping
  mapDefaultView: text("map_default_view").default("roadmap"),
  quickActions: text("quick_actions").array(), // actions available on quick-click
  
  // Form customizations
  customStatuses: text("custom_statuses").array(), // additional contact statuses
  statusLabels: json("status_labels").$type<Record<string, string>>().default({}), // custom labels for statuses
  
  // Appointment scheduling customizations
  appointmentTypes: text("appointment_types").array(), // types of appointments
  confirmationOptions: json("confirmation_options").$type<{
    sms: boolean;
    email: boolean;
    reminderTime: number; // minutes before appointment
  }>().default({}),
  
  // Dashboard customizations
  dashboardWidgets: text("dashboard_widgets").array(),
  dashboardWidgetLabels: json("dashboard_widget_labels").$type<Record<string, string>>().default({}),
  
  // Other settings
  timerSettings: json("timer_settings").$type<Record<string, any>>().default({}),
  notificationSettings: json("notification_settings").$type<Record<string, any>>().default({}),
  language: text("language").default("en"),
  dateFormat: text("date_format").default("MM/DD/YYYY"),
  timeFormat: text("time_format").default("hh:mm A"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Message templates for SMS and Email communications
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "email" or "text"
  name: text("name").notNull(),
  subject: text("subject"),  // For email templates
  body: text("body").notNull(),
  isDefault: boolean("is_default").default(false),
  isHtml: boolean("is_html").default(false),  // For email templates
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema Validation
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  invitationToken: true,
  invitationExpiry: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVisitSchema = createInsertSchema(visits).omit({
  id: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
});

export const insertTerritorySchema = createInsertSchema(territories).omit({
  id: true,
  createdAt: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadDate: true,
});

export const insertCustomizationSchema = createInsertSchema(customizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedules.$inferSelect;

export type InsertTerritory = z.infer<typeof insertTerritorySchema>;
export type Territory = typeof territories.$inferSelect;

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertCustomization = z.infer<typeof insertCustomizationSchema>;
export type Customization = typeof customizations.$inferSelect;

export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;

// Chat models for team communication
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  name: text("name"),
  teamId: integer("team_id").references(() => teams.id),
  isTeamChannel: boolean("is_team_channel").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  isAdmin: boolean("is_admin").default(false),
  lastReadTimestamp: timestamp("last_read_timestamp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  isRead: boolean("is_read").default(false),
  isUrgent: boolean("is_urgent").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat schema validation
export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

// Chat types
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;

export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;
export type ChatParticipant = typeof chatParticipants.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
