import {
  users,
  contacts,
  visits,
  schedules,
  territories,
  sales,
  tasks,
  documents,
  type User,
  type InsertUser,
  type Contact,
  type InsertContact,
  type Visit,
  type InsertVisit,
  type Schedule,
  type InsertSchedule,
  type Territory,
  type InsertTerritory,
  type Sale,
  type InsertSale,
  type Task,
  type InsertTask,
  type Document,
  type InsertDocument
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, gte, lte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Contact operations
  getContact(id: number): Promise<Contact | undefined>;
  getContactsByUser(userId: number): Promise<Contact[]>;
  getContactsByStatus(userId: number, status: string): Promise<Contact[]>;
  getContactsByTag(userId: number, tag: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Visit operations
  getVisit(id: number): Promise<Visit | undefined>;
  getVisitsByContact(contactId: number): Promise<Visit[]>;
  getVisitsByUser(userId: number): Promise<Visit[]>;
  getVisitsByDate(userId: number, date: Date): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: number, updates: Partial<Visit>): Promise<Visit | undefined>;
  
  // Schedule operations
  getSchedule(id: number): Promise<Schedule | undefined>;
  getSchedulesByUser(userId: number): Promise<Schedule[]>;
  getSchedulesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Schedule[]>;
  getSchedulesByContact(contactId: number): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, updates: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: number): Promise<boolean>;
  
  // Territory operations
  getTerritory(id: number): Promise<Territory | undefined>;
  getTerritoriesByUser(userId: number): Promise<Territory[]>;
  createTerritory(territory: InsertTerritory): Promise<Territory>;
  updateTerritory(id: number, updates: Partial<Territory>): Promise<Territory | undefined>;
  deleteTerritory(id: number): Promise<boolean>;
  
  // Sale operations
  getSale(id: number): Promise<Sale | undefined>;
  getSalesByUser(userId: number): Promise<Sale[]>;
  getSalesByContact(contactId: number): Promise<Sale[]>;
  getSalesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Sale[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: number, updates: Partial<Sale>): Promise<Sale | undefined>;
  deleteSale(id: number): Promise<boolean>;
  
  // Task operations
  getTask(id: number): Promise<Task | undefined>;
  getTasksByUser(userId: number): Promise<Task[]>;
  getTasksByContact(contactId: number): Promise<Task[]>;
  getTasksByStatus(userId: number, status: string): Promise<Task[]>;
  getTasksByDueDate(userId: number, dueDate: Date): Promise<Task[]>;
  getOverdueTasks(userId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, updates: Partial<Task>): Promise<Task | undefined>;
  completeTask(id: number): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  // Document operations
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByUser(userId: number): Promise<Document[]>;
  getDocumentsByContact(contactId: number): Promise<Document[]>;
  getDocumentsByCategory(userId: number, category: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username));
      return result[0];
    } catch (error) {
      console.error("Error fetching user by username:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email));
      return result[0];
    } catch (error) {
      console.error("Error fetching user by email:", error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values(insertUser).returning();
      return result[0];
    } catch (error) {
      // Check for unique constraint violation errors
      const errorMessage = String(error);
      if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
        if (errorMessage.includes('username')) {
          throw new Error('Username already exists');
        } else if (errorMessage.includes('email')) {
          throw new Error('Email already exists');
        }
      }
      console.error("Error creating user:", error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    try {
      const result = await db.update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating user:", error);
      return undefined;
    }
  }

  // Contact operations
  async getContact(id: number): Promise<Contact | undefined> {
    try {
      const result = await db.select().from(contacts).where(eq(contacts.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching contact:", error);
      return undefined;
    }
  }

  async getContactsByUser(userId: number): Promise<Contact[]> {
    try {
      return await db.select().from(contacts).where(eq(contacts.userId, userId));
    } catch (error) {
      console.error("Error fetching contacts by user:", error);
      return [];
    }
  }
  
  async getContactsByStatus(userId: number, status: string): Promise<Contact[]> {
    try {
      return await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            eq(contacts.status, status)
          )
        );
    } catch (error) {
      console.error("Error fetching contacts by status:", error);
      return [];
    }
  }

  async getContactsByTag(userId: number, tag: string): Promise<Contact[]> {
    try {
      const result = await db.select()
        .from(contacts)
        .where(
          and(
            eq(contacts.userId, userId),
            sql`${contacts.tags} ? ${tag}`
          )
        );
      return result;
    } catch (error) {
      console.error("Error fetching contacts by tag:", error);
      return [];
    }
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    try {
      const result = await db.insert(contacts).values(insertContact).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating contact:", error);
      throw new Error('Failed to create contact');
    }
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    try {
      // Always update the updatedAt field
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date()
      };
      
      const result = await db.update(contacts)
        .set(updatesWithTimestamp)
        .where(eq(contacts.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating contact:", error);
      return undefined;
    }
  }

  async deleteContact(id: number): Promise<boolean> {
    try {
      const result = await db.delete(contacts).where(eq(contacts.id, id)).returning({ id: contacts.id });
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting contact:", error);
      return false;
    }
  }

  // Visit operations
  async getVisit(id: number): Promise<Visit | undefined> {
    try {
      const result = await db.select().from(visits).where(eq(visits.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching visit:", error);
      return undefined;
    }
  }

  async getVisitsByContact(contactId: number): Promise<Visit[]> {
    try {
      return await db.select()
        .from(visits)
        .where(eq(visits.contactId, contactId))
        .orderBy(desc(visits.visitDate));
    } catch (error) {
      console.error("Error fetching visits by contact:", error);
      return [];
    }
  }

  async getVisitsByUser(userId: number): Promise<Visit[]> {
    try {
      return await db.select()
        .from(visits)
        .where(eq(visits.userId, userId))
        .orderBy(desc(visits.visitDate));
    } catch (error) {
      console.error("Error fetching visits by user:", error);
      return [];
    }
  }
  
  async getVisitsByDate(userId: number, date: Date): Promise<Visit[]> {
    try {
      // Create start and end of the target date
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      return await db.select()
        .from(visits)
        .where(
          and(
            eq(visits.userId, userId),
            gte(visits.visitDate, startDate),
            lte(visits.visitDate, endDate)
          )
        )
        .orderBy(desc(visits.visitDate));
    } catch (error) {
      console.error("Error fetching visits by date:", error);
      return [];
    }
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    try {
      const result = await db.insert(visits).values(insertVisit).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating visit:", error);
      throw new Error('Failed to create visit');
    }
  }
  
  async updateVisit(id: number, updates: Partial<Visit>): Promise<Visit | undefined> {
    try {
      const result = await db.update(visits)
        .set(updates)
        .where(eq(visits.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating visit:", error);
      return undefined;
    }
  }

  // Schedule operations
  async getSchedule(id: number): Promise<Schedule | undefined> {
    try {
      const result = await db.select().from(schedules).where(eq(schedules.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching schedule:", error);
      return undefined;
    }
  }

  async getSchedulesByUser(userId: number): Promise<Schedule[]> {
    try {
      return await db.select()
        .from(schedules)
        .where(eq(schedules.userId, userId))
        .orderBy(asc(schedules.startTime));
    } catch (error) {
      console.error("Error fetching schedules by user:", error);
      return [];
    }
  }

  async getSchedulesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Schedule[]> {
    try {
      return await db.select()
        .from(schedules)
        .where(
          and(
            eq(schedules.userId, userId),
            gte(schedules.startTime, startDate),
            lte(schedules.startTime, endDate)
          )
        )
        .orderBy(asc(schedules.startTime));
    } catch (error) {
      console.error("Error fetching schedules by date range:", error);
      return [];
    }
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    try {
      const result = await db.insert(schedules).values(insertSchedule).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating schedule:", error);
      throw new Error('Failed to create schedule');
    }
  }

  async updateSchedule(id: number, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    try {
      const result = await db.update(schedules)
        .set(updates)
        .where(eq(schedules.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating schedule:", error);
      return undefined;
    }
  }

  async deleteSchedule(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schedules).where(eq(schedules.id, id)).returning({ id: schedules.id });
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting schedule:", error);
      return false;
    }
  }

  // Territory operations
  async getTerritory(id: number): Promise<Territory | undefined> {
    try {
      const result = await db.select().from(territories).where(eq(territories.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching territory:", error);
      return undefined;
    }
  }

  async getTerritoriesByUser(userId: number): Promise<Territory[]> {
    try {
      return await db.select().from(territories).where(eq(territories.userId, userId));
    } catch (error) {
      console.error("Error fetching territories by user:", error);
      return [];
    }
  }

  async createTerritory(insertTerritory: InsertTerritory): Promise<Territory> {
    try {
      const result = await db.insert(territories).values(insertTerritory).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating territory:", error);
      throw new Error('Failed to create territory');
    }
  }

  async updateTerritory(id: number, updates: Partial<Territory>): Promise<Territory | undefined> {
    try {
      const result = await db.update(territories)
        .set(updates)
        .where(eq(territories.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating territory:", error);
      return undefined;
    }
  }

  async deleteTerritory(id: number): Promise<boolean> {
    try {
      const result = await db.delete(territories).where(eq(territories.id, id)).returning({ id: territories.id });
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting territory:", error);
      return false;
    }
  }
}

// Create and export an instance of the database storage
export const storage = new DatabaseStorage();
