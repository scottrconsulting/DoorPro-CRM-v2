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

      -- Make sure contacts has all new columns
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
        "source" TEXT,
        "company" TEXT,
        "tags" JSONB,
        "customer_since" TIMESTAMP,
        "preferred_contact_method" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add missing columns to contacts if they don't exist
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "source" TEXT;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "company" TEXT;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" JSONB;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "customer_since" TIMESTAMP;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "preferred_contact_method" TEXT;
      
      -- Make sure visits has all columns
      CREATE TABLE IF NOT EXISTS "visits" (
        "id" SERIAL PRIMARY KEY,
        "contact_id" INTEGER NOT NULL REFERENCES "contacts"("id"),
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "visit_type" TEXT NOT NULL,
        "notes" TEXT,
        "outcome" TEXT,
        "follow_up_needed" BOOLEAN DEFAULT FALSE,
        "follow_up_date" TIMESTAMP,
        "visit_date" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add missing columns to visits
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "follow_up_needed" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "visits" ADD COLUMN IF NOT EXISTS "follow_up_date" TIMESTAMP;
      
      -- Make sure schedules has all columns
      CREATE TABLE IF NOT EXISTS "schedules" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "title" TEXT NOT NULL,
        "description" TEXT,
        "start_time" TIMESTAMP NOT NULL,
        "end_time" TIMESTAMP NOT NULL,
        "type" TEXT NOT NULL,
        "location" TEXT,
        "contact_ids" JSONB,
        "reminder_sent" BOOLEAN DEFAULT FALSE,
        "reminder_time" TIMESTAMP,
        "calendar_event_id" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add missing columns to schedules
      ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "location" TEXT;
      ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "reminder_sent" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "reminder_time" TIMESTAMP;
      ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "calendar_event_id" TEXT;
      
      -- Make sure territories has all columns
      CREATE TABLE IF NOT EXISTS "territories" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "name" TEXT NOT NULL,
        "description" TEXT,
        "coordinates" JSONB,
        "coverage" INTEGER DEFAULT 0,
        "target_density" INTEGER DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Add missing columns to territories
      ALTER TABLE "territories" ADD COLUMN IF NOT EXISTS "target_density" INTEGER DEFAULT 0;
      
      -- Create sales table
      CREATE TABLE IF NOT EXISTS "sales" (
        "id" SERIAL PRIMARY KEY,
        "contact_id" INTEGER NOT NULL REFERENCES "contacts"("id"),
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "amount" DOUBLE PRECISION NOT NULL,
        "product" TEXT NOT NULL,
        "sale_date" TIMESTAMP NOT NULL,
        "status" TEXT NOT NULL,
        "payment_method" TEXT,
        "notes" TEXT,
        "commission" DOUBLE PRECISION,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      -- Create tasks table
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "contact_id" INTEGER REFERENCES "contacts"("id"),
        "title" TEXT NOT NULL,
        "description" TEXT,
        "due_date" TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "priority" TEXT DEFAULT 'medium',
        "completed" BOOLEAN DEFAULT FALSE,
        "completed_date" TIMESTAMP,
        "reminder_date" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      -- Create documents table
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "contact_id" INTEGER REFERENCES "contacts"("id"),
        "file_name" TEXT NOT NULL,
        "file_type" TEXT NOT NULL,
        "file_path" TEXT NOT NULL,
        "file_size" INTEGER NOT NULL,
        "description" TEXT,
        "category" TEXT DEFAULT 'general',
        "upload_date" TIMESTAMP NOT NULL DEFAULT NOW()
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