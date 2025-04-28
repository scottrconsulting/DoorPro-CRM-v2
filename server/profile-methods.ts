import { users } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { User } from "../shared/schema";

// Method to update user profile picture
export async function updateProfilePicture(userId: number, profilePictureUrl: string): Promise<User | undefined> {
  try {
    const result = await db.update(users)
      .set({ 
        profilePictureUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
      
    return result[0];
  } catch (error) {
    console.error("Error updating profile picture:", error);
    return undefined;
  }
}

// Method to update user online status
export async function updateUserOnlineStatus(userId: number, isOnline: boolean): Promise<User | undefined> {
  try {
    const result = await db.update(users)
      .set({ 
        isOnline,
        lastActive: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
      
    return result[0];
  } catch (error) {
    console.error("Error updating user online status:", error);
    return undefined;
  }
}

// Method to update user last active time
export async function updateUserLastActive(userId: number, lastActive: Date): Promise<User | undefined> {
  try {
    const result = await db.update(users)
      .set({ 
        lastActive,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
      
    return result[0];
  } catch (error) {
    console.error("Error updating user last active time:", error);
    return undefined;
  }
}