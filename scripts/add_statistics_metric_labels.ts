import { drizzle } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

async function main() {
  console.log("Starting migration: Adding statistics_metric_labels column to customizations table...");
  
  // Connect to the database
  const sql = neon(DATABASE_URL);
  
  try {
    // Check if column exists first to avoid errors
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customizations' 
      AND column_name = 'statistics_metric_labels';
    `;
    
    const checkResult = await sql(checkColumnQuery);
    
    if (checkResult.length > 0) {
      console.log("Column statistics_metric_labels already exists. Skipping migration.");
      return;
    }
    
    // Add the new column
    const migrationQuery = `
      ALTER TABLE customizations 
      ADD COLUMN statistics_metric_labels JSONB DEFAULT '{}';
    `;
    
    await sql(migrationQuery);
    
    console.log("Migration complete: Added statistics_metric_labels column to customizations table.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
  // No need to close the connection for neon SQL
}

main().catch((err) => {
  console.error("Migration script error:", err);
  process.exit(1);
});