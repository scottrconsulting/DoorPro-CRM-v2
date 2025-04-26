import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

// Set websocket constructor for Neon database
neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  console.log("Connecting to database...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, "scottrconsulting@gmail.com"));
    
    if (existingUser.length > 0) {
      console.log("Admin user already exists!");
      await pool.end();
      return;
    }
    
    // Create the admin user
    const result = await db.insert(users).values({
      username: "admin",
      password: "password", // In a real app, this would be hashed
      email: "scottrconsulting@gmail.com",
      fullName: "Admin User",
      role: "admin"
    }).returning();
    
    console.log("Admin user created successfully:", result[0]);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }

  await pool.end();
}

main();