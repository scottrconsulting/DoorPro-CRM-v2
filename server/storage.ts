import {
  users,
  contacts,
  visits,
  schedules,
  territories,
  type User,
  type InsertUser,
  type Contact,
  type InsertContact,
  type Visit,
  type InsertVisit,
  type Schedule,
  type InsertSchedule,
  type Territory,
  type InsertTerritory
} from "@shared/schema";

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
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<boolean>;
  
  // Visit operations
  getVisit(id: number): Promise<Visit | undefined>;
  getVisitsByContact(contactId: number): Promise<Visit[]>;
  getVisitsByUser(userId: number): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  
  // Schedule operations
  getSchedule(id: number): Promise<Schedule | undefined>;
  getSchedulesByUser(userId: number): Promise<Schedule[]>;
  getSchedulesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Schedule[]>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  updateSchedule(id: number, updates: Partial<Schedule>): Promise<Schedule | undefined>;
  deleteSchedule(id: number): Promise<boolean>;
  
  // Territory operations
  getTerritory(id: number): Promise<Territory | undefined>;
  getTerritoriesByUser(userId: number): Promise<Territory[]>;
  createTerritory(territory: InsertTerritory): Promise<Territory>;
  updateTerritory(id: number, updates: Partial<Territory>): Promise<Territory | undefined>;
  deleteTerritory(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contacts: Map<number, Contact>;
  private visits: Map<number, Visit>;
  private schedules: Map<number, Schedule>;
  private territories: Map<number, Territory>;
  private userId: number;
  private contactId: number;
  private visitId: number;
  private scheduleId: number;
  private territoryId: number;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.visits = new Map();
    this.schedules = new Map();
    this.territories = new Map();
    this.userId = 1;
    this.contactId = 1;
    this.visitId = 1;
    this.scheduleId = 1;
    this.territoryId = 1;
    
    // Add admin user
    this.createUser({
      username: "admin",
      password: "admin123", // In a real app, this would be hashed
      email: "admin@doorprocrm.com",
      fullName: "System Admin",
      role: "admin"
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Contact operations
  async getContact(id: number): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContactsByUser(userId: number): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter(
      (contact) => contact.userId === userId
    );
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = this.contactId++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const contact: Contact = { ...insertContact, id, createdAt, updatedAt };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = await this.getContact(id);
    if (!contact) return undefined;
    
    const updatedContact = { ...contact, ...updates, updatedAt: new Date() };
    this.contacts.set(id, updatedContact);
    return updatedContact;
  }

  async deleteContact(id: number): Promise<boolean> {
    return this.contacts.delete(id);
  }

  // Visit operations
  async getVisit(id: number): Promise<Visit | undefined> {
    return this.visits.get(id);
  }

  async getVisitsByContact(contactId: number): Promise<Visit[]> {
    return Array.from(this.visits.values()).filter(
      (visit) => visit.contactId === contactId
    );
  }

  async getVisitsByUser(userId: number): Promise<Visit[]> {
    return Array.from(this.visits.values()).filter(
      (visit) => visit.userId === userId
    );
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    const id = this.visitId++;
    const visit: Visit = { ...insertVisit, id };
    this.visits.set(id, visit);
    return visit;
  }

  // Schedule operations
  async getSchedule(id: number): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }

  async getSchedulesByUser(userId: number): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => schedule.userId === userId
    );
  }

  async getSchedulesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Schedule[]> {
    return Array.from(this.schedules.values()).filter(
      (schedule) => 
        schedule.userId === userId && 
        schedule.startTime >= startDate && 
        schedule.startTime <= endDate
    );
  }

  async createSchedule(insertSchedule: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleId++;
    const createdAt = new Date();
    const schedule: Schedule = { ...insertSchedule, id, createdAt };
    this.schedules.set(id, schedule);
    return schedule;
  }

  async updateSchedule(id: number, updates: Partial<Schedule>): Promise<Schedule | undefined> {
    const schedule = await this.getSchedule(id);
    if (!schedule) return undefined;
    
    const updatedSchedule = { ...schedule, ...updates };
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    return this.schedules.delete(id);
  }

  // Territory operations
  async getTerritory(id: number): Promise<Territory | undefined> {
    return this.territories.get(id);
  }

  async getTerritoriesByUser(userId: number): Promise<Territory[]> {
    return Array.from(this.territories.values()).filter(
      (territory) => territory.userId === userId
    );
  }

  async createTerritory(insertTerritory: InsertTerritory): Promise<Territory> {
    const id = this.territoryId++;
    const createdAt = new Date();
    const territory: Territory = { ...insertTerritory, id, createdAt };
    this.territories.set(id, territory);
    return territory;
  }

  async updateTerritory(id: number, updates: Partial<Territory>): Promise<Territory | undefined> {
    const territory = await this.getTerritory(id);
    if (!territory) return undefined;
    
    const updatedTerritory = { ...territory, ...updates };
    this.territories.set(id, updatedTerritory);
    return updatedTerritory;
  }

  async deleteTerritory(id: number): Promise<boolean> {
    return this.territories.delete(id);
  }
}

// Create and export an instance of the storage
export const storage = new MemStorage();
