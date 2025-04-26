import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Configure the database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  webSocketConstructor: ws
});

async function main() {
  console.log("Creating chat tables...");
  
  // Create chat_conversations table
  const createChatConversations = `
    CREATE TABLE IF NOT EXISTS "chat_conversations" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT,
      "team_id" INTEGER REFERENCES "teams"("id"),
      "is_team_channel" BOOLEAN DEFAULT false,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  
  // Create chat_participants table
  const createChatParticipants = `
    CREATE TABLE IF NOT EXISTS "chat_participants" (
      "id" SERIAL PRIMARY KEY,
      "conversation_id" INTEGER NOT NULL REFERENCES "chat_conversations"("id"),
      "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
      "is_admin" BOOLEAN DEFAULT false,
      "last_read_timestamp" TIMESTAMP,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  
  // Create chat_messages table
  const createChatMessages = `
    CREATE TABLE IF NOT EXISTS "chat_messages" (
      "id" SERIAL PRIMARY KEY,
      "conversation_id" INTEGER NOT NULL REFERENCES "chat_conversations"("id"),
      "sender_id" INTEGER NOT NULL REFERENCES "users"("id"),
      "content" TEXT NOT NULL,
      "attachment_url" TEXT,
      "is_read" BOOLEAN DEFAULT false,
      "is_urgent" BOOLEAN DEFAULT false,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  
  try {
    await pool.query(createChatConversations);
    console.log("Created chat_conversations table");
    
    await pool.query(createChatParticipants);
    console.log("Created chat_participants table");
    
    await pool.query(createChatMessages);
    console.log("Created chat_messages table");
    
    console.log("All chat tables created successfully!");
  } catch (error) {
    console.error("Error creating chat tables:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);