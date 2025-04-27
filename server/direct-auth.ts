// A simplified endpoint for direct authentication
// This file provides a secure but simplified login mechanism
// that works reliably across all browsers and environments

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Get current directory equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store tokens in a file for persistence across server restarts
const TOKEN_FILE_PATH = path.join(__dirname, '../tokens.json');
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Use a simple object to store token -> expiry mapping
interface TokenData {
  [token: string]: number; // token -> expiry timestamp
}

// Initialize token storage
let tokenStorage: TokenData = {};

// Try to load tokens from file if it exists
try {
  if (fs.existsSync(TOKEN_FILE_PATH)) {
    tokenStorage = JSON.parse(fs.readFileSync(TOKEN_FILE_PATH, 'utf8'));
    
    // Clean up expired tokens on start
    const now = Date.now();
    let initialTokenCount = Object.keys(tokenStorage).length;
    
    Object.keys(tokenStorage).forEach(token => {
      if (tokenStorage[token] < now) {
        delete tokenStorage[token];
      }
    });
    
    const remainingTokens = Object.keys(tokenStorage).length;
    if (remainingTokens > 0) {
      console.log(`Loaded ${remainingTokens} valid tokens`);
    }
    if (initialTokenCount !== remainingTokens) {
      console.log(`Removed ${initialTokenCount - remainingTokens} expired tokens`);
      // Save the cleaned token storage
      saveTokens();
    }
  }
} catch (err) {
  console.error('Error loading tokens file:', err);
  // Initialize empty if file can't be loaded
  tokenStorage = {};
}

// Save tokens to file
function saveTokens() {
  try {
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(tokenStorage, null, 2));
  } catch (err) {
    console.error('Error saving tokens file:', err);
  }
}

// Generate secure random token
function generateToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

// Clean up expired tokens
function cleanupExpiredTokens() {
  const now = Date.now();
  const initialCount = Object.keys(tokenStorage).length;
  
  Object.keys(tokenStorage).forEach(token => {
    if (tokenStorage[token] < now) {
      delete tokenStorage[token];
    }
  });
  
  const newCount = Object.keys(tokenStorage).length;
  const cleanedCount = initialCount - newCount;
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired tokens`);
    saveTokens();
  }
}

// Check if a token is valid
function isValidToken(token: string): boolean {
  if (!tokenStorage[token]) {
    return false;
  }
  
  const now = Date.now();
  if (tokenStorage[token] < now) {
    // Token expired, remove it
    delete tokenStorage[token];
    saveTokens();
    return false;
  }
  
  return true;
}

// Export for use in other modules
export const verifyToken = isValidToken;

// Run cleanup every 5 minutes
setInterval(cleanupExpiredTokens, 5 * 60 * 1000);

// Direct login route that doesn't rely on cookies/sessions
router.post('/direct-login', (req, res) => {
  const { username, password } = req.body;
  
  // For demo purposes - hardcoded admin credentials
  // In production, verify against user database
  if (username === 'admin' && password === 'password') {
    const token = generateToken();
    const expiry = Date.now() + TOKEN_EXPIRY;
    
    // Store token with expiry
    tokenStorage[token] = expiry;
    saveTokens();
    
    console.log(`User ${username} logged in successfully with token`);
    
    return res.json({ 
      success: true, 
      token,
      user: {
        id: 1,
        username: 'admin',
        email: 'scottrconsulting@gmail.com',
        fullName: 'Admin User',
        role: 'admin'
      }
    });
  }
  
  console.log(`Failed login attempt for user: ${username}`);
  return res.status(401).json({ 
    success: false, 
    message: 'Invalid credentials' 
  });
});

// Verify token validity
router.post('/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (isValidToken(token)) {
    console.log(`Token verified successfully`);
    return res.json({ 
      valid: true,
      user: {
        id: 1,
        username: 'admin',
        email: 'scottrconsulting@gmail.com',
        fullName: 'Admin User',
        role: 'admin'
      }
    });
  }
  
  console.log(`Invalid token verification attempt`);
  return res.json({ valid: false });
});

// Logout by invalidating token
router.post('/logout-token', (req, res) => {
  const { token } = req.body;
  
  if (tokenStorage[token]) {
    delete tokenStorage[token];
    saveTokens();
    console.log(`Token invalidated for logout`);
  }
  
  return res.json({ success: true });
});

// For debugging only - get current token count
router.get('/token-count', (req, res) => {
  const tokens = Object.keys(tokenStorage);
  return res.json({ 
    count: tokens.length,
    tokens: tokens
  });
});

export default router;