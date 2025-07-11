import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import * as ics from 'ics';
import { v4 as uuidv4 } from 'uuid';
import { format, parse } from 'date-fns';

const fromEmail = process.env.EMAIL_FROM;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}

interface BookingConfirmationEmailProps {
  recipientName: string;
  recipientType: 'owner' | 'requester' | 'invitee';
  ownerName: string;
  requesterName: string;
  additionalInvitees?: AdditionalInvitee[];
  date: string;
  time: string;
  duration: number;
  subject: string;
  location: string;
  appUrl: string;
}

const BookingConfirmationEmail = ({
  recipientName,
  recipientType,
  ownerName,
  requesterName,
  additionalInvitees = [],
  date,
  time,
  duration,
  subject,
  location,
  appUrl,
}: BookingConfirmationEmailProps): string => {
  const isOwner = recipientType === 'owner';
  const meetingDate = parse(date, 'yyyy-MM-dd', new Date());
  const meetingTime = parse(time, 'HH:mm', new Date());
  const formattedDate = format(meetingDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(meetingTime, 'h:mm a');

  // Build attendees list for display
  const allAttendees = [
    { name: ownerName, role: 'Host' },
    { name: requesterName, role: 'Organizer' },
    ...additionalInvitees.map(inv => ({ name: inv.name, role: 'Attendee' }))
  ];

  const attendeesHtml = allAttendees.length > 2 ? `
    <div style="margin: 15px 0;">
      <strong>All Attendees:</strong>
      <ul style="margin: 8px 0; padding-left: 20px;">
        ${allAttendees.map(attendee => `
          <li style="margin: 4px 0;">${attendee.name} (${attendee.role})</li>
        `).join('')}
      </ul>
    </div>
  ` : `<p><strong>Participants:</strong> ${ownerName} & ${requesterName}</p>`;

  const buttonHtml = isOwner
    ? `
      <p style="text-align: center; margin: 25px 0;">
        <a
          href="https://meeteazy.com/dashboard"
          style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;"
        >
          View Your Bookings
        </a>
      </p>
    `
    : '';

  const greetingText = recipientType === 'owner' 
    ? `Your meeting with <strong>${requesterName}</strong>${additionalInvitees.length > 0 ? ` and ${additionalInvitees.length} other${additionalInvitees.length > 1 ? 's' : ''}` : ''} has been successfully booked and confirmed.`
    : recipientType === 'requester'
    ? `Your meeting with <strong>${ownerName}</strong> has been successfully booked and confirmed.`
    : `You've been invited to a meeting organized by <strong>${requesterName}</strong> with <strong>${ownerName}</strong>.`;

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="font-size: 24px; color: #28a745;">Meeting Confirmed!</h1>
      <p>Hi ${recipientName},</p>
      <p>${greetingText}</p>
      <p>A calendar invitation (.ics file) is attached to this email.</p>
      <div style="background-color: #f9f9f9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
        <h2 style="font-size: 18px; margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
          Booking Details
        </h2>
        <p><strong>Subject:</strong> ${subject}</p>
        ${attendeesHtml}
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>Duration:</strong> ${duration} minutes</p>
        <p><strong>Location:</strong> ${location}</p>
      </div>
      ${buttonHtml}
      <p style="font-size: 12px; color: #888; margin-top: 32px;">
        This email was sent from Meeteazy.
      </p>
    </div>
  `;
};

export async function POST(req: NextRequest) {
  if (!fromEmail) {
    console.error('❌ Server configuration error: EMAIL_FROM is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const body = await req.json();
    console.log("📩 Received confirmation request with payload:", body);
    const {
      ownerEmail,
      ownerName,
      requesterEmail,
      requesterName,
      additionalInvitees = [], // 🎯 NEW: Additional invitees array
      date,
      time,
      duration,
      subject = `Meeting: ${requesterName} & ${ownerName}`,
      location = 'Virtual Meeting',
    } = body;

    const requiredFields = { ownerEmail, ownerName, requesterEmail, requesterName, date, time, duration };
    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return NextResponse.json({ error: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }

    // 🎯 VALIDATE ADDITIONAL INVITEES
    const validInvitees = additionalInvitees.filter((inv: AdditionalInvitee) => 
      inv && inv.name && inv.email && inv.email.includes('@')
    );

    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    // 🎯 BUILD ATTENDEES LIST FOR ICS (including additional invitees)
    const icsAttendees = [
      { name: ownerName, email: ownerEmail, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
      { name: requesterName, email: requesterEmail, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' },
      ...validInvitees.map((inv: AdditionalInvitee) => ({
        name: inv.name,
        email: inv.email,
        rsvp: true,
        partstat: 'NEEDS-ACTION',
        role: 'REQ-PARTICIPANT'
      }))
    ];

    const event: ics.EventAttributes = {
      start: [year, month, day, hour, minute],
      startInputType: 'local',
      duration: { minutes: duration },
      title: subject,
      description: `Confirmed meeting between ${ownerName}, ${requesterName}${validInvitees.length > 0 ? `, and ${validInvitees.length} other attendee${validInvitees.length > 1 ? 's' : ''}` : ''}. Location: ${location}`,
      location,
      uid: uuidv4(),
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: { name: ownerName, email: ownerEmail },
      attendees: icsAttendees,
    };

    const { error: icsError, value: icsContent } = ics.createEvent(event);
    if (icsError || !icsContent) {
      console.error('❌ ICS generation failed:', icsError);
      throw new Error('Failed to generate the calendar invite.');
    }

    const icsAttachment = {
      filename: 'invite.ics',
      content: Buffer.from(icsContent).toString('base64'),
    };

    // 🎯 BUILD RECIPIENT LIST
    const emailResults = [];

    // --- Send to requester ---
    const htmlToRequester = BookingConfirmationEmail({
      recipientName: requesterName,
      recipientType: 'requester',
      ownerName, 
      requesterName, 
      additionalInvitees: validInvitees,
      date, time, duration, subject, location, appUrl,
    });

    const requesterRes = await resend.emails.send({
      from: `Meeteazy <${fromEmail}>`,
      to: [requesterEmail],
      subject: `Confirmed: ${subject}`,
      html: htmlToRequester,
      attachments: [icsAttachment],
    });

    console.log("📤 Resend response (requester):", requesterRes);
    if (requesterRes.error) {
      console.error('❌ Resend error to requester:', requesterRes.error);
      emailResults.push({ recipient: 'requester', error: requesterRes.error.message });
    } else {
      emailResults.push({ recipient: 'requester', success: true });
    }

    // --- Send to owner ---
    const htmlToOwner = BookingConfirmationEmail({
      recipientName: ownerName,
      recipientType: 'owner',
      ownerName, 
      requesterName, 
      additionalInvitees: validInvitees,
      date, time, duration, subject, location, appUrl,
    });

    const ownerRes = await resend.emails.send({
      from: `Meeteazy <${fromEmail}>`,
      to: [ownerEmail],
      subject: `New Booking: ${subject}`,
      html: htmlToOwner,
      attachments: [icsAttachment],
    });

    console.log("📤 Resend response (owner):", ownerRes);
    if (ownerRes.error) {
      console.error('❌ Resend error to owner:', ownerRes.error);
      emailResults.push({ recipient: 'owner', error: ownerRes.error.message });
    } else {
      emailResults.push({ recipient: 'owner', success: true });
    }

    // 🎯 SEND TO ALL ADDITIONAL INVITEES
    for (const invitee of validInvitees) {
      const htmlToInvitee = BookingConfirmationEmail({
        recipientName: invitee.name,
        recipientType: 'invitee',
        ownerName, 
        requesterName, 
        additionalInvitees: validInvitees,
        date, time, duration, subject, location, appUrl,
      });

      try {
        const inviteeRes = await resend.emails.send({
          from: `Meeteazy <${fromEmail}>`,
          to: [invitee.email],
          subject: `Meeting Invitation: ${subject}`,
          html: htmlToInvitee,
          attachments: [icsAttachment],
        });

        console.log(`📤 Resend response (invitee ${invitee.name}):`, inviteeRes);
        if (inviteeRes.error) {
          console.error(`❌ Resend error to invitee ${invitee.name}:`, inviteeRes.error);
          emailResults.push({ 
            recipient: `invitee-${invitee.name}`, 
            error: inviteeRes.error.message 
          });
        } else {
          emailResults.push({ 
            recipient: `invitee-${invitee.name}`, 
            success: true 
          });
        }
      } catch (error) {
        console.error(`❌ Failed to send email to invitee ${invitee.name}:`, error);
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

    return NextResponse.json({ 
      success: true, 
      message: `Confirmation emails sent to ${successCount}/${totalRecipients} recipients.`,
      details: emailResults,
      totalInvitees: validInvitees.length
    });

  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return NextResponse.json({ error: 'Failed to send email', details: message }, { status: 500 });
  }
}