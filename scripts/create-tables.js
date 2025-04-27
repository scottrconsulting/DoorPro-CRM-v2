import { db } from '../server/db.ts';
import { customizations } from '../shared/schema.ts';

async function main() {
  try {
    console.log("Creating missing tables...");
    
    // Create customizations table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customizations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        team_id INTEGER REFERENCES teams(id),
        dashboard_widgets TEXT[],
        dashboard_widget_labels JSONB,
        theme TEXT,
        color_scheme TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    process.exit(0);
  }
}

main();