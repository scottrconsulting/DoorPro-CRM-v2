import { db, pool } from '../server/db';
import * as schema from '../shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding new channel fields to chat_conversations table...');
    
    // Add is_channel_type column
    await pool.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS is_channel_type BOOLEAN DEFAULT false;
    `);
    console.log('Added is_channel_type column');
    
    // Add channel_tag column
    await pool.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS channel_tag TEXT;
    `);
    console.log('Added channel_tag column');
    
    // Add is_public column
    await pool.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
    `);
    console.log('Added is_public column');
    
    // Add creator_id column
    await pool.query(`
      ALTER TABLE chat_conversations
      ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES users(id);
    `);
    console.log('Added creator_id column');
    
    console.log('Successfully added new channel fields to chat_conversations table');
  } catch (error) {
    console.error('Error adding channel fields:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed to add channel fields:', err);
    process.exit(1);
  });