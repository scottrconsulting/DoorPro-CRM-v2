import { db } from '../server/db';
import { pool } from '../server/db';

async function main() {
  try {
    console.log("Adding appointment field to contacts table...");
    
    // Check if the column already exists to avoid errors
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'appointment'
    `;
    
    // Use direct pool query to get raw results
    const { rows } = await pool.query(checkColumnQuery);
    
    if (rows.length === 0) {
      // Add the column if it doesn't exist
      await pool.query(`
        ALTER TABLE contacts
        ADD COLUMN appointment TEXT
      `);
      console.log("Successfully added appointment column to contacts table");
    } else {
      console.log("Appointment column already exists in contacts table");
    }
    
  } catch (error) {
    console.error("Error adding appointment field:", error);
  } finally {
    process.exit(0);
  }
}

main();