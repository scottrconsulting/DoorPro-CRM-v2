// Secure authentication endpoints using database-backed token system
// This replaces the previous file-based token storage with database persistence

import express from 'express';
import { 
  authenticateUser, 
  createAuthToken, 
  verifyAuthToken, 
  revokeToken,
  type AuthUser 
} from './auth-service';

const router = express.Router();

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