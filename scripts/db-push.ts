import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "../shared/schema";

// Set websocket constructor for Neon database
neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log("Running migrations...");
  try {
    // Push the schema to the database
    await db.execute(`
      -- Create tables if they don't exist
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "username" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "full_name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'free',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "full_name" TEXT NOT NULL,
        "address" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "status" TEXT NOT NULL,
        "latitude" TEXT,
        "longitude" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS "visits" (
        "id" SERIAL PRIMARY KEY,
        "contact_id" INTEGER NOT NULL REFERENCES "contacts"("id"),
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "visit_type" TEXT NOT NULL,
        "notes" TEXT,
        "visit_date" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS "schedules" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "title" TEXT NOT NULL,
        "description" TEXT,
        "start_time" TIMESTAMP NOT NULL,
        "end_time" TIMESTAMP NOT NULL,
        "type" TEXT NOT NULL,
        "contact_ids" JSONB,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS "territories" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "name" TEXT NOT NULL,
        "description" TEXT,
        "coordinates" JSONB,
        "coverage" INTEGER DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log("Database schema pushed successfully");
  } catch (error) {
    console.error("Error pushing database schema:", error);
    process.exit(1);
  }

  await pool.end();
}

main();