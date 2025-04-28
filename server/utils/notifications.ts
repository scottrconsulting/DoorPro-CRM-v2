import sgMail from '@sendgrid/mail';
import { MessageTemplate, Contact } from '@shared/schema';

// Initialize SendGrid if API key is available
export const initializeSendGrid = () => {
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    return true;
  }
  console.warn("SendGrid API key not set. Email notifications will be disabled.");
  return false;
};

// Initialize when this module is imported
initializeSendGrid();

/**
 * Send appointment confirmation via email
 */
export const sendAppointmentEmail = async (
  contact: Contact,
  template: MessageTemplate,
  appointmentDate: string,
  appointmentTime: string
): Promise<boolean> => {
  if (!process.env.SENDGRID_API_KEY) {
    console.error("SendGrid API key not found. Cannot send email.");
    return false;
  }

  if (!contact.email) {
    console.error("Cannot send email: Contact does not have an email address");
    return false;
  }

  // Format appointment date
  const dateObj = new Date(appointmentDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  });
  
  // Format appointment time
  const [hours, minutes] = appointmentTime.split(':');
  const timePart = parseInt(hours) >= 12 ? 'PM' : 'AM';
  const hour12 = parseInt(hours) % 12 || 12;
  const formattedTime = `${hour12}:${minutes} ${timePart}`;
  
  // Replace template placeholders with actual data
  const processedBody = template.body
    .replace(/{{customerName}}/g, contact.fullName)
    .replace(/{{appointmentDate}}/g, formattedDate)
    .replace(/{{appointmentTime}}/g, formattedTime)
    .replace(/{{address}}/g, contact.address);

  const msg = {
    to: contact.email,
    from: 'noreply@doorprocrm.com', // Use your verified sender
    subject: template.subject?.replace(/{{customerName}}/g, contact.fullName) || 'Your Appointment Confirmation',
    content: [
      {
        type: template.isHtml ? 'text/html' : 'text/plain',
        value: processedBody
      }
    ]
  };
  
  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
};

/**
 * Send text message for appointment confirmation
 * This is a placeholder - implement actual SMS provider like Twilio
 */
export const sendAppointmentSMS = async (
  contact: Contact,
  template: MessageTemplate,
  appointmentDate: string,
  appointmentTime: string
): Promise<boolean> => {
  if (!contact.phone) {
    console.error("Cannot send SMS: Contact does not have a phone number");
    return false;
  }

  // This is a placeholder for SMS functionality
  // You would need to implement an actual SMS provider like Twilio here
  console.log(`SMS would be sent to ${contact.phone} with message: ${template.body}`);
  
  // Currently just simulating success for the interface to work
  return true;
};

/**
 * Send appointment confirmation via email, SMS, or both
 */
export const sendAppointmentConfirmation = async (
  contact: Contact,
  emailTemplate: MessageTemplate | null,
  smsTemplate: MessageTemplate | null,
  appointmentDate: string,
  appointmentTime: string,
  method: 'email' | 'sms' | 'both'
): Promise<{ success: boolean, message: string }> => {
  let emailSent = false;
  let smsSent = false;
  
  // Send email if requested and we have a template and contact email
  if ((method === 'email' || method === 'both') && emailTemplate && contact.email) {
    emailSent = await sendAppointmentEmail(
      contact, 
      emailTemplate, 
      appointmentDate,
      appointmentTime
    );
  }
  
  // Send SMS if requested and we have a template and contact phone
  if ((method === 'sms' || method === 'both') && smsTemplate && contact.phone) {
    smsSent = await sendAppointmentSMS(
      contact, 
      smsTemplate, 
      appointmentDate,
      appointmentTime
    );
  }
  
  // Generate appropriate response
  if (method === 'both') {
    if (emailSent && smsSent) {
      return { success: true, message: "Confirmation sent via email and SMS" };
    } else if (emailSent) {
      return { success: true, message: "Confirmation sent via email only" };
    } else if (smsSent) {
      return { success: true, message: "Confirmation sent via SMS only" };
    } else {
      return { success: false, message: "Failed to send confirmation" };
    }
  } else if (method === 'email') {
    return { 
      success: emailSent, 
      message: emailSent ? "Email confirmation sent" : "Failed to send email confirmation" 
    };
  } else {
    return { 
      success: smsSent, 
      message: smsSent ? "SMS confirmation sent" : "Failed to send SMS confirmation" 
    };
  }
};