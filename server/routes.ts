import express, { type Express, type Request, type Response } from "express";
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
  QUICK_ACTIONS,
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET_LABELS
} from "@shared/schema";
import { ZodError } from "zod";
import session from "express-session";
// No longer needed with PostgreSQL sessions
// import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { 
  stripe, 
  getOrCreateCustomer, 
  createSubscription, 
  updateSubscriptionQuantity, 
  cancelSubscription, 
  createTeamMemberCheckoutSession, 
  createSetupIntent,
  constructEventFromPayload,
  TEAM_MEMBER_PRICE_ID
} from "./stripe";
import type Stripe from 'stripe';
import { verifyPassword, generateResetToken, hashPassword } from './utils/password';
import { sendPasswordResetEmail, initializeSendGrid } from './utils/email';

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup using PostgreSQL for persistent sessions
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "doorprocrm-secret",
      resave: false,
      saveUninitialized: true, // Changed to true to create sessions for all users
      store: storage.sessionStore,
      cookie: { 
        // Set secure based on environment, but allow non-secure cookies for local testing
        secure: false, // Don't require HTTPS for cookies
        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
        sameSite: 'lax', // Allow cross-site usage for redirects
      },
    })
  );

  // Passport setup
  app.use(passport.initialize());
  app.use(passport.session());

  // Use the password verification utility imported at the top level

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Authentication attempt for username: ${username}`);
        
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log(`No user found with username: ${username}`);
          return done(null, false, { message: "Incorrect username." });
        }
        
        console.log(`User found: ${user.id}, email: ${user.email}`);
        
        // Special case for admin user
        if (user.email === 'scottrconsulting@gmail.com' && user.username === 'admin') {
          console.log("Admin user detected, doing special password check");
          
          // For admin, allow either the original password or the hashed version
          if (user.password === 'password' || (user.password.includes(':') && verifyPassword(user.password, password))) {
            console.log("Admin password verified successfully");
            return done(null, user);
          }
        }
        // For other users, try normal verification
        else {
          // Check if password is hashed (contains a dot from salt.hash format)
          if (user.password.includes('.') && verifyPassword(user.password, password)) {
            console.log("Hashed password verified successfully");
            return done(null, user);
          } 
          // Legacy case - plain text password
          else if (user.password === password) {
            console.log("Legacy plaintext password verified");
            return done(null, user);
          }
        }
        
        console.log("Password verification failed");
        return done(null, false, { message: "Incorrect password." });
      } catch (err) {
        console.error("Authentication error:", err);
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
    console.log("Login attempt for username:", req.body.username);
    
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Authentication failed:", info?.message || "Unknown reason");
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      console.log("Authentication successful for user ID:", user.id);
      
      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return next(err);
        }
        console.log("Session created successfully");
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
  
  // Initialize SendGrid
  const sendGridInitialized = initializeSendGrid();
  
  // Forgot password endpoint
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal that the email doesn't exist for security reasons
        return res.status(200).json({ message: "If that email exists, a password reset link has been sent" });
      }
      
      // Generate reset token and set expiry (1 hour from now)
      const resetToken = generateResetToken();
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);
      
      // Save the token to the user's record
      await storage.setPasswordResetToken(email, resetToken, resetTokenExpiry);
      
      // Determine base URL from request
      const protocol = req.secure ? 'https' : 'http';
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      if (sendGridInitialized) {
        // Send the reset email
        const emailSent = await sendPasswordResetEmail(user.email, resetToken, baseUrl);
        
        if (!emailSent) {
          // Email failed to send, but don't reveal this to the user
          console.error(`Failed to send password reset email to ${user.email}`);
        }
      } else {
        console.warn("SendGrid not initialized - no email will be sent. Token:", resetToken);
      }
      
      // Always return success to prevent email enumeration attacks
      return res.status(200).json({ 
        message: "If that email exists, a password reset link has been sent",
        // Only for development purposes, remove in production:
        debug: sendGridInitialized ? "Email sent successfully" : `SendGrid not initialized. Reset token: ${resetToken}`
      });
      
    } catch (error) {
      console.error("Error in forgot password:", error);
      return res.status(500).json({ message: "An error occurred while processing your request" });
    }
  });
  
  // Verify reset token
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const user = await storage.getUserByResetToken(token as string);
      
      if (!user || !user.resetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      return res.status(200).json({ message: "Token is valid", email: user.email });
      
    } catch (error) {
      console.error("Error verifying reset token:", error);
      return res.status(500).json({ message: "An error occurred while verifying the token" });
    }
  });
  
  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      const user = await storage.getUserByResetToken(token);
      
      if (!user || !user.resetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Hash the new password
      const hashedPassword = hashPassword(password);
      
      // Update password and clear reset token
      await storage.updatePassword(user.id, hashedPassword);
      await storage.clearPasswordResetToken(user.id);
      
      return res.status(200).json({ message: "Password has been reset successfully" });
      
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "An error occurred while resetting the password" });
    }
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
      
      // Handle date conversion properly
      let visitData = { ...req.body, contactId, userId: user.id };
      
      if (visitData.followUpDate && typeof visitData.followUpDate === 'string') {
        visitData.followUpDate = new Date(visitData.followUpDate);
      }
      
      if (visitData.visitDate && typeof visitData.visitDate === 'string') {
        visitData.visitDate = new Date(visitData.visitDate);
      } else if (!visitData.visitDate) {
        visitData.visitDate = new Date();
      }
      
      console.log("Creating contact visit with data:", visitData);
      const visit = await storage.createVisit(visitData);
      return res.status(201).json(visit);
    } catch (error) {
      console.error("Error creating contact visit:", error);
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
      
      // If the team has a Stripe subscription, we should adjust the quantity
      if (team.stripeSubscriptionId && team.stripeCustomerId) {
        try {
          // Get current team members count
          const members = await storage.getTeamMembers(teamId);
          
          // Update subscription quantity
          await updateSubscriptionQuantity(team.stripeSubscriptionId, members.length);
        } catch (stripeError) {
          console.error("Failed to update subscription quantity:", stripeError);
          // We still return success for the user removal since that worked
        }
      }
      
      return res.json({ message: "User removed from team successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove team member" });
    }
  });

  // Team Subscription routes
  app.post("/api/teams/:id/subscription", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can create a subscription
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to create a subscription for this team" });
      }
      
      // Check if the team already has a subscription
      if (team.stripeSubscriptionId && team.subscriptionStatus === 'active') {
        return res.status(400).json({ message: "Team already has an active subscription" });
      }
      
      // Get or create Stripe customer
      let stripeCustomerId = team.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await getOrCreateCustomer({
          email: user.email,
          name: team.name,
          userId: user.id
        });
        
        // Save the customer ID to the team
        await storage.updateTeamStripeInfo(teamId, stripeCustomerId);
      }
      
      // Get number of team members for initial quantity
      const members = await storage.getTeamMembers(teamId);
      
      // Create a subscription
      const subscription = await createSubscription({
        customerId: stripeCustomerId,
        priceId: TEAM_MEMBER_PRICE_ID,
        quantity: members.length || 1 // At least 1 team member (the manager)
      });
      
      // Update team with subscription info
      await storage.updateTeamStripeInfo(
        teamId, 
        stripeCustomerId, 
        subscription.id,
        subscription.status
      );
      
      // Send back the client secret for the frontend to confirm the payment
      const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
      
      return res.json({
        subscriptionId: subscription.id,
        clientSecret,
        status: subscription.status
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create subscription", error: error.message });
    }
  });
  
  app.get("/api/teams/:id/subscription", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can view subscription details
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to view subscription details for this team" });
      }
      
      if (!team.stripeSubscriptionId) {
        return res.json({ status: "no_subscription" });
      }
      
      // Retrieve current subscription status from Stripe
      const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
      
      // If status changed, update in our database
      if (subscription.status !== team.subscriptionStatus) {
        await storage.updateTeamStripeInfo(
          teamId,
          team.stripeCustomerId,
          team.stripeSubscriptionId,
          subscription.status
        );
      }
      
      return res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        items: subscription.items.data
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to retrieve subscription", error: error.message });
    }
  });
  
  app.post("/api/teams/:id/subscription/cancel", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can cancel a subscription
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to cancel subscription for this team" });
      }
      
      if (!team.stripeSubscriptionId) {
        return res.status(400).json({ message: "Team has no active subscription" });
      }
      
      // Cancel the subscription at the end of the current period
      const updatedSubscription = await stripe.subscriptions.update(team.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
      
      await storage.updateTeamStripeInfo(
        teamId,
        team.stripeCustomerId,
        team.stripeSubscriptionId,
        updatedSubscription.status
      );
      
      return res.json({
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to cancel subscription", error: error.message });
    }
  });
  
  app.post("/api/teams/:id/subscription/reactivate", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can reactivate a subscription
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to reactivate subscription for this team" });
      }
      
      if (!team.stripeSubscriptionId) {
        return res.status(400).json({ message: "Team has no subscription to reactivate" });
      }
      
      // Reactivate by setting cancel_at_period_end to false
      const updatedSubscription = await stripe.subscriptions.update(team.stripeSubscriptionId, {
        cancel_at_period_end: false
      });
      
      await storage.updateTeamStripeInfo(
        teamId,
        team.stripeCustomerId,
        team.stripeSubscriptionId,
        updatedSubscription.status
      );
      
      return res.json({
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to reactivate subscription", error: error.message });
    }
  });
  
  app.post("/api/teams/:id/subscription/update-quantity", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can update subscription quantity
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to update subscription for this team" });
      }
      
      if (!team.stripeSubscriptionId) {
        return res.status(400).json({ message: "Team has no active subscription" });
      }
      
      const { quantity } = req.body;
      if (!quantity || quantity < 1) {
        return res.status(400).json({ message: "Invalid quantity. Must be at least 1." });
      }
      
      // Update subscription quantity
      const updatedSubscription = await updateSubscriptionQuantity(team.stripeSubscriptionId, quantity);
      
      return res.json({
        status: updatedSubscription.status,
        quantity: updatedSubscription.items.data[0].quantity,
        currentPeriodEnd: updatedSubscription.current_period_end
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update subscription quantity", error: error.message });
    }
  });
  
  app.post("/api/teams/:id/members/invite", ensureAuthenticated, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id, 10);
      const team = await storage.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      const user = req.user as any;
      // Only the team manager or admin can invite members
      if (team.managerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to invite members to this team" });
      }
      
      const { email, fullName, title } = req.body;
      
      if (!email || !fullName) {
        return res.status(400).json({ message: "Email and full name are required" });
      }
      
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        if (existingUser.teamId) {
          return res.status(400).json({ message: "User is already a member of a team" });
        }
        
        // Add existing user to team
        const updatedUser = await storage.updateUser(existingUser.id, { teamId });
        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to add user to team" });
        }
        
        // Update subscription quantity if applicable
        if (team.stripeSubscriptionId) {
          const members = await storage.getTeamMembers(teamId);
          await updateSubscriptionQuantity(team.stripeSubscriptionId, members.length);
        }
        
        return res.json({
          message: "Existing user added to team successfully",
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName
          }
        });
      }
      
      // Create a new invited user
      const invitedUser = await storage.createInvitedUser(email, fullName, teamId, title);
      
      if (!invitedUser) {
        return res.status(500).json({ message: "Failed to create invitation" });
      }
      
      // Update subscription quantity if applicable
      if (team.stripeSubscriptionId) {
        const members = await storage.getTeamMembers(teamId);
        await updateSubscriptionQuantity(team.stripeSubscriptionId, members.length);
      }
      
      // TODO: Send email invitation using SendGrid or other email service
      
      return res.status(201).json({
        message: "Invitation sent successfully",
        user: {
          id: invitedUser.id,
          email: invitedUser.email,
          fullName: invitedUser.fullName,
          invitationToken: invitedUser.invitationToken,
          invitationExpiry: invitedUser.invitationExpiry
        }
      });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to invite team member", error: error.message });
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
  
  // Create a visit
  app.post("/api/visits", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Handle date conversion properly
      let visitDate;
      if (req.body.visitDate) {
        if (typeof req.body.visitDate === 'string') {
          visitDate = new Date(req.body.visitDate);
        } else {
          visitDate = req.body.visitDate;
        }
      } else {
        visitDate = new Date();
      }
      
      const visitData = {
        ...req.body,
        userId: user.id,
        visitDate,
      };
      
      console.log("Creating visit with data:", visitData);
      const visit = await storage.createVisit(visitData);
      return res.status(201).json(visit);
    } catch (error) {
      console.error("Error creating visit:", error);
      return res.status(500).json({ message: "Failed to create visit" });
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
        // Return default customization settings that match our updated schema
        return res.json({
          id: 0,
          userId: user.id,
          teamId: null,
          theme: "light",
          primaryColor: "blue",
          colorScheme: null,
          secondaryColor: null,
          accentColor: null,
          fontFamily: null,
          logoUrl: null,
          enableDarkMode: true,
          pinColors: Object.fromEntries(CONTACT_STATUSES.map((status, i) => [status, PIN_COLORS[i % PIN_COLORS.length]])),
          mapDefaultView: "roadmap",
          quickActions: QUICK_ACTIONS,
          customStatuses: [],
          statusLabels: {},
          appointmentTypes: ["Sales Presentation", "Product Demo", "Follow-up Meeting", "Installation"],
          confirmationOptions: {
            sms: true,
            email: true,
            reminderTime: 30
          },
          dashboardWidgets: DASHBOARD_WIDGETS,
          dashboardWidgetLabels: DASHBOARD_WIDGET_LABELS,
          timerSettings: {},
          notificationSettings: {},
          language: "en",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "hh:mm A",
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
  
  // Message Template routes - Get all message templates for current user
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

  // Chat Routes
  // Get all conversations for the current user
  app.get("/api/chat/conversations", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const conversations = await storage.getChatConversationsByUser(user.id);
      return res.json(conversations);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get a specific conversation by ID
  app.get("/api/chat/conversations/:id", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is a participant in this conversation
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isParticipant = participants.some(p => p.userId === user.id);
      
      if (!isParticipant && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this conversation" });
      }
      
      return res.json(conversation);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Create a new conversation
  app.post("/api/chat/conversations", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Validate the conversation data
      const conversationData = insertChatConversationSchema.parse(req.body);
      
      // If this is a team channel, ensure the user is a manager or admin
      if (conversationData.isTeamChannel && conversationData.teamId) {
        if (!user.isManager && user.role !== "admin") {
          return res.status(403).json({ message: "Only managers or admins can create team channels" });
        }
        
        // Check if user is a member of this team
        const team = await storage.getTeam(conversationData.teamId);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
        
        if (team.managerId !== user.id && user.role !== "admin") {
          return res.status(403).json({ message: "You can only create channels for teams you manage" });
        }
      }
      
      // Create the conversation
      const conversation = await storage.createChatConversation(conversationData);
      
      // Add the current user as a participant and admin
      await storage.addChatParticipant({
        conversationId: conversation.id,
        userId: user.id,
        isAdmin: true
      });
      
      return res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get participants of a conversation
  app.get("/api/chat/conversations/:id/participants", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is a participant in this conversation
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isParticipant = participants.some(p => p.userId === user.id);
      
      if (!isParticipant && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this conversation" });
      }
      
      // For each participant, fetch the user details
      const participantsWithDetails = await Promise.all(
        participants.map(async (participant) => {
          const userDetails = await storage.getUser(participant.userId);
          return {
            ...participant,
            user: userDetails ? {
              id: userDetails.id,
              username: userDetails.username,
              fullName: userDetails.fullName,
              isManager: userDetails.isManager
            } : null
          };
        })
      );
      
      return res.json(participantsWithDetails);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  // Add a participant to a conversation
  app.post("/api/chat/conversations/:id/participants", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is an admin in this conversation
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isAdmin = participants.some(p => p.userId === user.id && p.isAdmin);
      
      if (!isAdmin && user.role !== "admin") {
        return res.status(403).json({ message: "Only conversation admins can add participants" });
      }
      
      // Validate the new participant data
      const { userId, isAdmin: newUserIsAdmin } = req.body;
      
      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      // Check if the user exists
      const userToAdd = await storage.getUser(userId);
      if (!userToAdd) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Add the participant
      const participant = await storage.addChatParticipant({
        conversationId,
        userId,
        isAdmin: !!newUserIsAdmin
      });
      
      return res.status(201).json(participant);
    } catch (error) {
      return res.status(500).json({ message: "Failed to add participant" });
    }
  });

  // Remove a participant from a conversation
  app.delete("/api/chat/conversations/:id/participants/:userId", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const userIdToRemove = parseInt(req.params.userId, 10);
      
      const conversation = await storage.getChatConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is an admin in this conversation or is removing themselves
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isAdmin = participants.some(p => p.userId === user.id && p.isAdmin);
      const isRemovingSelf = user.id === userIdToRemove;
      
      if (!isAdmin && !isRemovingSelf && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to remove participants" });
      }
      
      // Remove the participant
      const success = await storage.removeChatParticipant(conversationId, userIdToRemove);
      
      if (!success) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      return res.json({ message: "Participant removed successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove participant" });
    }
  });

  // Get messages in a conversation
  app.get("/api/chat/conversations/:id/messages", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is a participant in this conversation
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isParticipant = participants.some(p => p.userId === user.id);
      
      if (!isParticipant && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this conversation" });
      }
      
      // Get query parameters for pagination
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = req.query.before ? new Date(req.query.before as string) : undefined;
      
      // Get messages
      const messages = await storage.getChatMessages(conversationId, limit, before);
      
      // For each message, fetch the sender details
      const messagesWithSenders = await Promise.all(
        messages.map(async (message) => {
          const sender = await storage.getUser(message.senderId);
          return {
            ...message,
            sender: sender ? {
              id: sender.id,
              username: sender.username,
              fullName: sender.fullName
            } : null
          };
        })
      );
      
      // Mark messages as read
      await storage.markChatMessagesAsRead(conversationId, user.id);
      
      return res.json(messagesWithSenders);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message in a conversation
  app.post("/api/chat/conversations/:id/messages", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user is a participant in this conversation
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isParticipant = participants.some(p => p.userId === user.id);
      
      if (!isParticipant && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to send messages in this conversation" });
      }
      
      // Validate the message data
      const { content, isUrgent, attachmentUrl } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      // Create the message
      const message = await storage.createChatMessage({
        conversationId,
        senderId: user.id,
        content,
        isUrgent: !!isUrgent,
        attachmentUrl: attachmentUrl || null
      });
      
      // Return the message with sender details
      return res.status(201).json({
        ...message,
        sender: {
          id: user.id,
          username: user.username,
          fullName: user.fullName
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Delete a message
  app.delete("/api/chat/messages/:id", ensureAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id, 10);
      
      // We need to query the database to get the message first
      // to check if the user is authorized to delete it
      const messages = await storage.getChatMessages(0, 1); // This is inefficient, we should add a method to get a single message
      const message = messages.find(m => m.id === messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Check if user is the sender or an admin
      const user = req.user as any;
      if (message.senderId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this message" });
      }
      
      // Delete the message
      const success = await storage.deleteChatMessage(messageId);
      
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      return res.json({ message: "Message deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Get unread message count for the current user
  app.get("/api/chat/unread-count", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const count = await storage.getUnreadChatMessageCount(user.id);
      return res.json({ count });
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch unread message count" });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["stripe-signature"] as string;
    
    if (!signature) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }
    
    let event;
    
    try {
      // Need to use raw body for Stripe signature verification
      event = constructEventFromPayload(signature, req.body);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return res.status(400).json({ message: "Invalid signature" });
    }
    
    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object as Stripe.Subscription;
        // Update subscription status in our database
        try {
          const stripeCustomerId = subscription.customer as string;
          
          // Try to find the team with this customer ID first
          const team = await storage.getTeamByStripeCustomerId(stripeCustomerId);
          
          if (team) {
            await storage.updateTeamStripeInfo(
              team.id,
              stripeCustomerId,
              subscription.id,
              subscription.status
            );
          } else {
            // If no team found, maybe it's a user subscription
            const user = await storage.getUserByStripeCustomerId(stripeCustomerId);
            
            if (user) {
              await storage.updateUserStripeInfo(
                user.id,
                stripeCustomerId,
                subscription.id,
                subscription.status
              );
            } else {
              console.error("No team or user found for customer ID:", stripeCustomerId);
            }
          }
        } catch (error) {
          console.error("Error updating subscription status:", error);
        }
        break;
        
      case "invoice.payment_succeeded":
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          // Update payment status for the subscription
          console.log("Payment succeeded for subscription:", invoice.subscription);
          
          // You could update the subscription status to 'active' here if needed
          const stripeCustomerId = invoice.customer as string;
          try {
            // Try to find the team with this customer ID first
            const team = await storage.getTeamByStripeCustomerId(stripeCustomerId);
            
            if (team && team.subscriptionStatus !== 'active') {
              await storage.updateTeamStripeInfo(
                team.id,
                stripeCustomerId,
                invoice.subscription as string,
                'active'
              );
            } else {
              // If no team found, maybe it's a user subscription
              const user = await storage.getUserByStripeCustomerId(stripeCustomerId);
              
              if (user && user.subscriptionStatus !== 'active') {
                await storage.updateUserStripeInfo(
                  user.id,
                  stripeCustomerId,
                  invoice.subscription as string,
                  'active'
                );
              }
            }
          } catch (error) {
            console.error("Error updating subscription status after payment:", error);
          }
        }
        break;
        
      case "invoice.payment_failed":
        const failedInvoice = event.data.object as any;
        if (failedInvoice.subscription) {
          // Handle failed payment
          console.error("Payment failed for subscription:", failedInvoice.subscription);
          
          // Update the subscription status to 'past_due'
          const stripeCustomerId = failedInvoice.customer as string;
          try {
            // Try to find the team with this customer ID first
            const team = await storage.getTeamByStripeCustomerId(stripeCustomerId);
            
            if (team) {
              await storage.updateTeamStripeInfo(
                team.id,
                stripeCustomerId,
                failedInvoice.subscription as string,
                'past_due'
              );
            } else {
              // If no team found, maybe it's a user subscription
              const user = await storage.getUserByStripeCustomerId(stripeCustomerId);
              
              if (user) {
                await storage.updateUserStripeInfo(
                  user.id,
                  stripeCustomerId,
                  failedInvoice.subscription as string,
                  'past_due'
                );
              }
            }
          } catch (error) {
            console.error("Error updating subscription status after failed payment:", error);
          }
          
          // TODO: Send an email notification here
        }
        break;
        
      // Handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    
    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
