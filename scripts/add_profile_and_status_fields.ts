import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Adding profile picture and online status fields to users table...");
    
    // Add profile_picture_url column to users table
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
      ADD COLUMN IF NOT EXISTS last_active TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE
    `);
    
    console.log("✅ Successfully added fields to users table");
    
    await pool.end();
    
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();