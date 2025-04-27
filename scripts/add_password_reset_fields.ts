import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Adding password reset fields to users table...');
  
  try {
    // Add reset_token column if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_token TEXT,
      ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
    `);
    
    console.log('Password reset fields added successfully.');
  } catch (error) {
    console.error('Failed to add password reset fields:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();