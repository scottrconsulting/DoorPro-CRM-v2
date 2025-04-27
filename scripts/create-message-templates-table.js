import { db } from '../server/db.ts';

async function main() {
  try {
    console.log("Creating message_templates table...");
    
    // Create the message_templates table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        team_id INTEGER REFERENCES teams(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        body TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log("Message_templates table created successfully");
  } catch (error) {
    console.error("Error creating message_templates table:", error);
  } finally {
    process.exit(0);
  }
}

main();