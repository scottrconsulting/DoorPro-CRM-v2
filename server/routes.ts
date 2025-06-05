import express, { type Express, type Request, type Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
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
  insertTaskSchema,
  PIN_COLORS,
  CONTACT_STATUSES,
  QUICK_ACTIONS,
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDGET_LABELS,
  chatParticipants,
  tasks
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
import { db } from './db';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  tenantIsolation, 
  auditLogger, 
  validateTenantAccess, 
  softDeleteSupport,
  logAuditEvent,
  AuditAction,
  type TenantRequest 
} from './middleware/tenant-isolation';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import direct auth router and token verification function
import directAuthRouter, { verifyToken } from './direct-auth';

// Import upload helpers
import { upload, getFileUrl } from './upload';
// Import profile methods
import { updateProfilePicture, updateUserOnlineStatus, updateUserLastActive } from './profile-methods';

export async function registerRoutes(app: Express): Promise<Server> {
  // Special static route for HTML login page outside of Vite/React
  app.get('/static-login', (req, res) => {
    console.log('Serving static HTML login page');
    res.sendFile('login.html', { root: './client/public' });
  });

  // Add a CORS header to all responses
  app.use((req, res, next) => {
    // Get the origin from the request headers
    const origin = req.headers.origin || "*";

    // Set enhanced CORS headers for all requests
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma");
    res.header("Access-Control-Allow-Credentials", "true");

    // Set cache control headers to prevent caching
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // Session setup using PostgreSQL for persistent sessions
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "doorprocrm-secret",
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      proxy: true,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.replit.dev' : undefined
      },
      rolling: true
    })
  );

  // Passport setup
  app.use(passport.initialize());
  app.use(passport.session());

  // Add tenant isolation and audit logging middleware for API routes (except auth)
  app.use(/^\/api\/(?!auth|direct-auth).*/, tenantIsolation);
  app.use('/api/*', auditLogger);
  app.use('/api/*', softDeleteSupport);

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

          // For admin, directly compare with plaintext password
          if (password === 'password') {
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

  // Use the verifyToken function imported at the top

  // Middleware to ensure the user is authenticated - supports both session and token authentication
  const ensureAuthenticated = async (req: Request, res: Response, next: any) => {
    console.log(`Auth check for ${req.method} ${req.url}`);
    
    // First check standard cookie-based authentication
    if (req.isAuthenticated()) {
      console.log("User authenticated via session");
      return next();
    }
    
    // If not authenticated by cookie, check for bearer token
    const authHeader = req.headers.authorization;
    console.log(`Authorization header: ${authHeader ? 'present' : 'missing'}`);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log(`Token received in Authorization header: ${token.substring(0, 5)}...`);
      
      // Use the direct-auth token verification
      try {
        if (verifyToken(token)) {
          // We're authenticated via token - set req.user with admin credentials
          console.log("User authenticated via token, setting admin user");
          
          // Set the user property on the request to enable admin access
          (req as any).user = {
            id: 1,
            username: 'admin',
            email: 'scottrconsulting@gmail.com',
            fullName: 'Admin User',
            role: 'admin'
          };
          
          return next();
        } else {
          console.log("Token verification failed - invalid token");
        }
      } catch (error) {
        console.error("Token verification error:", error);
      }
    } else {
      console.log("No Bearer token found in authorization header");
    }
    
    // Not authenticated by any method
    console.log("Authentication failed for request");
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Middleware to check if user has pro access
  const ensureProAccess = (req: Request, res: Response, next: any) => {
    // If authenticated via session
    if (req.isAuthenticated()) {
      const user = req.user as any;
      if (user.role === "admin" || user.role === "pro") {
        return next();
      }
      return res.status(403).json({ message: "This feature requires a Pro subscription" });
    }
    
    // If authenticated via token (check Authorization header)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        if (verifyToken(token)) {
          // We're assuming all token auth users are admins for now
          console.log("Token user granted Pro access");
          return next();
        }
      } catch (error) {
        console.error("Token verification error in Pro check:", error);
      }
    }
    
    return res.status(401).json({ message: "Unauthorized" });
  };

  // Register direct auth routes that don't use cookies - more reliable for cross-domain access
  app.use('/api/direct-auth', directAuthRouter);

  // Standard Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    console.log("Login attempt for username:", req.body.username);

    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }

      if (!user) {
        console.log("Authentication failed:", info?.message || "Unknown reason");
        
        // Log failed login attempt
        logAuditEvent(
          0, // Use 0 for unknown user
          AuditAction.FAILED_LOGIN,
          'auth',
          undefined,
          { 
            attemptedUsername: req.body.username,
            reason: info?.message || "Unknown reason",
            userAgent: req.get('User-Agent')
          },
          req.ip
        );
        
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }

      console.log("Authentication successful for user ID:", user.id);

      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return next(err);
        }
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return next(err);
          }
          console.log("Session created and saved successfully");
          
          // Log successful login
          logAuditEvent(
            user.id,
            AuditAction.LOGIN,
            'auth',
            user.id,
            { 
              username: user.username,
              userAgent: req.get('User-Agent')
            },
            req.ip
          );
          
          return res.status(200).json({ 
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

  // Session authentication status endpoint
  app.get("/api/auth/me", (req, res) => {
    // Check for session authentication
    if (req.isAuthenticated()) {
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
    } 
    
    // Not authenticated
    return res.status(401).json({ authenticated: false });
  });

  app.get("/api/auth/user", (req, res) => {
    // Check for cookie/session authentication first
    if (req.isAuthenticated()) {
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
    } 
    
    // If not authenticated via cookie/session, check for token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        if (verifyToken(token)) {
          // Return admin user info for token auth
          console.log("Token authenticated user info request");
          return res.json({ 
            authenticated: true, 
            user: { 
              id: 1, 
              username: 'admin', 
              email: 'scottrconsulting@gmail.com', 
              fullName: 'Admin User', 
              role: 'admin' 
            } 
          });
        }
      } catch (error) {
        console.error("Token verification error:", error);
      }
    }
    
    // Not authenticated by any method
    return res.status(401).json({ authenticated: false });
  });

  app.post("/api/auth/logout", (req, res) => {
    const userId = req.user?.id;
    
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error during logout" });
      }
      
      // Log logout event
      if (userId) {
        logAuditEvent(
          userId,
          AuditAction.LOGOUT,
          'auth',
          userId,
          { 
            userAgent: req.get('User-Agent')
          },
          req.ip
        );
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

  // Contact routes with tenant isolation
  app.get("/api/contacts", ensureAuthenticated, validateTenantAccess('contacts'), async (req: TenantRequest, res) => {
    try {
      const contacts = await storage.getContactsByUser(req.userId!);
      return res.json(contacts);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });
  
  // Send appointment confirmation to contact
  app.post("/api/contacts/:id/send-confirmation", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const { method, appointmentDate, appointmentTime } = req.body;
      const user = req.user as any;
      
      // Get the contact
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Check authorization - user can only send confirmations for their own contacts
      if (contact.userId !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized to send confirmation for this contact" });
      }
      
      // Get the default templates
      let emailTemplate = null;
      let smsTemplate = null;
      
      if (method === 'email' || method === 'both') {
        emailTemplate = await storage.getDefaultMessageTemplate(user.id, 'email');
        if (!emailTemplate) {
          // If no default template, get the first available email template
          const emailTemplates = await storage.getMessageTemplatesByType(user.id, 'email');
          if (emailTemplates.length > 0) {
            emailTemplate = emailTemplates[0];
          }
        }
      }
      
      if (method === 'sms' || method === 'both') {
        smsTemplate = await storage.getDefaultMessageTemplate(user.id, 'text');
        if (!smsTemplate) {
          // If no default template, get the first available SMS template
          const smsTemplates = await storage.getMessageTemplatesByType(user.id, 'text');
          if (smsTemplates.length > 0) {
            smsTemplate = smsTemplates[0];
          }
        }
      }
      
      // Check if we have the necessary templates
      if ((method === 'email' || method === 'both') && !emailTemplate) {
        return res.status(400).json({ 
          message: "No email template found. Please create a template in Settings > Message Templates" 
        });
      }
      
      if ((method === 'sms' || method === 'both') && !smsTemplate) {
        return res.status(400).json({ 
          message: "No SMS template found. Please create a template in Settings > Message Templates" 
        });
      }
      
      // Import the notifications utility here to avoid circular dependencies
      const { sendAppointmentConfirmations } = await import('./utils/notifications');
      
      // Send the confirmation
      const result = await sendAppointmentConfirmations({
        contactName: contact.fullName,
        contactEmail: contact.email || undefined,
        contactPhone: contact.phone || undefined,
        date: appointmentDate,
        time: appointmentTime,
        address: contact.address,
        notes: '',
        userId: req.user.id
      }, {
        email: method === 'email' || method === 'both',
        text: method === 'sms' || method === 'both'
      });
      
      return res.json(result);
    } catch (error) {
      console.error("Error sending confirmation:", error);
      return res.status(500).json({ message: "Failed to send confirmation" });
    }
  });

  app.get("/api/contacts/:id", ensureAuthenticated, validateTenantAccess('contacts'), async (req: TenantRequest, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const contact = await storage.getContact(contactId);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.userId !== req.userId && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to access this contact" });
      }

      return res.json(contact);
    } catch (error) {
      return res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", ensureAuthenticated, async (req, res) => {
    // Check tier limits for contact creation
    const user = req.user as any;
    try {
      const { checkTierLimit, recordUsage } = await import('./usage-tracking');
      const limitCheck = await checkTierLimit(user.id, 'create_contact');
      
      if (!limitCheck.allowed) {
        return res.status(403).json({
          message: limitCheck.reason,
          upgrade_required: true,
          current_usage: limitCheck.currentUsage,
          limit: limitCheck.limit
        });
      }
    } catch (error) {
      console.error('Tier limit check failed:', error);
      // Continue with creation if check fails
    }
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
      
      // Log entire contact and request data for debugging
      console.log("Contact created:", JSON.stringify(contact, null, 2));
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      // Check if there's an appointment to schedule - handle all possible appointment data formats
      if ((contact.status === 'booked' || contact.status === 'check_back')) {
        try {
          // Get user's notification preferences
          const userCustomization = await storage.getCustomizationByUser(user.id);
          
          // Default confirmation options if not set
          const confirmOptions = userCustomization?.confirmationOptions || {
            email: true,
            sms: false,
            reminderTime: 60 // minutes before appointment
          };
          
          // Parse appointment string into date and time - handle all possible formats
          let appointmentDate, appointmentTime;
          
          // Check all possible ways the appointment might be stored
          if (contact.appointment && contact.appointment.includes(' ')) {
            // If using the standard appointment string format "YYYY-MM-DD HH:MM"
            [appointmentDate, appointmentTime] = contact.appointment.split(' ');
            console.log("Found appointment from contact.appointment:", appointmentDate, appointmentTime);
          } else if (req.body.appointment && req.body.appointment.includes(' ')) {
            // If appointment is in the request body
            [appointmentDate, appointmentTime] = req.body.appointment.split(' ');
            console.log("Found appointment from req.body.appointment:", appointmentDate, appointmentTime);
          } else if (req.body.appointmentDate && req.body.appointmentTime) {
            // If using separate date and time fields
            appointmentDate = req.body.appointmentDate;
            appointmentTime = req.body.appointmentTime;
            console.log("Found appointment from separate fields:", appointmentDate, appointmentTime);
          } else if (contact.notes && contact.notes.includes("Appointment scheduled for")) {
            // Try to extract from notes as a last resort
            const match = contact.notes.match(/Appointment scheduled for (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})/);
            if (match) {
              appointmentDate = match[1];
              appointmentTime = match[2];
              console.log("Extracted appointment from notes:", appointmentDate, appointmentTime);
            }
          }
          
          if (appointmentDate && appointmentTime) {
            console.log(`Processing appointment for ${contact.fullName}: ${appointmentDate} at ${appointmentTime}`);
            
            // Parse dates correctly with ISO format
            const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
            const formattedDate = appointmentDateTime.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });
            const formattedTime = appointmentDateTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
            // Create a visit record for this new contact with appointment
            await storage.createVisit({
              contactId: contact.id,
              userId: user.id,
              visitType: contact.status === 'booked' ? 'appointment_scheduled' : 'follow_up_scheduled',
              notes: contact.status === 'booked'
                ? `Initial contact - Status: ${contact.status}. Appointment scheduled for ${formattedDate} at ${formattedTime}.`
                : `Initial contact - Status: ${contact.status}. Follow-up scheduled for ${formattedDate} at ${formattedTime}.`,
              visitDate: new Date()
            });
            
            // Check if this appointment was created from the contact form
            // If the appointment was explicitly set, the frontend will create 
            // the schedule entry. Only create it from the backend if:
            // - It was created from the map interface (which doesn't handle schedules itself)
            // - It's not coming from a form submission with explicit appointment fields
            const isFromContactForm = req.body.usingContactForm === true || 
                                     req.body.appointmentDate || 
                                     req.headers['x-contact-form-submission'] === 'true';
            
            // Only create schedule entry if not from contact form
            if (!isFromContactForm) {
              console.log(`Creating schedule for ${contact.status} contact: ${contact.fullName} at ${appointmentDateTime} (backend only)`);
              
              // Always create a schedule entry for booked or check_back status
              // Add a schedule entry for this appointment
              const endDateTime = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000); // 1 hour appointment
              
              const scheduleData = {
                userId: user.id,
                title: contact.status === 'booked' ? `Appointment with ${contact.fullName}` : `Follow-up with ${contact.fullName}`,
                description: contact.notes || 
                  (contact.status === 'booked' ? `Scheduled appointment with ${contact.fullName}` : `Follow-up with ${contact.fullName}`),
                startTime: appointmentDateTime,
                endTime: endDateTime,
                type: contact.status === 'booked' ? 'appointment' : 'follow_up',
                location: contact.address,
                contactIds: [contact.id],
                reminderTime: new Date(appointmentDateTime.getTime() - (confirmOptions.reminderTime * 60 * 1000)),
                confirmationMethod: confirmOptions.email && confirmOptions.sms ? 'both' : 
                                  confirmOptions.email ? 'email' : 
                                  confirmOptions.sms ? 'sms' : 'none',
                confirmationStatus: 'pending'
              };
              
              console.log("Creating schedule with data:", JSON.stringify(scheduleData, null, 2));
              const schedule = await storage.createSchedule(scheduleData);
              console.log("Schedule created:", JSON.stringify(schedule, null, 2));
            } else {
              console.log("Skipping schedule creation in backend - will be handled by contact form component");
            }
          }
        } catch (appointmentError) {
          console.error("Failed to process appointment:", appointmentError);
          // Don't return an error here, as the contact was still created successfully
        }
      } else {
        // For contacts without appointments, still create an initial visit record
        try {
          await storage.createVisit({
            contactId: contact.id,
            userId: user.id,
            visitType: 'initial',
            notes: `Initial contact - Status: ${contact.status}`,
            outcome: contact.status === 'interested' || contact.status === 'booked' ? 'positive' : 
                    contact.status === 'not_interested' ? 'negative' : 'neutral',
            followUpNeeded: contact.status === 'check_back' || contact.status === 'considering',
            visitDate: new Date()
          });
        } catch (visitError) {
          console.error("Failed to create initial visit record:", visitError);
        }
      }
      
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

      // Check if this is a status change to "booked" or "check_back"
      const isStatusChange = req.body.status && req.body.status !== existingContact.status;
      const isBookedOrCheckBack = req.body.status === "booked" || req.body.status === "check_back";
      
      // Update the contact first
      const updatedContact = await storage.updateContact(contactId, req.body);
      
      // If the status has changed to booked or check_back, create a schedule entry
      if (isStatusChange && isBookedOrCheckBack) {
        try {
          // Set up schedule date (default to tomorrow at 10am) in local time
          const currentDate = new Date();
          const tomorrowDate = new Date(currentDate);
          tomorrowDate.setDate(currentDate.getDate() + 1);
          
          // Start time - tomorrow 10am local time
          const scheduleDate = new Date(
            tomorrowDate.getFullYear(),
            tomorrowDate.getMonth(),
            tomorrowDate.getDate(),
            10, 0, 0
          );
          
          // End time - tomorrow 11am local time (1 hour later)
          const endTime = new Date(
            tomorrowDate.getFullYear(),
            tomorrowDate.getMonth(),
            tomorrowDate.getDate(),
            11, 0, 0
          );
          
          // Create the schedule entry
          const scheduleData = {
            title: req.body.status === "booked" 
              ? `Appointment with ${updatedContact.fullName}`
              : `Follow-up with ${updatedContact.fullName}`,
            type: req.body.status === "booked" ? "appointment" : "follow_up",
            userId: user.id,
            startTime: scheduleDate,
            endTime: endTime,
            location: updatedContact.address,
            description: req.body.status === "booked"
              ? `Scheduled appointment for ${updatedContact.fullName} at ${updatedContact.address}`
              : `Follow up with ${updatedContact.fullName} at ${updatedContact.address}`,
            contactIds: [contactId],
            priority: req.body.status === "booked" ? "high" : "medium"
          };
          
          await storage.createSchedule(scheduleData);
          
          // Add a visit record for this status change
          const visitData = {
            contactId,
            userId: user.id,
            visitType: req.body.status === "booked" ? "appointment_scheduled" : "follow_up_scheduled",
            notes: req.body.status === "booked"
              ? `Status changed to Booked. Appointment scheduled for ${scheduleDate.toLocaleString()}.`
              : `Status changed to Check Back. Follow-up scheduled for ${scheduleDate.toLocaleString()}.`,
            visitDate: new Date()
          };
          
          await storage.createVisit(visitData);
          
          console.log(`Auto-scheduled ${req.body.status} event for contact ${contactId}`);
        } catch (scheduleError) {
          console.error("Failed to auto-schedule event:", scheduleError);
          // We don't want to fail the contact update if scheduling fails
          // Just log the error and continue
        }
      }
      
      return res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      return res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.patch("/api/contacts/:id", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id, 10);
      const existingContact = await storage.getContact(contactId);

      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const user = req.user as any;
      if (existingContact.userId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to update this contact" });
      }
      
      // Update the contact first
      const updatedContact = await storage.updateContact(contactId, req.body);
      
      // Check if status has changed
      const isStatusChange = req.body.status && existingContact.status !== req.body.status;
      const isBookedOrCheckBack = req.body.status === "booked" || req.body.status === "check_back";
      
      // If the status has changed to booked or check_back, create a schedule entry
      if (isStatusChange && isBookedOrCheckBack) {
        try {
          // Set up schedule date (default to tomorrow at 10am) in local time
          const currentDate = new Date();
          const tomorrowDate = new Date(currentDate);
          tomorrowDate.setDate(currentDate.getDate() + 1);
          
          // Start time - tomorrow 10am local time
          const scheduleDate = new Date(
            tomorrowDate.getFullYear(),
            tomorrowDate.getMonth(),
            tomorrowDate.getDate(),
            10, 0, 0
          );
          
          // End time - tomorrow 11am local time (1 hour later)
          const endTime = new Date(
            tomorrowDate.getFullYear(),
            tomorrowDate.getMonth(),
            tomorrowDate.getDate(),
            11, 0, 0
          );
          
          // Create the schedule entry
          const scheduleData = {
            title: req.body.status === "booked" 
              ? `Appointment with ${updatedContact.fullName}`
              : `Follow-up with ${updatedContact.fullName}`,
            type: req.body.status === "booked" ? "appointment" : "follow_up",
            userId: user.id,
            startTime: scheduleDate,
            endTime: endTime,
            location: updatedContact.address,
            description: req.body.status === "booked"
              ? `Scheduled appointment for ${updatedContact.fullName} at ${updatedContact.address}`
              : `Follow up with ${updatedContact.fullName} at ${updatedContact.address}`,
            contactIds: [contactId],
            priority: req.body.status === "booked" ? "high" : "medium"
          };
          
          await storage.createSchedule(scheduleData);
          
          // Add a visit record for this status change
          const visitData = {
            contactId,
            userId: user.id,
            visitType: req.body.status === "booked" ? "appointment_scheduled" : "follow_up_scheduled",
            notes: req.body.status === "booked"
              ? `Status changed to Booked. Appointment scheduled for ${scheduleDate.toLocaleString()}.`
              : `Status changed to Check Back. Follow-up scheduled for ${scheduleDate.toLocaleString()}.`,
            visitDate: new Date()
          };
          
          await storage.createVisit(visitData);
          
          console.log(`Auto-scheduled ${req.body.status} event for contact ${contactId}`);
        } catch (scheduleError) {
          console.error("Failed to auto-schedule event:", scheduleError);
          // We don't want to fail the contact update if scheduling fails
          // Just log the error and continue
        }
      }
      
      return res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
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

  // Visit routes with tenant isolation
  app.get("/api/contacts/:contactId/visits", ensureAuthenticated, validateTenantAccess('visits'), async (req: TenantRequest, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      const contact = await storage.getContact(contactId);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      if (contact.userId !== req.userId && req.user?.role !== "admin") {
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
      
      // If a follow-up date is set, add it to the schedule
      if (visitData.followUpDate) {
        try {
          // Create a default end time 30 minutes after start time
          const followUpDate = new Date(visitData.followUpDate);
          const endDateTime = new Date(followUpDate.getTime() + 30 * 60 * 1000); // 30 minutes follow-up
          
          // Add to schedule
          await storage.createSchedule({
            userId: user.id,
            title: `Follow-up with ${contact.fullName}`,
            description: visitData.notes || `Check back with ${contact.fullName}`,
            startTime: followUpDate,
            endTime: endDateTime,
            type: 'follow_up',
            location: contact.address,
            contactIds: [contact.id],
            reminderTime: new Date(followUpDate.getTime() - (60 * 60 * 1000)), // 1 hour reminder
            confirmationMethod: 'none',
            confirmationStatus: 'pending'
          });
          
          console.log("Added follow-up to schedule:", followUpDate);
        } catch (scheduleError) {
          console.error("Failed to add follow-up to schedule:", scheduleError);
          // Don't return an error, as the visit was still created successfully
        }
      }
      
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
      console.log("Schedule creation request body:", req.body);
      
      // Parse startTime and endTime as Date objects if they are strings
      let scheduleData = { ...req.body, userId: user.id };
      
      // Log the types of startTime and endTime for debugging
      console.log("Data types in schedule creation:", {
        startTimeType: typeof scheduleData.startTime,
        startTimeIsDate: scheduleData.startTime instanceof Date,
        startTimeValue: scheduleData.startTime,
        endTimeType: typeof scheduleData.endTime,
        endTimeIsDate: scheduleData.endTime instanceof Date,
        endTimeValue: scheduleData.endTime
      });
      
      // If startTime or endTime are strings, try to convert them to Date objects
      if (typeof scheduleData.startTime === 'string') {
        try {
          scheduleData.startTime = new Date(scheduleData.startTime);
          console.log("Converted startTime string to Date");
        } catch (err) {
          console.error("Failed to convert startTime string to Date:", err);
        }
      }
      
      if (typeof scheduleData.endTime === 'string') {
        try {
          scheduleData.endTime = new Date(scheduleData.endTime);
          console.log("Converted endTime string to Date");
        } catch (err) {
          console.error("Failed to convert endTime string to Date:", err);
        }
      }
      
      // Attempt to parse and log any validation errors
      try {
        scheduleData = insertScheduleSchema.parse(scheduleData);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error("Schedule validation errors:", JSON.stringify(validationError.errors));
          return res.status(400).json({ message: "Invalid data", errors: validationError.errors });
        }
        throw validationError;
      }
      
      const schedule = await storage.createSchedule(scheduleData);
      
      // If there are contactIds associated with this schedule, create visit records
      if (schedule.contactIds && schedule.contactIds.length > 0) {
        try {
          // Format time for display in the visit record
          const scheduleDate = new Date(schedule.startTime);
          const formattedTime = scheduleDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          const formattedDate = scheduleDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          });
          
          // Determine visit type based on schedule type
          let visitType = 'appointment_scheduled';
          if (schedule.type === 'follow_up' || schedule.type === 'follow-up') {
            visitType = 'follow_up_scheduled';
          } else if (schedule.type === 'presentation') {
            visitType = 'presentation_scheduled';
          }
          
          // Create a visit record for each contact
          for (const contactId of schedule.contactIds) {
            const visitData = {
              contactId,
              userId: user.id,
              visitType,
              notes: `${schedule.type.charAt(0).toUpperCase() + schedule.type.slice(1).replace('_', ' ')} scheduled for ${formattedDate} at ${formattedTime}`,
              visitDate: new Date()
            };
            
            console.log(`Creating contact visit with data:`, visitData);
            await storage.createVisit(visitData);
          }
        } catch (visitError) {
          console.error("Error creating visit records for schedule:", visitError);
          // We don't want to fail the entire schedule creation if visit creation fails
        }
      }
      
      return res.status(201).json(schedule);
    } catch (error) {
      console.error("Schedule creation error:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      return res.status(500).json({ message: "Failed to create schedule", error: String(error) });
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
      // Only the team manager or admin can access the team
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
  
  // Sales API
  app.get("/api/sales", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { startDate, endDate } = req.query;
      
      let sales;
      
      // If date range provided, filter by date range
      if (startDate && endDate) {
        sales = await storage.getSalesByDateRange(
          user.id, 
          new Date(startDate as string), 
          new Date(endDate as string)
        );
      } else {
        // Otherwise just get all sales for this user
        sales = await storage.getSalesByUser(user.id);
      }
      
      return res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      return res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });
  
  // Create new sale record (generic endpoint)
  app.post("/api/sales", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { contactId, amount, product, saleDate, status, paymentMethod, notes } = req.body;
      
      if (!contactId || !amount || !product) {
        return res.status(400).json({ message: "Missing required fields: contactId, amount, and product are required" });
      }
      
      // Get the contact to verify it exists
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      // Handle date conversion properly
      let parsedSaleDate;
      if (saleDate) {
        if (typeof saleDate === 'string') {
          // If it's an ISO string, just parse it
          parsedSaleDate = new Date(saleDate);
        } else if (saleDate instanceof Date) {
          // If it's already a Date object, use it directly
          parsedSaleDate = saleDate;
        } else {
          // Default to current date
          parsedSaleDate = new Date();
        }
      } else {
        parsedSaleDate = new Date();
      }
      
      // Create the sale record
      const sale = await storage.createSale({
        contactId,
        userId: user.id,
        amount: typeof amount === 'string' ? parseFloat(amount) : amount,
        product,
        saleDate: parsedSaleDate,
        status: status || 'completed',
        paymentMethod: paymentMethod || 'Unknown',
        notes: notes || '',
      });
      
      // Also update the contact status to reflect the sale if needed
      if (contact.status !== 'sold') {
        await storage.updateContact(contactId, { 
          ...contact,
          status: 'sold'
        });
      }
      
      return res.json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      return res.status(500).json({ message: "Failed to create sale record" });
    }
  });

  // Add sales for a contact
  app.post("/api/contacts/:contactId/sales", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      const contact = await storage.getContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const user = req.user as any;
      
      // Handle date conversion properly
      let saleDate;
      if (req.body.saleDate) {
        if (typeof req.body.saleDate === 'string') {
          // If it's an ISO string, just parse it
          saleDate = new Date(req.body.saleDate);
        } else if (req.body.saleDate instanceof Date) {
          // If it's already a date object
          saleDate = req.body.saleDate;
        } else {
          // Default to current date
          saleDate = new Date();
        }
      } else {
        saleDate = new Date();
      }
      
      const saleData = {
        ...req.body,
        saleDate,
        userId: user.id,
        contactId,
      };
      
      const sale = await storage.createSale(saleData);
      return res.status(201).json(sale);
    } catch (error) {
      console.error("Error creating sale:", error);
      return res.status(500).json({ message: "Failed to create sale" });
    }
  });

  // Get sales for a contact
  app.get("/api/contacts/:contactId/sales", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      const sales = await storage.getSalesByContact(contactId);
      return res.json(sales);
    } catch (error) {
      console.error("Error fetching contact sales:", error);
      return res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });
  
  // Task API routes
  app.get("/api/tasks", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { status, dueDate, overdue } = req.query;
      
      let tasks;
      
      if (overdue === 'true') {
        // Get overdue tasks
        tasks = await storage.getOverdueTasks(user.id);
      } else if (status) {
        // Get tasks by status
        tasks = await storage.getTasksByStatus(user.id, status as string);
      } else if (dueDate) {
        // Get tasks by due date
        tasks = await storage.getTasksByDueDate(user.id, new Date(dueDate as string));
      } else {
        // Get all user tasks
        tasks = await storage.getTasksByUser(user.id);
      }
      
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/contacts/:contactId/tasks", ensureAuthenticated, async (req, res) => {
    try {
      const contactId = parseInt(req.params.contactId, 10);
      
      // Verify the contact exists
      const contact = await storage.getContact(contactId);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const tasks = await storage.getTasksByContact(contactId);
      return res.json(tasks);
    } catch (error) {
      console.error("Error fetching contact tasks:", error);
      return res.status(500).json({ message: "Failed to fetch contact tasks" });
    }
  });

  app.post("/api/tasks", ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Pre-process the request body to handle date conversion before schema validation
      const requestData = { ...req.body, userId: user.id };
      
      // Convert dueDate string to a proper Date object if needed
      if (requestData.dueDate && typeof requestData.dueDate === 'string') {
        try {
          // If it's just a date string (e.g., "2025-04-29"), add time
          if (!requestData.dueDate.includes('T')) {
            requestData.dueDate = new Date(`${requestData.dueDate}T12:00:00Z`);
          } else {
            requestData.dueDate = new Date(requestData.dueDate);
          }
          console.log("Converted date string to Date object:", requestData.dueDate);
        } catch (dateError) {
          console.error("Error parsing date:", dateError);
          // Set default date if parsing fails
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(12, 0, 0, 0);
          requestData.dueDate = tomorrow;
        }
      }
      
      // Now validate the data with the schema
      const taskData = insertTaskSchema.parse(requestData);
      
      // If contactId is provided, verify the contact exists
      if (taskData.contactId) {
        const contact = await storage.getContact(taskData.contactId);
        if (!contact) {
          return res.status(404).json({ message: "Contact not found" });
        }
      }
      
      console.log("Creating task with data:", JSON.stringify(taskData));
      const task = await storage.createTask(taskData);
      
      return res.status(201).json({
        ...task,
        message: "Task created successfully"
      });
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid task data", 
          errors: (error as ZodError).errors 
        });
      }
      return res.status(500).json({ 
        message: "Failed to create task",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/tasks/:taskId", ensureAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      
      const updates = req.body;
      const task = await storage.updateTask(taskId, updates);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      return res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.post("/api/tasks/:taskId/complete", ensureAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      
      const task = await storage.completeTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json(task);
    } catch (error) {
      console.error("Error completing task:", error);
      return res.status(500).json({ message: "Failed to complete task" });
    }
  });

  app.delete("/api/tasks/:taskId", ensureAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      
      const result = await storage.deleteTask(taskId);
      
      if (!result) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Error deleting task:", error);
      return res.status(500).json({ message: "Failed to delete task" });
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
          statisticsMetrics: ["today_visits", "conversions", "follow_ups", "sales_count"],
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

  // Delete a conversation
  app.delete("/api/chat/conversations/:id", ensureAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id, 10);
      
      // Get the conversation to check permissions
      const conversation = await storage.getChatConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Get participants to check if user is a participant or admin
      const participants = await storage.getChatParticipants(conversationId);
      const user = req.user as any;
      const isParticipant = participants.some((p: any) => p.userId === user.id);
      const isAdmin = user.role === "admin"; 
      const isTeamOwner = user.role === "team_owner" && conversation.teamId === user.teamId;
      
      // New rules: 
      // 1. Group chats can only be deleted by creator, admins, or team owners
      // 2. Direct messages can be deleted by either participant
      // 3. Channel-type conversations have special rules
      
      let canDelete = false;
      
      // Always allow admins and team owners to delete any conversation
      if (isAdmin || isTeamOwner) {
        canDelete = true;
      }
      // For direct messages (conversations with exactly 2 participants), either participant can remove
      else if (participants.length === 2 && isParticipant) {
        canDelete = true;
      }
      // Check if user is the creator (allow even if the creatorId field is not yet populated)
      else if (
        (conversation.creatorId === user.id) || 
        // If creatorId is null (for old records) but user is participant with admin rights
        (conversation.creatorId === null && isParticipant && participants.find((p: any) => p.userId === user.id)?.isAdmin)
      ) {
        canDelete = true;
      }
      
      if (!canDelete) {
        return res.status(403).json({ 
          message: "Not authorized to delete this conversation. Only conversation creators or administrators can delete group conversations."
        });
      }
      
      // Delete the conversation
      const success = await storage.deleteChatConversation(conversationId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete conversation" });
      }
      
      // Also delete all participants from chat_participants table for this user
      // This is necessary because getChatConversationsByUser first queries participants
      try {
        await db.delete(chatParticipants)
          .where(eq(chatParticipants.conversationId, conversationId));
      } catch (participantError) {
        console.error("Error ensuring participants are deleted:", participantError);
        // Continue even if this fails as the main deletion was successful
      }
      
      res.status(200).json({ message: "Conversation deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

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

  // Serve uploaded files
  const uploadsPath = path.join(__dirname, '../uploads');
  app.use('/uploads', express.static(uploadsPath));

  // User profile picture upload route
  app.post('/api/profile/upload-picture', ensureAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const user = req.user as any;
      const fileUrl = getFileUrl(req.file.filename);
      
      // Update user's profile picture URL in database
      const updatedUser = await updateProfilePicture(user.id, fileUrl);
      
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to update profile picture' });
      }
      
      // Remove old profile picture if it exists
      if (updatedUser.profilePictureUrl && updatedUser.profilePictureUrl !== fileUrl) {
        try {
          // Extract just the filename from the URL (e.g., /uploads/abc123.jpg -> abc123.jpg)
          const filename = path.basename(updatedUser.profilePictureUrl);
          const oldFilePath = path.join(uploadsPath, filename);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (error) {
          console.error('Error removing old profile picture:', error);
          // Continue even if deletion fails
        }
      }
      
      return res.status(200).json({ 
        message: 'Profile picture updated successfully',
        profilePictureUrl: fileUrl
      });
    } catch (error: any) {
      return res.status(500).json({ 
        message: 'Error uploading profile picture', 
        error: error.message 
      });
    }
  });

  // Update user online status
  app.post('/api/profile/online-status', ensureAuthenticated, async (req, res) => {
    try {
      const { isOnline } = req.body;
      const user = req.user as any;
      
      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      const updatedUser = await updateUserOnlineStatus(user.id, isOnline);
      
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to update online status' });
      }
      
      return res.status(200).json({ 
        message: 'Online status updated successfully',
        isOnline
      });
    } catch (error: any) {
      return res.status(500).json({ 
        message: 'Error updating online status', 
        error: error.message 
      });
    }
  });

  // Update user last active timestamp
  app.post('/api/profile/last-active', ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const lastActive = new Date();
      
      const updatedUser = await updateUserLastActive(user.id, lastActive);
      
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to update last active time' });
      }
      
      return res.status(200).json({ 
        message: 'Last active time updated successfully',
        lastActive
      });
    } catch (error: any) {
      return res.status(500).json({ 
        message: 'Error updating last active time', 
        error: error.message 
      });
    }
  });

  // Get team members with online status
  app.get('/api/teams/members/status', ensureAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // If user is part of a team, get team members with online status
      if (user.teamId) {
        const teamMembers = await storage.getTeamMembers(user.teamId);
        return res.json(teamMembers);
      } 
      
      // If user is not part of a team but is a manager, return an empty array
      return res.json([]);
    } catch (error: any) {
      return res.status(500).json({ 
        message: 'Error fetching team members status', 
        error: error.message 
      });
    }
  });

  // Enhanced registration endpoints
  app.post("/api/auth/register-v2", async (req, res) => {
    try {
      const { username, email, password, fullName, subscriptionTier } = req.body;
      
      if (!username || !email || !password || !fullName) {
        return res.status(400).json({ 
          success: false, 
          message: "All fields are required" 
        });
      }

      const { registerUser } = await import('./user-registration');
      const result = await registerUser({
        username,
        email,
        password,
        fullName,
        subscriptionTier: subscriptionTier || 'free'
      });

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ 
        success: false, 
        message: "Registration failed. Please try again." 
      });
    }
  });

  // Email verification endpoint
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required"
        });
      }

      const { verifyEmail } = await import('./user-registration');
      const result = await verifyEmail(token);

      return res.json(result);
    } catch (error) {
      console.error('Email verification error:', error);
      return res.status(500).json({
        success: false,
        message: "Email verification failed"
      });
    }
  });

  // Check username availability
  app.get("/api/auth/check-username/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const { checkUsernameAvailability } = await import('./user-registration');
      const result = await checkUsernameAvailability(username);
      return res.json(result);
    } catch (error) {
      console.error('Username check error:', error);
      return res.status(500).json({ available: false });
    }
  });

  // Check email availability  
  app.get("/api/auth/check-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const { checkEmailAvailability } = await import('./user-registration');
      const result = await checkEmailAvailability(email);
      return res.json(result);
    } catch (error) {
      console.error('Email check error:', error);
      return res.status(500).json({ available: false });
    }
  });

  // Usage statistics endpoint
  app.get("/api/usage/stats", ensureAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }

      const { getDashboardUsage } = await import('./usage-tracking');
      const usage = await getDashboardUsage(userId);
      
      return res.json(usage);
    } catch (error) {
      console.error('Usage stats error:', error);
      return res.status(500).json({ message: 'Failed to get usage statistics' });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket server on a different path to avoid conflicts with Vite's HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active connections with userId for message targeting
  const clients = new Map<WebSocket, { userId: number, conversationIds: Set<number> }>();
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Set initial client data
    clients.set(ws, { userId: 0, conversationIds: new Set() });
    
    ws.on('message', async (messageData) => {
      try {
        const message = JSON.parse(messageData.toString());
        console.log('Received WebSocket message:', message.type);
        
        if (message.type === 'authenticate') {
          // Authenticate using token
          if (message.token && verifyToken(message.token)) {
            // For simplicity, using admin ID (1) for all token auth
            clients.set(ws, { 
              userId: 1, // Admin user ID
              conversationIds: new Set(message.conversationIds || [])
            });
            ws.send(JSON.stringify({ type: 'authenticated', userId: 1 }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
          }
        }
        else if (message.type === 'subscribe') {
          // Subscribe to conversation updates
          const clientData = clients.get(ws);
          if (clientData && clientData.userId) {
            clientData.conversationIds.add(message.conversationId);
            clients.set(ws, clientData);
            ws.send(JSON.stringify({ 
              type: 'subscribed', 
              conversationId: message.conversationId 
            }));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          }
        }
        else if (message.type === 'unsubscribe') {
          // Unsubscribe from conversation updates
          const clientData = clients.get(ws);
          if (clientData) {
            clientData.conversationIds.delete(message.conversationId);
            clients.set(ws, clientData);
          }
        }
        else if (message.type === 'chat_message') {
          // Process and broadcast chat message
          const clientData = clients.get(ws);
          if (!clientData || !clientData.userId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
            return;
          }
          
          // Validate required fields
          if (!message.conversationId || !message.content) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Missing required message data' 
            }));
            return;
          }
          
          try {
            // Save the message to database
            const chatMessage = await storage.createChatMessage({
              conversationId: message.conversationId,
              senderId: clientData.userId,
              content: message.content,
              isUrgent: message.isUrgent || false,
              attachmentUrl: message.attachmentUrl || null
            });
            
            // Get sender details to include in broadcast
            const sender = await storage.getUser(clientData.userId);
            
            // Broadcast to all clients subscribed to this conversation
            const broadcastMessage = {
              type: 'new_message',
              message: {
                ...chatMessage,
                sender: {
                  id: sender.id,
                  username: sender.username,
                  fullName: sender.fullName
                }
              }
            };
            
            // Send to all connected clients subscribed to this conversation
            for (const [client, data] of clients.entries()) {
              if (
                client.readyState === WebSocket.OPEN && 
                data.conversationIds.has(message.conversationId)
              ) {
                client.send(JSON.stringify(broadcastMessage));
              }
            }
            
            // Confirm to sender
            ws.send(JSON.stringify({ 
              type: 'message_sent', 
              messageId: chatMessage.id 
            }));
          } catch (error) {
            console.error('Error processing chat message:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Failed to process message' 
            }));
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove client from map when disconnected
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });
  
  // Log when the server is ready
  wss.on('listening', () => {
    console.log('WebSocket server is listening');
  });
  
  return httpServer;
}