import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { format, parse } from 'date-fns';
import { bookingSchema, sanitizeInput } from '@/lib/validation';

// --- Email Template Component ---
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


// --- API Route Handler ---
export async function POST(req: NextRequest) {
  console.log("\n\n---");
  console.log("🚀 STEP 1: API endpoint hit: /api/send-booking-request");

  // This outer try-catch is a final safety net to prevent the server from crashing
  // and returning HTML, ensuring a JSON response is always sent.
  try {
    // --- STEP 2: Environment Variable Validation ---
    console.log("🔍 STEP 2: Validating environment variables...");
    const fromEmail = process.env.EMAIL_FROM;
    const resendApiKey = process.env.RESEND_API_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!fromEmail || !resendApiKey) {
      const errorDetails = {
        EMAIL_FROM: fromEmail ? '✅ Loaded' : '❌ Missing or undefined',
        RESEND_API_KEY: resendApiKey ? '✅ Loaded' : '❌ Missing or undefined',
      };
      console.error('❌ FATAL: Server configuration error. Environment variables missing.', errorDetails);
      return NextResponse.json({
        error: 'Server configuration error.',
        details: 'One or more required environment variables (EMAIL_FROM, RESEND_API_KEY) are not set.',
        configStatus: errorDetails
      }, { status: 500 });
    }
    console.log("✅ Environment variables validated successfully.");

    // --- STEP 3: Parse Request Body ---
    let body;
    try {
      console.log("🔍 STEP 3: Parsing request body...");
      body = await req.json();
      console.log("✅ Request body parsed successfully:", body);
    } catch (jsonError) {
      console.error('❌ ERROR: Failed to parse request body as JSON.', jsonError);
      return NextResponse.json({
        error: 'Invalid request format.',
        details: 'The request body could not be parsed as JSON. Please ensure you are sending a valid JSON object.'
      }, { status: 400 });
    }

    // --- STEP 4: Validate Payload Schema ---
    console.log("🔍 STEP 4: Validating payload against schema...");
    const validationResult = bookingSchema.safeParse(body);

    if (!validationResult.success) {
      console.error('❌ ERROR: Payload validation failed.', validationResult.error.flatten());
      return NextResponse.json({
        error: 'Invalid booking payload.',
        details: "The provided data doesn't meet the required format.",
        issues: validationResult.error.flatten(),
      }, { status: 400 });
    }
    console.log("✅ Payload validated successfully.");

    const { ownerEmail, ownerName } = body;
    if (!ownerEmail || !ownerName) {
        console.error('❌ ERROR: Missing owner email or name in payload.', { ownerEmail, ownerName });
        return NextResponse.json({ error: 'Missing critical data', details: 'The payload must include `ownerEmail` and `ownerName`.' }, { status: 400 });
    }
    console.log("✅ Owner details validated.");

    // --- STEP 5: Send Email via Resend ---
    try {
      console.log("🔍 STEP 5: Initializing Resend and preparing to send email...");
      const resend = new Resend(resendApiKey);
      const {
        requesterName,
        requesterEmail,
        subject,
        date,
        time,
        duration,
      } = validationResult.data;

      const htmlContent = BookingRequestEmail({
        ownerName: sanitizeInput(ownerName),
        requesterName: sanitizeInput(requesterName),
        requesterEmail,
        requesterPhone: body.requesterPhone ? sanitizeInput(body.requesterPhone) : undefined,
        subject: sanitizeInput(subject),
        date,
        time,
        duration,
        location: body.location ? sanitizeInput(body.location) : undefined,
        dashboardUrl: `${appUrl}/dashboard`,
      });

      const emailPayload = {
        from: `Meeteazy <${fromEmail}>`,
        to: [ownerEmail],
        subject: `New Meeting Request from ${requesterName}`,
        html: htmlContent,
      };

      console.log("📤 Sending email with payload:", { from: emailPayload.from, to: emailPayload.to, subject: emailPayload.subject });

      const { data, error: resendError } = await resend.emails.send(emailPayload);

      if (resendError) {
        // This handles errors returned gracefully by the Resend API (e.g., validation errors)
        console.error('❌ ERROR: Resend API returned an error.', resendError);
        return NextResponse.json({
          error: 'Failed to send email via provider.',
          details: resendError.message,
          providerError: resendError,
        }, { status: 500 });
      }

      console.log("✅ SUCCESS: Email sent successfully!", data);
      return NextResponse.json({ success: true, message: 'Booking request email sent.', data });

    } catch (emailServiceError) {
      // This catches errors during the 'resend.emails.send' execution itself (e.g., network issues)
      console.error('❌ FATAL: An unexpected error occurred while trying to send the email.', emailServiceError);
      return NextResponse.json({
        error: 'Internal server error during email dispatch.',
        details: emailServiceError instanceof Error ? emailServiceError.message : 'An unknown error occurred.',
      }, { status: 500 });
    }

  } catch (uncaughtError) {
    // This is the final safety net. If any part of the code above fails unexpectedly,
    // this will catch it and prevent the server from returning an HTML error page.
    console.error('❌ FATAL: An uncaught error occurred in the API route.', uncaughtError);
    return NextResponse.json({
      error: 'An unexpected internal server error occurred.',
      details: uncaughtError instanceof Error ? uncaughtError.message : 'The operation could not be completed due to a critical server issue.'
    }, { status: 500 });
  }
}