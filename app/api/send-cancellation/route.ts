// app/api/send-cancellation/route.ts

import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { format, parse } from 'date-fns';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM;
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: Request) {
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

    const meetingDate = parse(date, 'yyyy-MM-dd', new Date());
    const meetingTime = parse(time, 'HH:mm', new Date());

    const formattedDate = format(meetingDate, 'EEEE, MMMM d, yyyy');
    const formattedTime = format(meetingTime, 'h:mm a');

    // Ensure full URL for production
    const fullRebookUrl = rebookUrl.startsWith('http')
      ? rebookUrl
      : `${baseUrl}${rebookUrl.startsWith('/') ? rebookUrl : `/${rebookUrl}`}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #d32f2f;">Meeting Canceled</h2>
        <p>Hi ${requesterName},</p>
        <p>This is an automated notification to let you know that your meeting with <strong>${ownerName}</strong> has been canceled.</p>
        <div style="background-color: #f9f9f9; border-left: 4px solid #d32f2f; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Canceled Meeting Details:</h3>
          <p><strong>Subject:</strong> ${subject}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Time:</strong> ${formattedTime}</p>
        </div>
        ${cancellationNote ? `
        <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0;">A note from ${ownerName}:</h3>
          <p style="white-space: pre-wrap;">${cancellationNote}</p>
        </div>
        ` : ''}
        <p>We apologize for any inconvenience this may cause. If you'd like to schedule another time, you can do so by visiting their booking page:</p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${fullRebookUrl}" style="background-color: #1a73e8; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Rebook a new time</a>
        </p>
        <p>Best,</p>
        <p>The Meeteazy Team</p>
      </div>
    `;

    const data = await resend.emails.send({
      from: `Meeteazy <${fromEmail}>`,
      to: [requesterEmail],
      subject: `Canceled: Your meeting with ${ownerName} for "${subject}"`,
      html: emailHtml,
    });

    console.log("📤 Resend response:", data);

    if (data.error) {
      console.error("❌ Resend API error:", data.error);
      throw new Error(data.error.message);
    }

    return NextResponse.json({ success: true, message: 'Cancellation email sent.' });

  } catch (error) {
    console.error("❌ Failed to send cancellation email:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to send email', details: errorMessage }, { status: 500 });
  }
}