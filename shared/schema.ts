import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model with different subscription levels
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("free"), // free, pro, admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Contact model for storing customers/leads
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fullName: text("full_name").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  email: text("email"),
  status: text("status").notNull(), // interested, not_interested, converted, considering
  latitude: text("latitude"),
  longitude: text("longitude"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Visit model for tracking interactions with contacts
export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  userId: integer("user_id").notNull().references(() => users.id),
  visitType: text("visit_type").notNull(), // initial, follow_up, presentation, etc.
  notes: text("notes"),
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
  type: text("type").notNull(), // route, follow_up, appointment
  contactIds: json("contact_ids").$type<number[]>(), // Array of contact IDs for routes
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema Validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
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

// Types
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
