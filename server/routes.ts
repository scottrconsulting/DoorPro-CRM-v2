import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertContactSchema, 
  insertVisitSchema, 
  insertScheduleSchema, 
  insertTerritorySchema,
  insertTeamSchema,
  insertCustomizationSchema,
  insertMessageTemplateSchema,
  insertChatConversationSchema,
  insertChatParticipantSchema,
  insertChatMessageSchema,
  PIN_COLORS,
  CONTACT_STATUSES,
  QUICK_ACTIONS
} from "@shared/schema";
import { ZodError } from "zod";
import session from "express-session";
// No longer needed with PostgreSQL sessions
// import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup using PostgreSQL for persistent sessions
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "doorprocrm-secret",
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
      },
    })
  );

  // Passport setup
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        
        // In a production app, we would use proper password hashing here
        if (user.password !== password) {
          return done(null, false, { message: "Incorrect password." });
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Middleware to ensure the user is authenticated
  const ensureAuthenticated = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // Middleware to check if user has pro access
  const ensureProAccess = (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = req.user as any;
    if (user.role === "admin" || user.role === "pro") {
      return next();
    }
    
    res.status(403).json({ message: "This feature requires a Pro subscription" });
  };

  // Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info.message });
      
      req.login(user, (err) => {
        if (err) return next(err);
        return res.json({ user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role } });
      });
    })(req, res, next);
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username or email already exists
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const existingUserByEmail = await storage.getUserByEmail(userData.email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // In a production app, we would hash the password here
      // Check if we need to make this user an admin (using the admin flag in request)
      if (req.body.isAdmin === true) {
        userData.role = "admin";
      }
      
      const user = await storage.createUser(userData);
      
      // Automatically log in the user
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error during login after registration" });
        }
        return res.status(201).json({ user: { id: user.id, username: user.username, email: user.email, fullName: user.fullName, role: user.role } });
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ authenticated: false });
    }
    
    const user = req.user as any;
    return res.json({ 
      authenticated: true, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        fullName: user.fullName, 
        role: user.role 
      } 
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error during logout" });
      }
      return res.json({ message: "Logged out successfully" });
    });
  });

  // User search endpoint for teams feature
  app.get("/api/users/search", ensureAuthenticated, async (req, res) => {
    try {
      const username = req.query.username as string;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return sensitive information
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        teamId: user.teamId,
        isManager: user.isManager
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to search for user" });
    }
  });

  // Upgrade user to pro (in real app, this would involve payment processing)
  app.post("/api/users/upgrade", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const updatedUser = await storage.updateUser(user.id, { role: "pro" });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.json({ 
        user: { 
          id: updatedUser.id, 
          username: updatedUser.username, 
          email: updatedUser.email, 
          fullName: updatedUser.fullName, 
          role: updatedUser.role 
        } 
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to upgrade user" });
    }
  });

  // Contact routes
  app.get("/api/contacts", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const contacts = await storage.getContactsByUser(user.id);
      return res.json(contacts);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      if (contact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this contact" });
      }
      
      return res.json(contact);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Check contact limit for free users
      if (user.role === "free") {
        const existingContacts = await storage.getContactsByUser(user.id);
        if (existingContacts.length >= 50) {
          return res.status(403).json({ message: "Free plan limited to 50 contacts. Please upgrade to Pro." });
        }
      }
      
      const contactData = insertContactSchema.parse({ ...req.body, userId: user.id });
      const contact = await storage.createContact(contactData);
      return res.status(201).json(contact);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put("/api/contacts/:id", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const existingContact = await storage.getContact(contactId);
      
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      if (existingContact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this contact" });
      }
      
      const updatedContact = await storage.updateContact(contactId, req.body);
      return res.json(updatedContact);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const existingContact = await storage.getContact(contactId);
      
      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      if (existingContact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this contact" });
      }
      
      await storage.deleteContact(contactId);
      return res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Visit routes
  app.get("/api/contacts/:contactId/visits", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      if (contact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this contact's visits" });
      }
      
      const visits = await storage.getVisitsByContact(contactId);
      return res.json(visits);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.post("/api/contacts/:contactId/visits", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      if (contact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to add visits to this contact" });
      }
      
      const visitData = insertVisitSchema.parse({ ...req.body, contactId, userId: user.id });
      const visit = await storage.createVisit(visitData);
      return res.status(201).json(visit);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create visit" });
    }
  });

  // Schedule routes
  app.get("/api/schedules", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      let schedules;
      if (req.query.start && req.query.end) {
        const startDate = new Date(req.query.start as string);
        const endDate = new Date(req.query.end as string);
        schedules = await storage.getSchedulesByDateRange(user.id, startDate, endDate);
      } else {
        schedules = await storage.getSchedulesByUser(user.id);
      }
      
      return res.json(schedules);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.post("/api/schedules", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const scheduleData = insertScheduleSchema.parse({ ...req.body, userId: user.id });
      const schedule = await storage.createSchedule(scheduleData);
      return res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.put("/api/schedules/:id", ensureAuthenticated, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const existingSchedule = await storage.getSchedule(scheduleId);
      
      if (!existingSchedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      const user = req.user as any;
      if (existingSchedule.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this schedule" });
      }
      
      const updatedSchedule = await storage.updateSchedule(scheduleId, req.body);
      return res.json(updatedSchedule);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update schedule" });
    }
  });

  app.delete("/api/schedules/:id", ensureAuthenticated, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const existingSchedule = await storage.getSchedule(scheduleId);
      
      if (!existingSchedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      const user = req.user as any;
      if (existingSchedule.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this schedule" });
      }
      
      await storage.deleteSchedule(scheduleId);
      return res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete schedule" });
    }
  });

  // Team management routes
  // Get all teams managed by the user
  app.get("/api/teams", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const teams = await storage.getTeamsByManager(user.id);
      return res.json(teams);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Get a specific team
  app.get("/api/teams/:id", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can access the team
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this team" });
      }
      
      return res.json(team);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Create a new team
  app.post("/api/teams", ensureProAccess, async (req, res) => {
    try {
      const user = req.user as any;
      
      const teamData = insertTeamSchema.parse({ ...req.body, managerId: user.id });
      const team = await storage.createTeam(teamData);
      
      // Set the user as manager if they aren't already
      if (!user.isManager) {
        await storage.updateUser(user.id, { isManager: true });
      }
      
      return res.status(201).json(team);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create team" });
    }
  });

  // Update a team
  app.put("/api/teams/:id", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const existingTeam = await storage.getTeam(teamId);
      
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      if (existingTeam.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this team" });
      }
      
      const updatedTeam = await storage.updateTeam(teamId, req.body);
      return res.json(updatedTeam);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update team" });
    }
  });

  // Delete a team
  app.delete("/api/teams/:id", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const existingTeam = await storage.getTeam(teamId);
      
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      if (existingTeam.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this team" });
      }
      
      const success = await storage.deleteTeam(teamId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete team" });
      }
      
      return res.json({ message: "Team deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Get team members
  app.get("/api/teams/:id/members", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this team's members" });
      }
      
      const members = await storage.getTeamMembers(teamId);
      return res.json(members);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Add user to team
  app.post("/api/teams/:id/members", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to add members to this team" });
      }
      
      const memberId = req.body.userId;
      if (!memberId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const memberToAdd = await storage.getUser(memberId);
      if (!memberToAdd) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user's team ID
      const updatedUser = await storage.updateUser(memberId, { teamId });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to add user to team" });
      }
      
      return res.json(updatedUser);
    } catch (error) {
      return res.status(500).json({ message: "Failed to add user to team" });
    }
  });

  // Remove user from team
  app.delete("/api/teams/:teamId/members/:userId", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to remove members from this team" });
      }
      
      const memberId = parseInt(req.params.userId, 10);
      const memberToRemove = await storage.getUser(memberId);
      
      if (!memberToRemove) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (memberToRemove.teamId !== teamId) {
        return res.status(400).json({ message: "User is not a member of this team" });
      }
      
      // Remove the user from the team
      const updatedUser = await storage.updateUser(memberId, { teamId: null });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to remove user from team" });
      }
      
      return res.json({ message: "User removed from team successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove user from team" });
    }
  });
  
  // Team members routes
  app.get("/api/teams/:id/members", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can access team members
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this team's members" });
      }
      
      const members = await storage.getTeamMembers(teamId);
      return res.json(members);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch team members" });
    }
  });
  
  // Add a user to a team
  app.post("/api/teams/:id/members", ensureProAccess, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can add team members
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to add members to this team" });
      }
      
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const userToAdd = await storage.getUser(userId);
      if (!userToAdd) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is already in a team
      if (userToAdd.teamId) {
        return res.status(400).json({ message: "User is already a member of a team" });
      }
      
      // Add user to team
      const updatedUser = await storage.updateUser(userId, { teamId });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to add user to team" });
      }
      
      return res.json(updatedUser);
    } catch (error) {
      return res.status(500).json({ message: "Failed to add team member" });
    }
  });
  
  // Remove a user from a team
  app.delete("/api/teams/:teamId/members/:userId", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.teamId, 10);
      const userId = parseInt(req.params.userId, 10);
      
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can remove team members
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to remove members from this team" });
      }
      
      const userToRemove = await storage.getUser(userId);
      if (!userToRemove) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (userToRemove.teamId !== teamId) {
        return res.status(400).json({ message: "User is not a member of this team" });
      }
      
      // Remove user from team
      const updatedUser = await storage.updateUser(userId, { teamId: null });
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to remove user from team" });
      }
      
      return res.json({ message: "User removed from team successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove team member" });
    }
  });

  // Territory routes
  app.get("/api/territories", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const territories = await storage.getTerritoriesByUser(user.id);
      return res.json(territories);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch territories" });
    }
  });

  app.post("/api/territories", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const territoryData = insertTerritorySchema.parse({ ...req.body, userId: user.id });
      const territory = await storage.createTerritory(territoryData);
      return res.status(201).json(territory);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create territory" });
    }
  });

  app.put("/api/territories/:id", ensureAuthenticated, async (req, res) => {
    try {
      const territoryId = parseInt(req.params.id, 10);
      const existingTerritory = await storage.getTerritory(territoryId);
      
      if (!existingTerritory) {
        return res.status(404).json({ message: "Territory not found" });
      }
      
      const user = req.user as any;
      if (existingTerritory.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this territory" });
      }
      
      const updatedTerritory = await storage.updateTerritory(territoryId, req.body);
      return res.json(updatedTerritory);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update territory" });
    }
  });

  app.delete("/api/territories/:id", ensureAuthenticated, async (req, res) => {
    try {
      const territoryId = parseInt(req.params.id, 10);
      const existingTerritory = await storage.getTerritory(territoryId);
      
      if (!existingTerritory) {
        return res.status(404).json({ message: "Territory not found" });
      }
      
      const user = req.user as any;
      if (existingTerritory.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this territory" });
      }
      
      await storage.deleteTerritory(territoryId);
      return res.json({ message: "Territory deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete territory" });
    }
  });

  // Reports routes (Pro feature)
  // Get all visits for a user
  app.get("/api/visits", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const visits = await storage.getVisitsByUser(user.id);
      return res.json(visits);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch visits" });
    }
  });

  app.get("/api/reports", ensureProAccess, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Get all user contacts
      const contacts = await storage.getContactsByUser(user.id);
      
      // Get all user visits
      const visits = await storage.getVisitsByUser(user.id);
      
      // Calculate statistics
      const totalContacts = contacts.length;
      
      // Count contacts by status
      const contactsByStatus = contacts.reduce((acc: Record<string, number>, contact) => {
        acc[contact.status] = (acc[contact.status] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate conversion rate
      const convertedContacts = contacts.filter(contact => contact.status === "converted").length;
      const conversionRate = totalContacts > 0 ? (convertedContacts / totalContacts) * 100 : 0;
      
      // Recent activity
      const recentVisits = visits
        .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())
        .slice(0, 10);
      
      return res.json({
        totalContacts,
        contactsByStatus,
        conversionRate,
        recentVisits,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to generate reports" });
    }
  });

  // Customization routes
  app.get("/api/customizations/current", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const customization = await storage.getCustomizationByUser(user.id);
      
      if (!customization) {
        // Return default customization settings
        return res.json({
          id: 0,
          userId: user.id,
          teamId: null,
          theme: "light",
          primaryColor: "blue",
          pinColors: Object.fromEntries(CONTACT_STATUSES.map((status, i) => [status, PIN_COLORS[i % PIN_COLORS.length]])),
          quickActions: QUICK_ACTIONS,
          customStatuses: [],
          customFields: [],
          appointmentTypes: ["Sales Presentation", "Product Demo", "Follow-up Meeting", "Installation"],
          confirmationOptions: {
            sms: true,
            email: true,
            reminderTime: 30
          },
          noteTemplates: {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      return res.json(customization);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch customization settings" });
    }
  });
  
  app.put("/api/customizations/current", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const existingCustomization = await storage.getCustomizationByUser(user.id);
      
      if (existingCustomization) {
        // Update existing customization
        const updatedCustomization = await storage.updateCustomization(existingCustomization.id, {
          ...req.body,
          userId: user.id
        });
        return res.json(updatedCustomization);
      } else {
        // Create new customization
        const customization = await storage.createCustomization({
          ...req.body,
          userId: user.id
        });
        return res.status(201).json(customization);
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to update customization settings" });
    }
  });
  
  // Message Template routes
  app.get("/api/message-templates", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const templates = await storage.getMessageTemplatesByUser(user.id);
      return res.json(templates);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.get("/api/message-templates/type/:type", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const templateType = req.params.type;
      
      if (templateType !== 'email' && templateType !== 'text') {
        return res.status(400).json({ message: "Invalid template type. Type must be 'email' or 'text'" });
      }
      
      const templates = await storage.getMessageTemplatesByType(user.id, templateType);
      return res.json(templates);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch message templates" });
    }
  });

  app.get("/api/message-templates/default/:type", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const templateType = req.params.type;
      
      if (templateType !== 'email' && templateType !== 'text') {
        return res.status(400).json({ message: "Invalid template type. Type must be 'email' or 'text'" });
      }
      
      const template = await storage.getDefaultMessageTemplate(user.id, templateType);
      
      if (!template) {
        return res.status(404).json({ message: "Default template not found" });
      }
      
      return res.json(template);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch default message template" });
    }
  });

  app.get("/api/message-templates/:id", ensureAuthenticated, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id, 10);
      const template = await storage.getMessageTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Message template not found" });
      }
      
      const user = req.user as any;
      if (template.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this template" });
      }
      
      return res.json(template);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch message template" });
    }
  });

  app.post("/api/message-templates", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Limit number of templates for free users
      if (user.role === "free") {
        const existingTemplates = await storage.getMessageTemplatesByUser(user.id);
        if (existingTemplates.length >= 3) {
          return res.status(403).json({ message: "Free plan limited to 3 message templates. Please upgrade to Pro." });
        }
      }
      
      const templateData = insertMessageTemplateSchema.parse({ 
        ...req.body, 
        userId: user.id 
      });
      
      // Validate template type
      if (templateData.type !== 'email' && templateData.type !== 'text') {
        return res.status(400).json({ message: "Invalid template type. Type must be 'email' or 'text'" });
      }
      
      // If it's an email template with isHtml = true, ensure the body has valid HTML
      if (templateData.type === 'email' && templateData.isHtml && !templateData.body.includes('<')) {
        return res.status(400).json({ message: "HTML templates must contain valid HTML markup" });
      }
      
      const template = await storage.createMessageTemplate(templateData);
      return res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create message template" });
    }
  });

  app.put("/api/message-templates/:id", ensureAuthenticated, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id, 10);
      const existingTemplate = await storage.getMessageTemplate(templateId);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: "Message template not found" });
      }
      
      const user = req.user as any;
      if (existingTemplate.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update this template" });
      }
      
      // Validate template type if being changed
      if (req.body.type && req.body.type !== 'email' && req.body.type !== 'text') {
        return res.status(400).json({ message: "Invalid template type. Type must be 'email' or 'text'" });
      }
      
      // If it's an email template with isHtml = true, ensure the body has valid HTML
      if (
        (existingTemplate.type === 'email' || req.body.type === 'email') &&
        (req.body.isHtml || (existingTemplate.isHtml && req.body.isHtml !== false)) &&
        req.body.body && !req.body.body.includes('<')
      ) {
        return res.status(400).json({ message: "HTML templates must contain valid HTML markup" });
      }
      
      const updatedTemplate = await storage.updateMessageTemplate(templateId, req.body);
      return res.json(updatedTemplate);
    } catch (error) {
      return res.status(500).json({ message: "Failed to update message template" });
    }
  });

  app.delete("/api/message-templates/:id", ensureAuthenticated, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id, 10);
      const existingTemplate = await storage.getMessageTemplate(templateId);
      
      if (!existingTemplate) {
        return res.status(404).json({ message: "Message template not found" });
      }
      
      const user = req.user as any;
      if (existingTemplate.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this template" });
      }
      
      await storage.deleteMessageTemplate(templateId);
      return res.json({ message: "Message template deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete message template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
