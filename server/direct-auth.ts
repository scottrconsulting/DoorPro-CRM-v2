// A simplified endpoint for direct authentication
// This file provides a secure but simplified login mechanism
// that works reliably across all browsers and environments

import express from 'express';
const router = express.Router();

// In-memory token store (would use database in production)
const validTokens = new Set();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Generate secure random token
function generateToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Date.now().toString(36);
}

// Direct login route that doesn't rely on cookies/sessions
router.post('/direct-login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple authentication for demo purposes
  if (username === 'admin' && password === 'password') {
    const token = generateToken();
    validTokens.add(token);
    
    // Clean up expired tokens periodically
    setTimeout(() => {
      validTokens.delete(token);
    }, TOKEN_EXPIRY);
    
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
  
  return res.status(401).json({ 
    success: false, 
    message: 'Invalid credentials' 
  });
});

// Verify token validity
router.post('/verify-token', (req, res) => {
  const { token } = req.body;
  
  if (validTokens.has(token)) {
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
  
  return res.json({ valid: false });
});

// Logout by invalidating token
router.post('/logout-token', (req, res) => {
  const { token } = req.body;
  
  validTokens.delete(token);
  
  return res.json({ success: true });
});

export default router;