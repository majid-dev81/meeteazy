// app/api/reschedule-booking/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import resend from '@/lib/resend';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { parse, format, isBefore } from 'date-fns';
import { createEvent, DateArray, EventAttributes } from 'ics';
import { z } from 'zod';

// ✅ Use runtime = 'nodejs' at top
export const runtime = 'nodejs';

// ✅ Add zod schema validation for incoming data
const RescheduleBookingSchema = z.object({
  ownerEmail: z.string().email('Invalid email format.'),
  bookingId: z.string().min(1, 'Booking ID is required.'),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD.'),
  newTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format. Expected HH:mm.'),
});

interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}

// ✅ Sanitize any user input that appears in HTML
const sanitize = (text: string | undefined | null): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const createEmailHtml = (title: string, content: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: sans-serif; background-color: #f6f9fc; padding: 20px; }
      .container { background-color: #ffffff; border: 1px solid #e6ebf1; border-radius: 8px; margin: 20px auto; padding: 32px; max-width: 600px; }
      .heading { color: #333; font-size: 24px; font-weight: bold; text-align: center; }
      .text { color: #555; font-size: 16px; line-height: 1.6; }
      .strong { font-weight: bold; }
      .details { background-color: #f6f9fc; border: 1px solid #e6ebf1; border-radius: 4px; padding: 20px; margin: 24px 0; }
      .hr { border: none; border-top: 1px solid #e6ebf1; margin: 24px 0; }
      .footer { color: #999; font-size: 12px; text-align: center; }
      .attendees { margin: 15px 0; }
      .attendees ul { margin: 8px 0; padding-left: 20px; }
      .attendees li { margin: 4px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 class="heading">Meeteazy</h1>
      <h2 style="font-size: 20px; color: #333;">${title}</h2>
      ${content}
      <hr class="hr" />
      <p class="footer">Meeteazy | The easiest way to meet.</p>
    </div>
  </body>
  </html>
`;

interface EmailContentProps {
  recipientType: 'owner' | 'requester' | 'invitee';
  recipientName: string;
  ownerName: string;
  requesterName: string;
  additionalInvitees?: AdditionalInvitee[];
  subject: string;
  oldDateFormatted: string;
  oldTimeFormatted: string;
  newDateFormatted: string;
  newTimeFormatted: string;
}

const generateEmailContent = ({
  recipientType,
  recipientName,
  ownerName,
  requesterName,
  additionalInvitees = [],
  subject,
  oldDateFormatted,
  oldTimeFormatted,
  newDateFormatted,
  newTimeFormatted,
}: EmailContentProps): string => {
  // Sanitize all dynamic string values before inserting into HTML
  const sanitized = {
    recipientName: sanitize(recipientName),
    ownerName: sanitize(ownerName),
    requesterName: sanitize(requesterName),
    subject: sanitize(subject),
    inviteeNames: additionalInvitees.map((inv: AdditionalInvitee) => sanitize(inv.name))
  };

  const allAttendees = [
    { name: sanitized.requesterName, role: 'Organizer' },
    ...additionalInvitees.map((inv: AdditionalInvitee) => ({ name: sanitize(inv.name), role: 'Attendee' }))
  ];

  const attendeesHtml = additionalInvitees.length > 0 ? `
    <div class="attendees">
      <p class="text"><span class="strong">All Attendees:</span></p>
      <ul>
        ${allAttendees.map(attendee => `
          <li>${attendee.name} (${attendee.role})</li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const detailsHtml = `
    <div class="details">
      <p class="text"><span class="strong">Subject:</span> ${sanitized.subject}</p>
      ${attendeesHtml}
      <p class="text"><span class="strong">Previous Time:</span> ${oldDateFormatted} at ${oldTimeFormatted}</p>
      <p class="text"><span class="strong">New Time:</span> ${newDateFormatted} at ${newTimeFormatted}</p>
    </div>
  `;

  if (recipientType === 'owner') {
    return `
      <p class="text">Hi ${sanitized.recipientName},</p>
      <p class="text">You have successfully rescheduled your meeting with <span class="strong">${sanitized.requesterName}</span>.</p>
      ${detailsHtml}
      <p class="text">The updated .ics file is attached.</p>
    `;
  } else if (recipientType === 'requester') {
    return `
      <p class="text">Hi ${sanitized.recipientName},</p>
      <p class="text">Your meeting with <span class="strong">${sanitized.ownerName}</span> has been rescheduled.</p>
      ${detailsHtml}
      <p class="text">An updated calendar invite is attached.</p>
    `;
  } else { // invitee
    return `
      <p class="text">Hi ${sanitized.recipientName},</p>
      <p class="text">A meeting you were invited to, organized by <span class="strong">${sanitized.requesterName}</span> and hosted by <span class="strong">${sanitized.ownerName}</span>, has been rescheduled.</p>
      ${detailsHtml}
      <p class="text">An updated calendar invite is attached.</p>
    `;
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = RescheduleBookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Invalid request body.",
        issues: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const { ownerEmail, bookingId, newDate, newTime } = validation.data;

    const newDateTime = parse(`${newDate} ${newTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (isBefore(newDateTime, new Date())) {
      return NextResponse.json({ success: false, error: 'Cannot reschedule to a time in the past.' }, { status: 400 });
    }

    const bookingRef = doc(db, 'users', ownerEmail, 'bookings', bookingId);
    const ownerRef = doc(db, 'users', ownerEmail);
    const [bookingSnap, ownerSnap] = await Promise.all([getDoc(bookingRef), getDoc(ownerRef)]);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Booking not found.' }, { status: 404 });
    }
    if (!ownerSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Calendar owner not found.' }, { status: 404 });
    }

    const booking = bookingSnap.data();
    const owner = ownerSnap.data();
    
    const additionalInvitees = (booking.additionalInvitees || []).filter(
      (inv: any): inv is AdditionalInvitee => inv && inv.name && inv.email && inv.email.includes('@')
    );

    const oldTimeFormatted = format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a');
    const oldDateFormatted = format(new Date(booking.date), 'EEEE, MMMM d, yyyy');

    await updateDoc(bookingRef, {
      time: newTime,
      date: newDate,
      rescheduledAt: Timestamp.now(),
    });

    const durationInMinutes = booking.duration || 30;
    const startArray: DateArray = [newDateTime.getFullYear(), newDateTime.getMonth() + 1, newDateTime.getDate(), newDateTime.getHours(), newDateTime.getMinutes()];

    const icsAttendees = [
      { name: booking.requesterName || booking.name, email: booking.requesterEmail || booking.email, rsvp: true, partstat: 'ACCEPTED' as const, role: 'REQ-PARTICIPANT' as const },
      ...additionalInvitees.map((inv: AdditionalInvitee) => ({
        name: inv.name,
        email: inv.email,
        rsvp: true,
        partstat: 'NEEDS-ACTION' as const,
        role: 'REQ-PARTICIPANT' as const
      }))
    ];

    const event: EventAttributes = {
      start: startArray,
      startInputType: 'local',
      startOutputType: 'utc',
      duration: { minutes: durationInMinutes },
      title: booking.subject || 'Meeting',
      description: `Rescheduled meeting with ${owner.name || 'Meeteazy user'}`,
      location: booking.location || 'TBD',
      organizer: { name: owner.name || 'Meeteazy', email: ownerEmail },
      attendees: icsAttendees,
    };
    
    // ✅ Ensure .ics file is handled properly
    const icsEvent = createEvent(event);
    if (icsEvent.error || !icsEvent.value) {
      console.error("❌ Failed to generate .ics file:", icsEvent.error);
      return NextResponse.json({ success: false, error: 'Failed to generate calendar event.' }, { status: 500 });
    }
    const icsFileContent = icsEvent.value; // This is a string

    const emailCommonPayload = {
      ownerName: owner.name || 'Meeteazy User',
      requesterName: booking.requesterName || booking.name,
      subject: booking.subject || 'Meeting',
      newTimeFormatted: format(newDateTime, 'h:mm a'),
      newDateFormatted: format(newDateTime, 'EEEE, MMMM d, yyyy'),
      oldTimeFormatted,
      oldDateFormatted,
    };
    
    // --- Prepare all emails to be sent ---
    const emailRecipients = [
      { type: 'requester' as const, name: emailCommonPayload.requesterName, email: booking.requesterEmail || booking.email },
      { type: 'owner' as const, name: emailCommonPayload.ownerName, email: ownerEmail },
      ...additionalInvitees.map((inv: AdditionalInvitee) => ({ type: 'invitee' as const, name: inv.name, email: inv.email }))
    ];

    const emailPromises = emailRecipients.map(recipient => {
      const emailContent = generateEmailContent({
        recipientType: recipient.type,
        recipientName: recipient.name,
        ownerName: emailCommonPayload.ownerName,
        requesterName: emailCommonPayload.requesterName,
        additionalInvitees: additionalInvitees,
        subject: emailCommonPayload.subject,
        oldDateFormatted,
        oldTimeFormatted,
        newDateFormatted: emailCommonPayload.newDateFormatted,
        newTimeFormatted: emailCommonPayload.newTimeFormatted,
      });

      let subject = '';
      if (recipient.type === 'owner') subject = `You rescheduled a meeting with ${emailCommonPayload.requesterName}`;
      else if (recipient.type === 'requester') subject = `Rescheduled: Your meeting with ${emailCommonPayload.ownerName}`;
      else subject = `Meeting Rescheduled: ${emailCommonPayload.subject}`;
      
      // ✅ Use resend.emails.send() safely
      return resend.emails.send({
        from: 'Meeteazy <notifications@meeteazy.com>',
        to: recipient.email,
        subject: subject,
        html: createEmailHtml('Meeting Rescheduled', emailContent),
        attachments: [{
          filename: 'updated-meeting.ics',
          content: icsFileContent, // Pass the string content directly
        }]
      });
    });

    // ✅ await all promises and check for errors
    const emailResults = await Promise.allSettled(emailPromises);
    const failedEmails: { email: string; reason: string }[] = [];

    emailResults.forEach((result, index) => {
      const recipientEmail = emailRecipients[index].email;
      if (result.status === 'rejected') {
        failedEmails.push({ email: recipientEmail, reason: result.reason.message || 'Unknown network error' });
        return;
      }
      // Resend's API can "succeed" but still return an error object
      if (result.value.error) {
        failedEmails.push({ email: recipientEmail, reason: result.value.error.message });
      }
    });

    const totalEmails = emailPromises.length;
    const successfulEmailsCount = totalEmails - failedEmails.length;
    
    // ✅ If any emails fail, respond with a partial success message
    if (failedEmails.length > 0) {
      console.error(`❌ Failed to send ${failedEmails.length} reschedule email(s):`, failedEmails);
      return NextResponse.json({
        success: true, // The booking itself was updated successfully
        message: `Booking rescheduled, but some notifications failed. Sent ${successfulEmailsCount}/${totalEmails} emails.`,
        details: {
          failed: failedEmails.map(f => f.email),
        }
      }, { status: 207 }); // 207 Multi-Status is appropriate here
    }

    // ✅ Return a clean JSON structure
    return NextResponse.json({
      success: true,
      message: `Booking rescheduled successfully. All ${totalEmails} participants notified.`,
    });

  } catch (error) {
    console.error('An unexpected error occurred in the reschedule-booking route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}