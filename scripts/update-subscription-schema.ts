import { pool } from "../server/db";

async function main() {
  try {
    console.log("Starting schema update for subscription fields...");
    
    // Add missing columns to users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_status TEXT;
    `);
    
    console.log("✅ Successfully added stripe_subscription_id and subscription_status to users table");
    
    // Make sure the teams table also has the necessary columns
    await pool.query(`
      ALTER TABLE teams 
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_status TEXT;
    `);
    
    console.log("✅ Successfully ensured teams table has all required stripe fields");
    
    console.log("Schema update complete!");
  } catch (error) {
    console.error("Error updating schema:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);