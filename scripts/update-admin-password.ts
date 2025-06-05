import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Updating admin password...');

  const newPassword = 'SecureAdmin123!';
  const saltRounds = 12;
  
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update the admin user's password
    const result = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date()
      })
      .where(eq(users.username, 'admin'))
      .returning({ id: users.id, username: users.username });

    if (result.length > 0) {
      console.log('Admin password updated successfully for user:', result[0].username);
      console.log('New password:', newPassword);
    } else {
      console.log('Admin user not found');
    }
  } catch (error) {
    console.error('Error updating admin password:', error);
  }

  process.exit(0);
}

main();