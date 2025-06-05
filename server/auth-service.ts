// Secure authentication service to replace hardcoded credentials
import crypto from 'crypto';
import { db } from './db';
import { authTokens, users } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './utils/password';

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const API_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

// Generate cryptographically secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Create authentication token
export async function createAuthToken(
  userId: number, 
  tokenType: 'session' | 'api' | 'password_reset' | 'email_verification',
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (tokenType === 'api' ? API_TOKEN_EXPIRY : TOKEN_EXPIRY));

  await db.insert(authTokens).values({
    userId,
    tokenHash,
    tokenType,
    expiresAt,
    ipAddress,
    userAgent,
  });

  return token;
}

// Verify token and return user if valid
export async function verifyAuthToken(token: string, tokenType?: string): Promise<AuthUser | null> {
  const tokenHash = hashToken(token);
  
  try {
    const result = await db
      .select({
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
        },
        token: authTokens
      })
      .from(authTokens)
      .innerJoin(users, eq(authTokens.userId, users.id))
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.isRevoked, false),
          gt(authTokens.expiresAt, new Date()),
          tokenType ? eq(authTokens.tokenType, tokenType) : undefined
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Update last used timestamp
    await db
      .update(authTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(authTokens.id, result[0].token.id));

    return result[0].user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Authenticate user with username/password
export async function authenticateUser(username: string, password: string): Promise<AuthUser | null> {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    const isValidPassword = verifyPassword(user.password, password);

    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Revoke token
export async function revokeToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  
  try {
    const result = await db
      .update(authTokens)
      .set({ isRevoked: true })
      .where(eq(authTokens.tokenHash, tokenHash));

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Token revocation error:', error);
    return false;
  }
}

// Clean up expired tokens
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await db
      .delete(authTokens)
      .where(
        and(
          lt(authTokens.expiresAt, new Date()),
          eq(authTokens.isRevoked, false)
        )
      );

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Token cleanup error:', error);
    return 0;
  }
}

// Revoke all user tokens (for logout all sessions)
export async function revokeAllUserTokens(userId: number, tokenType?: string): Promise<number> {
  try {
    const conditions = [
      eq(authTokens.userId, userId),
      eq(authTokens.isRevoked, false)
    ];
    
    if (tokenType) {
      conditions.push(eq(authTokens.tokenType, tokenType));
    }

    const result = await db
      .update(authTokens)
      .set({ isRevoked: true })
      .where(and(...conditions));

    return result.rowCount ?? 0;
  } catch (error) {
    console.error('Bulk token revocation error:', error);
    return 0;
  }
}

// Create admin user if none exists
export async function createAdminUser(
  username: string,
  email: string,
  password: string,
  fullName: string
): Promise<AuthUser | null> {
  try {
    // Check if any admin users exist
    const existingAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1);

    if (existingAdmins.length > 0) {
      throw new Error('Admin user already exists');
    }

    const hashedPassword = await hashPassword(password);
    
    const result = await db
      .insert(users)
      .values({
        username,
        email,
        password: hashedPassword,
        fullName,
        role: 'admin',
        status: 'active',
      })
      .returning();

    if (result.length === 0) {
      return null;
    }

    const user = result[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  } catch (error) {
    console.error('Admin user creation error:', error);
    return null;
  }
}

// Run cleanup every 5 minutes
setInterval(async () => {
  const cleanedCount = await cleanupExpiredTokens();
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired tokens`);
  }
}, 5 * 60 * 1000);