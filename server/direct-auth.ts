// Secure authentication endpoints using database-backed token system
// This replaces the previous file-based token storage with database persistence

import express from 'express';
import { 
  authenticateUser, 
  createAuthToken, 
  verifyAuthToken, 
  revokeToken,
  createAdminUser,
  type AuthUser 
} from './auth-service';

const router = express.Router();

// Direct login route using secure database authentication
router.post('/direct-login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  try {
    const user = await authenticateUser(username, password);
    
    if (!user) {
      console.log(`Failed login attempt for user: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = await createAuthToken(
      user.id,
      'session',
      req.ip,
      req.get('User-Agent')
    );

    console.log(`User ${username} logged in successfully`);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify token validity
router.post('/verify-token', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.json({ valid: false });
  }

  try {
    const user = await verifyAuthToken(token, 'session');
    
    if (user) {
      console.log(`Token verified successfully for user: ${user.username}`);
      return res.json({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      });
    }

    console.log(`Invalid token verification attempt`);
    return res.json({ valid: false });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.json({ valid: false });
  }
});

// Logout by invalidating token
router.post('/logout-token', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.json({ success: true });
  }

  try {
    await revokeToken(token);
    console.log(`Token invalidated for logout`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.json({ success: true }); // Return success even if revocation fails
  }
});

// Create initial admin user (for first-time setup)
router.post('/create-admin', async (req, res) => {
  const { username, email, password, fullName } = req.body;
  
  if (!username || !email || !password || !fullName) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  try {
    const adminUser = await createAdminUser(username, email, password, fullName);
    
    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists or creation failed'
      });
    }

    console.log(`Admin user created: ${username}`);
    return res.json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        fullName: adminUser.fullName,
        role: adminUser.role
      }
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin user'
    });
  }
});

// Export verification function for middleware
export const verifyToken = async (token: string): Promise<AuthUser | null> => {
  return verifyAuthToken(token, 'session');
};

export default router;