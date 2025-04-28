import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { messageTemplates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface AppointmentInfo {
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  date: string;
  time: string;
  address?: string;
  notes?: string;
  userId: number;
}

/**
 * Fetches a message template by type and name
 */
async function getMessageTemplate(type: 'email' | 'text', userId: number, isDefault: boolean = true) {
  try {
    const template = await db.query.messageTemplates.findFirst({
      where: and(
        eq(messageTemplates.type, type),
        eq(messageTemplates.userId, userId),
        eq(messageTemplates.isDefault, isDefault)
      )
    });
    
    return template;
  } catch (error) {
    console.error(`Error fetching ${type} template:`, error);
    return null;
  }
}

/**
 * Replaces placeholder tokens in template with actual values
 */
function replaceTokens(template: string, data: Record<string, string>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(data)) {
    // Replace tokens in format {{token_name}}
    const token = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(token, value || '');
  }
  
  return result;
}

/**
 * Sends an email appointment confirmation
 */
export async function sendEmailConfirmation(appointmentInfo: AppointmentInfo): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return false;
  }
  
  if (!appointmentInfo.contactEmail) {
    console.error('Cannot send email confirmation: contact email is missing');
    return false;
  }
  
  try {
    // Fetch appropriate email template
    const template = await getMessageTemplate('email', appointmentInfo.userId);
    
    if (!template) {
      console.error('No default email template found for user ID:', appointmentInfo.userId);
      return false;
    }
    
    // Build token replacement data
    const tokenData = {
      contact_name: appointmentInfo.contactName,
      appointment_date: appointmentInfo.date,
      appointment_time: appointmentInfo.time,
      address: appointmentInfo.address || '',
      notes: appointmentInfo.notes || '',
    };
    
    // Replace tokens in template
    const subject = template.subject ? replaceTokens(template.subject, tokenData) : 'Appointment Confirmation';
    const htmlContent = replaceTokens(template.body, tokenData);
    
    // Send email
    const msg = {
      to: appointmentInfo.contactEmail,
      from: 'noreply@doorpro.app', // This should be your verified sender in SendGrid
      subject: subject,
      text: htmlContent.replace(/<[^>]*>?/gm, ''), // Plain text version
      html: htmlContent,
    };
    
    await sgMail.send(msg);
    console.log(`Email confirmation sent to ${appointmentInfo.contactEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email confirmation:', error);
    return false;
  }
}

/**
 * Sends a text (SMS) appointment confirmation
 * Note: This is a placeholder for a future SMS integration
 */
export async function sendTextConfirmation(appointmentInfo: AppointmentInfo): Promise<boolean> {
  if (!appointmentInfo.contactPhone) {
    console.error('Cannot send text confirmation: contact phone is missing');
    return false;
  }
  
  try {
    // Fetch appropriate text template
    const template = await getMessageTemplate('text', appointmentInfo.userId);
    
    if (!template) {
      console.error('No default text template found for user ID:', appointmentInfo.userId);
      return false;
    }
    
    // Build token replacement data
    const tokenData = {
      contact_name: appointmentInfo.contactName,
      appointment_date: appointmentInfo.date,
      appointment_time: appointmentInfo.time,
      address: appointmentInfo.address || '',
      notes: appointmentInfo.notes || '',
    };
    
    // Replace tokens in template
    const textContent = replaceTokens(template.body, tokenData);
    
    // In a real implementation, this would integrate with an SMS service like Twilio
    // For now, we'll just log the message
    console.log(`SMS would be sent to ${appointmentInfo.contactPhone}: ${textContent}`);
    
    return true;
  } catch (error) {
    console.error('Error sending text confirmation:', error);
    return false;
  }
}

/**
 * Sends appointment confirmations based on user preferences
 */
export async function sendAppointmentConfirmations(appointmentInfo: AppointmentInfo, 
                                                 methods: {email: boolean, text: boolean} = {email: true, text: false}): Promise<{email: boolean, text: boolean}> {
  const results = {
    email: false,
    text: false
  };
  
  if (methods.email && appointmentInfo.contactEmail) {
    results.email = await sendEmailConfirmation(appointmentInfo);
  }
  
  if (methods.text && appointmentInfo.contactPhone) {
    results.text = await sendTextConfirmation(appointmentInfo);
  }
  
  return results;
}