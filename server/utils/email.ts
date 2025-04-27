import sgMail from '@sendgrid/mail';

// Initialize SendGrid if API key is available
export const initializeSendGrid = () => {
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    return true;
  }
  return false;
};

// Send password reset email
export const sendPasswordResetEmail = async (
  email: string, 
  resetToken: string, 
  baseUrl: string
): Promise<boolean> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error("SendGrid API key not found. Cannot send password reset email.");
    return false;
  }

  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  
  const msg = {
    to: email,
    from: 'noreply@doorprocrm.com', // Use your verified sender
    subject: 'Password Reset for DoorPro CRM',
    text: `You requested a password reset. Please click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your DoorPro CRM account.</p>
        <p>Please click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr/>
        <p style="font-size: 12px; color: #666;">DoorPro CRM - Door-to-door sales management system</p>
      </div>
    `,
  };
  
  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
};