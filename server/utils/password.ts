import { randomBytes, pbkdf2Sync } from 'crypto';

// Password utility functions
export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (storedPassword: string, suppliedPassword: string): boolean => {
  const [salt, hash] = storedPassword.split(':');
  const suppliedHash = pbkdf2Sync(suppliedPassword, salt, 10000, 64, 'sha512').toString('hex');
  return hash === suppliedHash;
};

// Generate a random token for password reset
export const generateResetToken = (): string => {
  return randomBytes(32).toString('hex');
};