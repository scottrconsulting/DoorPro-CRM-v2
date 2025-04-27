import { db } from "../server/db";
import { sql } from "drizzle-orm";

// Script to add city, state, and zipCode columns to contacts table
async function main() {
  try {
    console.log("Adding city, state, and zipCode columns to contacts table...");
    
    // Add the city column
    await db.execute(sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city TEXT`);
    
    // Add the state column
    await db.execute(sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state TEXT`);
    
    // Add the zip_code column
    await db.execute(sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zip_code TEXT`);
    
    console.log("Migration completed successfully!");
    
    // Close the database connection
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();