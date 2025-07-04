// /pages/api/new-booking-email.ts

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { format, parse } from 'date-fns';

// Environment variables
const fromEmail = process.env.EMAIL_FROM;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://meeteazy.com';

// TypeScript interface for the email template props
interface BookingRequestEmailProps {
  ownerName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  date: string;
  time: string;
  duration: number;
  subject: string;
  location?: string;
  dashboardUrl: string;
}

/**
 * Generates the HTML content for a new booking request email.
 * This email is sent to the PROFILE OWNER.
 */
const BookingRequestEmail = ({
  ownerName,
  requesterName,
  requesterEmail,
  requesterPhone,
  date,
  time,
  duration,
  subject,
  location,
  dashboardUrl,
}: BookingRequestEmailProps): string => {
  // Format date and time for readability
  const meetingDate = parse(date, 'yyyy-MM-dd', new Date());
  const meetingTime = parse(time, 'HH:mm', new Date());
  const formattedDate = format(meetingDate, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(meetingTime, 'h:mm a');

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="font-size: 24px; color: #0ea5e9;">New Meeting Request!</h1>
      <p>Hi ${ownerName},</p>
      <p>
        You have received a new meeting request from <strong>${requesterName}</strong>. Please review the details below and take action from your Meeteazy dashboard.
      </p>
      
      <div style="background-color: #f8fafc; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
        <h2 style="font-size: 18px; margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Request Details
        </h2>
        <p><strong>Requester:</strong> ${requesterName}</p>
        <p><strong>Requester's Email:</strong> <a href="mailto:${requesterEmail}">${requesterEmail}</a></p>
        ${requesterPhone ? `<p><strong>Requester's Phone:</strong> ${requesterPhone}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>Duration:</strong> ${duration} minutes</p>
        ${location ? `<p><strong>Proposed Location:</strong> ${location}</p>` : ''}
      </div>
      
      <p style="text-align: center; margin: 25px 0;">
        <a
          href="${dashboardUrl}"
          style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold;"
        >
          Accept or Decline Request
        </a>
      </p>
      
      <p style="font-size: 12px; color: #888; margin-top: 32px;">
        This email was sent from Meeteazy. You can manage your bookings and availability from your dashboard.
      </p>
    </div>
  `;
};

/**
 * API Endpoint to handle sending a new booking request email.
 */
export async function POST(req: Request) {
  // 1. Configuration Check
  if (!fromEmail) {
    console.error('❌ Server configuration error: EMAIL_FROM is not set.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    // 2. Instantiate Resend (same pattern as working route)
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // 3. Parse and Validate Payload
    const body = await req.json();
    console.log("📩 Received booking request with payload:", body);
    
    const {
      ownerEmail,
      ownerName,
      requesterName,
      requesterEmail,
      requesterPhone,
      date,
      time,
      duration,
      subject,
      location,
    } = body;

    const requiredFields = { ownerEmail, ownerName, requesterName, requesterEmail, date, time, duration, subject };
    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return NextResponse.json({ error: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }

    // 4. Generate Email HTML
    const htmlContent = BookingRequestEmail({
      ownerName,
      requesterName,
      requesterEmail,
      requesterPhone,
      date,
      time,
      duration,
      subject,
      location,
      dashboardUrl: `${appUrl}/dashboard`, // Direct link to the dashboard
    });

    // 5. Send Email to Profile Owner
    const { data, error } = await resend.emails.send({
      from: `Meeteazy <${fromEmail}>`,
      to: [ownerEmail], // Send ONLY to the profile owner
      subject: `New Meeting Request from ${requesterName}`,
      html: htmlContent,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
    }

    console.log("✅ Booking request email sent successfully to owner:", data);
    return NextResponse.json({ success: true, message: 'Booking request email sent to owner.' });

  } catch (error) {
    console.error('❌ Failed to process booking request:', error);
    const message = error instanceof Error ? error.message : 'Unknown failure';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}