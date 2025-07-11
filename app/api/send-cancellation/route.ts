// app/api/send-cancellation/route.ts

import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { format, parse } from 'date-fns';

interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface CancellationEmailProps {
  recipientName: string;
  recipientType: 'requester' | 'invitee';
  ownerName: string;
  requesterName: string;
  additionalInvitees?: AdditionalInvitee[];
  subject: string;
  formattedDate: string;
  formattedTime: string;
  cancellationNote?: string;
  rebookUrl?: string; // Only for requester
}

const generateCancellationEmail = ({
  recipientName,
  recipientType,
  ownerName,
  requesterName,
  additionalInvitees = [],
  subject,
  formattedDate,
  formattedTime,
  cancellationNote,
  rebookUrl,
}: CancellationEmailProps): string => {
  // Build attendees list for display
  const allAttendees = [
    { name: requesterName, role: 'Organizer' },
    ...additionalInvitees.map(inv => ({ name: inv.name, role: 'Attendee' }))
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

  const rebookSection = recipientType === 'requester' && rebookUrl ? `
    <p>We apologize for any inconvenience this may cause. If you'd like to schedule another time, you can do so by visiting their booking page:</p>
    <p style="text-align: center; margin: 25px 0;">
      <a href="${rebookUrl}" style="background-color: #1a73e8; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Rebook a new time</a>
    </p>
  ` : recipientType === 'invitee' ? `
    <p>We apologize for any inconvenience this may cause.</p>
  ` : '';

  const greetingText = recipientType === 'requester' 
    ? `This is an automated notification to let you know that your meeting with <strong>${ownerName}</strong> has been canceled.`
    : `This is an automated notification to let you know that a meeting you were invited to has been canceled.`;

  const organizerInfo = recipientType === 'invitee' ? `
    <p><strong>Organized by:</strong> ${requesterName}</p>
    <p><strong>Host:</strong> ${ownerName}</p>
  ` : '';

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #d32f2f;">Meeting Canceled</h2>
      <p>Hi ${recipientName},</p>
      <p>${greetingText}</p>
      ${organizerInfo}
      <div style="background-color: #f9f9f9; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Canceled Meeting Details:</h3>
        <p><strong>Subject:</strong> ${subject}</p>
        ${attendeesHtml}
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
      </div>
      ${cancellationNote ? `
      <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <h3 style="margin-top: 0;">A note from ${ownerName}:</h3>
        <p style="white-space: pre-wrap;">${cancellationNote}</p>
      </div>
      ` : ''}
      ${rebookSection}
      <p>Best,</p>
      <p>The Meeteazy Team</p>
    </div>
  `;
};

export async function POST(req: NextRequest) {
  if (!fromEmail) {
    console.error("❌ EMAIL_FROM environment variable is not set.");
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const {
      ownerName,
      requesterEmail,
      requesterName,
      additionalInvitees = [], // 🎯 NEW: Additional invitees array
      date,
      time,
      subject,
      cancellationNote,
      rebookUrl
    } = body;

    console.log("📩 Received cancellation request with payload:", body);

    // Basic validation
    if (!ownerName || !requesterEmail || !requesterName || !date || !time || !subject || !rebookUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 🎯 VALIDATE ADDITIONAL INVITEES
    const validInvitees = (additionalInvitees as AdditionalInvitee[]).filter((inv) => 
      inv && inv.name && inv.email && inv.email.includes('@')
    );

    const meetingDate = parse(date, 'yyyy-MM-dd', new Date());
    const meetingTime = parse(time, 'HH:mm', new Date());

    const formattedDate = format(meetingDate, 'EEEE, MMMM d, yyyy');
    const formattedTime = format(meetingTime, 'h:mm a');

    // Ensure full URL for production
    const fullRebookUrl = rebookUrl.startsWith('http')
      ? rebookUrl
      : `${baseUrl}${rebookUrl.startsWith('/') ? rebookUrl : `/${rebookUrl}`}`;

    console.log(`📧 Sending cancellation notifications to ${1 + validInvitees.length} recipients`);

    const emailPromises = [];
    const emailResults = [];

    // --- Send to requester ---
    const requesterEmailHtml = generateCancellationEmail({
      recipientName: requesterName,
      recipientType: 'requester',
      ownerName,
      requesterName,
      additionalInvitees: validInvitees,
      subject,
      formattedDate,
      formattedTime,
      cancellationNote,
      rebookUrl: fullRebookUrl,
    });

    try {
      const requesterResult = await resend.emails.send({
        from: `Meeteazy <${fromEmail}>`,
        to: [requesterEmail],
        subject: `Canceled: Your meeting with ${ownerName} for "${subject}"`,
        html: requesterEmailHtml,
      });

      if (requesterResult.error) {
        console.error("❌ Resend API error (requester):", requesterResult.error);
        emailResults.push({ recipient: 'requester', error: requesterResult.error.message });
      } else {
        emailResults.push({ recipient: 'requester', success: true, id: requesterResult.data?.id });
      }
    } catch (error) {
      console.error("❌ Failed to send cancellation email to requester:", error);
      emailResults.push({ 
        recipient: 'requester', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // 🎯 SEND TO ALL ADDITIONAL INVITEES
    for (const invitee of validInvitees) {
      const inviteeEmailHtml = generateCancellationEmail({
        recipientName: invitee.name,
        recipientType: 'invitee',
        ownerName,
        requesterName,
        additionalInvitees: validInvitees,
        subject,
        formattedDate,
        formattedTime,
        cancellationNote,
        // Note: No rebookUrl for invitees since they didn't organize the meeting
      });

      try {
        const inviteeResult = await resend.emails.send({
          from: `Meeteazy <${fromEmail}>`,
          to: [invitee.email],
          subject: `Canceled: Meeting "${subject}"`,
          html: inviteeEmailHtml,
        });

        if (inviteeResult.error) {
          console.error(`❌ Resend API error (invitee ${invitee.name}):`, inviteeResult.error);
          emailResults.push({ 
            recipient: `invitee-${invitee.name}`, 
            error: inviteeResult.error.message 
          });
        } else {
          emailResults.push({ 
            recipient: `invitee-${invitee.name}`, 
            success: true, 
            id: inviteeResult.data?.id 
          });
        }
      } catch (error) {
        console.error(`❌ Failed to send cancellation email to invitee ${invitee.name}:`, error);
        emailResults.push({ 
          recipient: `invitee-${invitee.name}`, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // 🎯 SUMMARY RESPONSE
    const successCount = emailResults.filter(r => r.success).length;
    const totalRecipients = emailResults.length;
    const hasErrors = emailResults.some(r => r.error);

    console.log(`📤 Cancellation emails: ${successCount}/${totalRecipients} sent successfully`);

    if (hasErrors) {
      console.warn(`⚠️ Some cancellation emails failed to send: ${emailResults.filter(r => r.error).length}/${totalRecipients}`);
      
      return NextResponse.json({ 
        success: true, // Still consider success if at least one email was sent
        message: `Cancellation notifications sent to ${successCount}/${totalRecipients} recipients.`,
        warnings: `${emailResults.filter(r => r.error).length} email(s) failed to send.`,
        details: emailResults,
        totalInvitees: validInvitees.length
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Cancellation notifications sent to all ${totalRecipients} participants.`,
      details: emailResults,
      totalInvitees: validInvitees.length
    });

  } catch (error) {
    console.error("❌ Failed to send cancellation email:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send email', details: errorMessage }, { status: 500 });
  }
}