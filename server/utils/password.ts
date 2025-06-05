import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

// Password utility functions using bcrypt for secure hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (storedPassword: string, suppliedPassword: string): Promise<boolean> => {
  try {
    // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    if (storedPassword.startsWith('$2')) {
      return await bcrypt.compare(suppliedPassword, storedPassword);
    }
    
    // Legacy support for PBKDF2 hashes (contains colon)
    if (storedPassword.includes(':')) {
      const { pbkdf2Sync } = await import('crypto');
      const [salt, hash] = storedPassword.split(':');
      const suppliedHash = pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
      return hash === suppliedHash;
    }
    
    return false;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};

// Generate a random token for password reset
export const generateResetToken = (): string => {
  return randomBytes(32).toString('hex');
};