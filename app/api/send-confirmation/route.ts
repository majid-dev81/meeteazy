import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import * as ics from 'ics';
import { v4 as uuidv4 } from 'uuid';
import { format, parse } from 'date-fns';

// Note: The Resend instance is now created inside the POST handler.
const fromEmail = process.env.EMAIL_FROM;
// The appUrl is kept for potential other uses, but the button URL is now hardcoded for production.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface BookingConfirmationEmailProps {
  recipientName: string;
  recipientType: 'owner' | 'requester';
  ownerName: string;
  requesterName: string;
  date: string;
  time: string;
  duration: number;
  subject: string;
  location: string;
  appUrl: string; // Kept in interface for prop consistency
}

const BookingConfirmationEmail = ({
  recipientName,
  recipientType,
  ownerName,
  requesterName,
  date,
  time,
  duration,
  subject,
  location,
  appUrl, // Prop is received but not used for the button anymore
}: BookingConfirmationEmailProps): string => {
  const isOwner = recipientType === 'owner';
  const otherParticipant = isOwner ? requesterName : ownerName;
  const meetingDate = parse(date, 'yyyy-MM-dd', new Date());
  const meetingTime = parse(time, 'HH:mm', new Date());
  const formattedDate = format(meetingDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(meetingTime, 'h:mm a');

  // ✅ FIX: Conditionally generate the button HTML.
  // It only appears for the 'owner' and uses the production URL.
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
    : ''; // The requester gets an empty string, so no button is rendered.

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="font-size: 24px; color: #28a745;">Meeting Confirmed!</h1>
      <p>Hi ${recipientName},</p>
      <p>
        Your meeting with <strong>${otherParticipant}</strong> has been successfully booked and confirmed.
      </p>
      <p>A calendar invitation (.ics file) is attached to this email.</p>
      <div style="background-color: #f9f9f9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
        <h2 style="font-size: 18px; margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
          Booking Details
        </h2>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Participants:</strong> ${ownerName} & ${requesterName}</p>
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

export async function POST(req: Request) {
  if (!fromEmail) { // appUrl check is no longer critical for the button link
    console.error('❌ Server configuration error: EMAIL_FROM is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    // ✨ Instantiated Resend here to ensure a fresh instance for each request.
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const body = await req.json();
    console.log("📩 Received confirmation request with payload:", body);
    const {
      ownerEmail,
      ownerName,
      requesterEmail,
      requesterName,
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

    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);

    const event: ics.EventAttributes = {
      start: [year, month, day, hour, minute],
      startInputType: 'local',
      duration: { minutes: duration },
      title: subject,
      description: `Confirmed meeting between ${ownerName} and ${requesterName}. Location: ${location}`,
      location,
      uid: uuidv4(),
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: { name: ownerName, email: ownerEmail },
      attendees: [
        { name: ownerName, email: ownerEmail, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
        { name: requesterName, email: requesterEmail, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' },
      ],
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

    // --- Send to requester ---
    const htmlToRequester = BookingConfirmationEmail({
      recipientName: requesterName,
      recipientType: 'requester',
      ownerName, requesterName, date, time, duration, subject, location, appUrl,
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
      throw new Error(requesterRes.error.message);
    }

    // --- Send to owner ---
    const htmlToOwner = BookingConfirmationEmail({
      recipientName: ownerName,
      recipientType: 'owner',
      ownerName, requesterName, date, time, duration, subject, location, appUrl,
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
      throw new Error(ownerRes.error.message);
    }

    return NextResponse.json({ success: true, message: 'Confirmation emails sent.' });

  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return NextResponse.json({ error: 'Failed to send email', details: message }, { status: 500 });
  }
}
