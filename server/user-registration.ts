// Enhanced user registration service with email verification and subscription integration
import { db } from './db';
import { users, authTokens } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from './utils/password';
import { createAuthToken } from './auth-service';
import type { AuthUser } from './auth-service';

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  fullName: string;
  subscriptionTier?: 'free' | 'pro';
}

// Register new user with email verification
export async function registerUser(data: RegistrationData): Promise<{ success: boolean; message: string; user?: AuthUser; verificationToken?: string }> {
  try {
    // Check if username already exists
    const existingUsername = await db
      .select()
      .from(users)
      .where(eq(users.username, data.username))
      .limit(1);

    if (existingUsername.length > 0) {
      return { 
        success: false, 
        message: `Username "${data.username}" is already taken. Please choose a different username.`,
        field: 'username'
      };
    }

    // Check if email already exists
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingEmail.length > 0) {
      return { 
        success: false, 
        message: `Email address "${data.email}" is already registered. Please use a different email or sign in to your existing account.`,
        field: 'email'
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user with pending status for email verification
    const result = await db
      .insert(users)
      .values({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        fullName: data.fullName,
        role: data.subscriptionTier || 'free',
        status: 'pending', // User must verify email before activation
      })
      .returning();

    if (result.length === 0) {
      return { success: false, message: 'Failed to create user account' };
    }

    const newUser = result[0];

    // Create email verification token
    const verificationToken = await createAuthToken(
      newUser.id,
      'email_verification'
    );

    const user: AuthUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
    };

    return {
      success: true,
      message: 'Account created successfully. Please check your email for verification.',
      user,
      verificationToken
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Registration failed. Please try again.' };
  }
}

// Verify email with token
export async function verifyEmail(token: string): Promise<{ success: boolean; message: string; user?: AuthUser }> {
  try {
    // Find the verification token
    const tokenResult = await db
      .select({
        userId: authTokens.userId,
        token: authTokens
      })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, token),
          eq(authTokens.tokenType, 'email_verification'),
          eq(authTokens.isRevoked, false)
        )
      )
      .limit(1);

    if (tokenResult.length === 0) {
      return { success: false, message: 'Invalid or expired verification token' };
    }

    const { userId } = tokenResult[0];

    // Activate the user account
    const userResult = await db
      .update(users)
      .set({ status: 'active' })
      .where(eq(users.id, userId))
      .returning();

    if (userResult.length === 0) {
      return { success: false, message: 'Failed to activate account' };
    }

    // Revoke the verification token
    await db
      .update(authTokens)
      .set({ isRevoked: true })
      .where(eq(authTokens.id, tokenResult[0].token.id));

    const user = userResult[0];
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    return {
      success: true,
      message: 'Email verified successfully. Your account is now active.',
      user: authUser
    };
  } catch (error) {
    console.error('Email verification error:', error);
    return { success: false, message: 'Email verification failed' };
  }
}

// Resend verification email
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message: string; verificationToken?: string }> {
  try {
    // Find user with pending status
    const userResult = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.status, 'pending')
        )
      )
      .limit(1);

    if (userResult.length === 0) {
      return { success: false, message: 'No pending account found for this email' };
    }

    const user = userResult[0];

    // Revoke existing verification tokens
    await db
      .update(authTokens)
      .set({ isRevoked: true })
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.tokenType, 'email_verification')
        )
      );

    // Create new verification token
    const verificationToken = await createAuthToken(
      user.id,
      'email_verification'
    );

    return {
      success: true,
      message: 'Verification email sent successfully',
      verificationToken
    };
  } catch (error) {
    console.error('Resend verification error:', error);
    return { success: false, message: 'Failed to resend verification email' };
  }
}

// Check if username is available
export async function checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return { available: result.length === 0 };
  } catch (error) {
    console.error('Username check error:', error);
    return { available: false };
  }
}

// Check if email is available
export async function checkEmailAvailability(email: string): Promise<{ available: boolean }> {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return { available: result.length === 0 };
  } catch (error) {
    console.error('Email check error:', error);
    return { available: false };
  }
}

// Update user subscription tier
export async function updateUserSubscription(userId: number, tier: 'free' | 'pro' | 'admin'): Promise<{ success: boolean; message: string }> {
  try {
    const result = await db
      .update(users)
      .set({ role: tier })
      .where(eq(users.id, userId))
      .returning();

    if (result.length === 0) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, message: 'Subscription updated successfully' };
  } catch (error) {
    console.error('Subscription update error:', error);
    return { success: false, message: 'Failed to update subscription' };
  }
}