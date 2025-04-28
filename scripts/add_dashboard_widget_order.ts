import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema';
import 'dotenv/config';
import ws from 'ws';

// Set WebSocket constructor for Neon
neonConfig.webSocketConstructor = ws;

async function main() {
  // Connect to the database
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('Adding dashboardWidgetOrder column to customizations table...');
  
  // Add the column using raw SQL
  await pool.query(`
    ALTER TABLE customizations 
    ADD COLUMN IF NOT EXISTS dashboard_widget_order TEXT[] DEFAULT '{}';
  `);
  
  console.log('Migration completed successfully.');
  
  // Close the connection
  await pool.end();
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});