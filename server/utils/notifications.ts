
import twilio from 'twilio';
import { db } from '../db';
import { messageTemplates } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize Twilio client
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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
    const token = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(token, value || '');
  }
  
  return result;
}

/**
 * Sends an email appointment confirmation using Twilio SendGrid
 */
export async function sendEmailConfirmation(appointmentInfo: AppointmentInfo): Promise<boolean> {
  if (!appointmentInfo.contactEmail) {
    console.error('Cannot send email confirmation: contact email is missing');
    return false;
  }
  
  try {
    const template = await getMessageTemplate('email', appointmentInfo.userId);
    
    if (!template) {
      console.error('No default email template found for user ID:', appointmentInfo.userId);
      return false;
    }
    
    const tokenData = {
      contact_name: appointmentInfo.contactName,
      appointment_date: appointmentInfo.date,
      appointment_time: appointmentInfo.time,
      address: appointmentInfo.address || '',
      notes: appointmentInfo.notes || '',
    };
    
    const subject = template.subject ? replaceTokens(template.subject, tokenData) : 'Appointment Confirmation';
    const htmlContent = replaceTokens(template.body, tokenData);
    
    // Send email using Twilio SendGrid
    await twilioClient.messages.create({
      body: htmlContent.replace(/<[^>]*>?/gm, ''), // Strip HTML for plain text
      from: process.env.TWILIO_EMAIL_FROM,
      to: appointmentInfo.contactEmail,
      subject: subject,
      contentType: 'text/html',
    });

    console.log(`Email confirmation sent to ${appointmentInfo.contactEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email confirmation:', error);
    return false;
  }
}

/**
 * Sends a text (SMS) appointment confirmation using Twilio
 */
export async function sendTextConfirmation(appointmentInfo: AppointmentInfo): Promise<boolean> {
  if (!appointmentInfo.contactPhone) {
    console.error('Cannot send text confirmation: contact phone is missing');
    return false;
  }
  
  try {
    const template = await getMessageTemplate('text', appointmentInfo.userId);
    
    if (!template) {
      console.error('No default text template found for user ID:', appointmentInfo.userId);
      return false;
    }
    
    const tokenData = {
      contact_name: appointmentInfo.contactName,
      appointment_date: appointmentInfo.date,
      appointment_time: appointmentInfo.time,
      address: appointmentInfo.address || '',
      notes: appointmentInfo.notes || '',
    };
    
    const textContent = replaceTokens(template.body, tokenData);
    
    // Send SMS using Twilio
    await twilioClient.messages.create({
      body: textContent,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: appointmentInfo.contactPhone
    });
    
    console.log(`SMS sent to ${appointmentInfo.contactPhone}`);
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
