import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Starting schema update...");

  try {
    // Update teams table
    await db.execute(sql`
      ALTER TABLE IF EXISTS teams
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_status TEXT;
    `);
    console.log("Updated teams table");

    // Update users table
    await db.execute(sql`
      ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS invitation_token TEXT,
      ADD COLUMN IF NOT EXISTS invitation_expiry TIMESTAMP;
    `);
    console.log("Updated users table");

    // Create chat tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        name TEXT,
        team_id INTEGER REFERENCES teams(id),
        is_team_channel BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS chat_participants (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        is_admin BOOLEAN DEFAULT FALSE,
        last_read_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        attachment_url TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        is_urgent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("Created chat tables");

    console.log("Schema update completed successfully");
  } catch (error) {
    console.error("Error updating schema:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();