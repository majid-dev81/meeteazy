// app/api/send-decline/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM;

// Define the structure for additional invitees
interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}

// Define the props for the email template component
interface DeclineEmailProps {
  recipientName: string;
  recipientType: 'requester' | 'invitee';
  ownerName: string;
  requesterName: string;
  additionalInvitees?: AdditionalInvitee[];
  subject: string;
  date: string;
  time: string;
  rebookUrl?: string;
}

/**
 * A React-like component to generate the HTML for the decline email.
 * This component tailors the message based on whether the recipient is the
 * original meeting requester or an additional invitee.
 */
const DeclineEmail = ({
  recipientName,
  recipientType,
  ownerName,
  requesterName,
  additionalInvitees = [],
  subject,
  date,
  time,
  rebookUrl,
}: DeclineEmailProps): string => {
  const isRequester = recipientType === 'requester';
  
  // Build a list of all attendees to display in the email
  const allAttendees = [
    { name: requesterName, role: 'Organizer' },
    ...additionalInvitees.map((inv: AdditionalInvitee) => ({ name: inv.name, role: 'Attendee' }))
  ];

  const attendeesHtml = additionalInvitees.length > 0 ? `
    <div style="margin: 15px 0;">
      <strong>Meeting was scheduled with:</strong>
      <ul style="margin: 8px 0; padding-left: 20px;">
        ${allAttendees.map(attendee => `
          <li style="margin: 4px 0;">${attendee.name} (${attendee.role})</li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  // Show a "Reschedule" section only to the original requester
  const rebookSection = isRequester && rebookUrl ? `
    <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-weight: bold; color: #1e40af;">Want to reschedule?</p>
      <p style="margin: 8px 0;">You can try booking another time that works:</p>
      <p style="margin: 8px 0;">
        <a href="${rebookUrl}" 
           style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Book a New Time
        </a>
      </p>
    </div>
  ` : '';

  // Customize the main greeting text based on the recipient
  const greetingText = isRequester 
    ? `Unfortunately, ${ownerName} had to decline your meeting request.`
    : `Unfortunately, the meeting you were invited to by ${requesterName} with ${ownerName} has been declined.`;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="font-size: 24px; color: #dc2626;">Meeting Request Declined</h1>
      <p>Hi ${recipientName},</p>
      <p>${greetingText}</p>
      
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <h2 style="font-size: 18px; margin-top: 0; border-bottom: 1px solid #fca5a5; padding-bottom: 8px; color: #991b1b;">
          Declined Meeting Details
        </h2>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Host:</strong> ${ownerName}</p>
        ${attendeesHtml}
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
      </div>

      ${rebookSection}

      <p>Thanks for understanding.</p>
      <p style="font-size: 12px; color: #888; margin-top: 32px;">
        This email was sent from Meeteazy.
      </p>
    </div>
  `;
};

/**
 * API route handler for sending meeting decline notifications.
 * It sends emails in parallel to the requester and all additional invitees.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      requesterEmail,
      requesterName,
      ownerName,
      additionalInvitees = [],
      subject,
      date,
      time,
      rebookUrl,
    } = await req.json();

    // 1. Validate the incoming request body
    if (!requesterEmail || !requesterName || !ownerName || !subject || !date || !time || !fromEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validInvitees = additionalInvitees.filter((inv: AdditionalInvitee) => 
      inv && inv.name && inv.email && inv.email.includes('@')
    );

    // 2. Create a list of all recipients (requester + valid invitees)
    const allRecipients = [
      {
        name: requesterName,
        email: requesterEmail,
        type: 'requester' as const,
      },
      ...validInvitees.map((invitee: AdditionalInvitee) => ({
        name: invitee.name,
        email: invitee.email,
        type: 'invitee' as const,
      })),
    ];

    // 3. Create an array of email-sending promises
    // Each promise sends one email. They will all be executed in parallel.
    const emailPromises = allRecipients.map(recipient => {
      const emailHtml = DeclineEmail({
        recipientName: recipient.name,
        recipientType: recipient.type,
        ownerName,
        requesterName,
        additionalInvitees: validInvitees,
        subject,
        date,
        time,
        rebookUrl: recipient.type === 'requester' ? rebookUrl : undefined,
      });

      return resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: `Meeting Declined – ${subject}`,
        html: emailHtml,
      });
    });
    
    console.log(`📩 Sending decline notifications to ${emailPromises.length} recipients...`);

    // 4. Execute all promises concurrently with Promise.allSettled
    // This waits for all promises to either fulfill or reject.
    const results = await Promise.allSettled(emailPromises);

    // 5. Process the results to create a detailed summary
    const emailResults = results.map((result, index) => {
      const recipientIdentifier = `${allRecipients[index].type}-${allRecipients[index].name}`;
      
      if (result.status === 'fulfilled') {
        // The promise resolved, but we still check for Resend's API-level errors
        const { data, error } = result.value;
        if (error) {
          console.error(`❌ Resend API error for ${recipientIdentifier}:`, error);
          return { recipient: recipientIdentifier, status: 'failed', error: error.message };
        }
        return { recipient: recipientIdentifier, status: 'success', id: data?.id };
      } 
      
      // The promise itself was rejected (e.g., network error)
      console.error(`❌ Failed to send to ${recipientIdentifier}:`, result.reason);
      const error = result.reason as Error;
      return { recipient: recipientIdentifier, status: 'failed', error: error.message };
    });

    // 6. Return a summary response
    const successCount = emailResults.filter(r => r.status === 'success').length;
    const totalCount = emailResults.length;
    const hasErrors = successCount < totalCount;

    if (hasErrors) {
      console.warn(`⚠️ Some decline emails failed to send: ${totalCount - successCount}/${totalCount} failed.`);
    }

    return NextResponse.json({ 
      success: !hasErrors, 
      message: `Decline notifications processed for ${totalCount} recipients. Successful: ${successCount}, Failed: ${totalCount - successCount}.`,
      details: emailResults,
    }, { status: 200 });

  } catch (err) {
    // Catch any unexpected errors during request parsing or setup
    console.error('❌ Unhandled error in send-decline route:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}