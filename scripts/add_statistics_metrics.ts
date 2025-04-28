import { pool } from "../server/db";

async function main() {
  try {
    console.log("Starting migration to add statistics_metrics column to customizations table...");
    
    // Add the statistics_metrics column to the customizations table
    await pool.query(`
      ALTER TABLE customizations 
      ADD COLUMN IF NOT EXISTS statistics_metrics TEXT[] DEFAULT '{}';
    `);
    
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

main();