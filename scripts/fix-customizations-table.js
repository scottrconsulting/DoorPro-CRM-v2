import { db } from '../server/db.ts';

async function main() {
  try {
    console.log("Fixing customizations table...");
    
    // Drop the existing table if it exists
    await db.execute(`DROP TABLE IF EXISTS customizations`);
    
    // Create a more complete customizations table matching the code expectations
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customizations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        team_id INTEGER REFERENCES teams(id),
        dashboard_widgets TEXT[],
        dashboard_widget_labels JSONB,
        theme TEXT,
        color_scheme TEXT,
        primary_color TEXT,
        secondary_color TEXT,
        accent_color TEXT,
        font_family TEXT,
        logo_url TEXT,
        enable_dark_mode BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log("Customizations table fixed successfully");
  } catch (error) {
    console.error("Error fixing customizations table:", error);
  } finally {
    process.exit(0);
  }
}

main();