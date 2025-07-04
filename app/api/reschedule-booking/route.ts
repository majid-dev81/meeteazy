// app/api/reschedule-booking/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import resend from '@/lib/resend';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { parse, format, isBefore, addMinutes } from 'date-fns';
import { createEvent, DateArray, EventAttributes } from 'ics';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ownerEmail, bookingId, newTime, newDate } = body;

    if (!ownerEmail || !bookingId || !newTime || !newDate) {
      return NextResponse.json({ error: 'Missing required fields in request body.' }, { status: 400 });
    }

    const newDateTime = parse(`${newDate} ${newTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (isBefore(newDateTime, new Date())) {
      return NextResponse.json({ error: 'Cannot reschedule to a time in the past.' }, { status: 400 });
    }

    const bookingRef = doc(db, 'users', ownerEmail, 'bookings', bookingId);
    const ownerRef = doc(db, 'users', ownerEmail);
    const [bookingSnap, ownerSnap] = await Promise.all([getDoc(bookingRef), getDoc(ownerRef)]);

    if (!bookingSnap.exists()) {
      console.warn(`Booking not found for ID: ${bookingId}`);
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    if (!ownerSnap.exists()) {
      console.warn(`Calendar owner not found for email: ${ownerEmail}`);
      return NextResponse.json({ error: 'Calendar owner not found.' }, { status: 404 });
    }

    const booking = bookingSnap.data();
    const owner = ownerSnap.data();

    const oldTimeFormatted = format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a');
    const oldDateFormatted = format(new Date(booking.date), 'EEEE, MMMM d, yyyy');

    await updateDoc(bookingRef, {
      time: newTime,
      date: newDate,
      rescheduledAt: Timestamp.now(),
    });

    const durationInMinutes = booking.duration || 30;
    const startArray: DateArray = [newDateTime.getFullYear(), newDateTime.getMonth() + 1, newDateTime.getDate(), newDateTime.getHours(), newDateTime.getMinutes()];

    // **FIX**: The event object now correctly specifies the time conversion from local to UTC,
    // includes an explicit duration, and provides a fallback for the location to prevent
    // issues with calendar clients.
    const event: EventAttributes = {
      start: startArray,
      startInputType: 'local',
      startOutputType: 'utc',
      duration: { minutes: durationInMinutes },
      title: booking.subject || 'Meeting',
      description: `Meeting with ${owner.name || 'Meeteazy user'}`,
      location: booking.location || 'TBD',
      organizer: { name: owner.name || 'Meeteazy', email: ownerEmail },
      attendees: [{ name: booking.name, email: booking.email, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' }],
    };

    const { error, value } = createEvent(event);
    if (error) {
      console.error("❌ Failed to generate .ics file:", error);
      return NextResponse.json({ error: 'Failed to generate calendar event.' }, { status: 500 });
    }

    const emailPayload = {
      ownerName: owner.name || 'Meeteazy User',
      requesterName: booking.name,
      requesterEmail: booking.email,
      newTimeFormatted: format(newDateTime, 'h:mm a'),
      newDateFormatted: format(newDateTime, 'EEEE, MMMM d, yyyy'),
      subject: booking.subject,
    };

    const requesterEmailContent = `
      <p class="text">Hi ${emailPayload.requesterName},</p>
      <p class="text">This is a confirmation that your meeting with <span class="strong">${emailPayload.ownerName}</span> has been rescheduled.</p>
      <div class="details">
        <p class="text"><span class="strong">Subject:</span> ${emailPayload.subject}</p>
        <p class="text"><span class="strong">Previous Time:</span> ${oldDateFormatted} at ${oldTimeFormatted}</p>
        <p class="text"><span class="strong">New Time:</span> ${emailPayload.newDateFormatted} at ${emailPayload.newTimeFormatted}</p>
      </div>
      <p class="text">An updated calendar invite is attached.</p>
    `;

    const ownerEmailContent = `
      <p class="text">Hi ${emailPayload.ownerName},</p>
      <p class="text">You have successfully rescheduled your meeting with <span class="strong">${emailPayload.requesterName}</span>.</p>
      <div class="details">
        <p class="text"><span class="strong">Subject:</span> ${emailPayload.subject}</p>
        <p class="text"><span class="strong">Previous Time:</span> ${oldDateFormatted} at ${oldTimeFormatted}</p>
        <p class="text"><span class="strong">New Time:</span> ${emailPayload.newDateFormatted} at ${emailPayload.newTimeFormatted}</p>
      </div>
      <p class="text">The updated .ics file is attached.</p>
    `;

    // **FIX**: Use Promise.allSettled to ensure both emails are attempted. This adds
    // resiliency and allows for detailed error logging if one or both emails fail to send,
    // preventing silent failures. The `from` address format is already correct.
    const emailResults = await Promise.allSettled([
      resend.emails.send({
        from: 'Meeteazy <notifications@meeteazy.com>',
        to: emailPayload.requesterEmail,
        subject: `Rescheduled: Your meeting with ${emailPayload.ownerName}`,
        html: createEmailHtml('Meeting Rescheduled', requesterEmailContent),
        attachments: [{ filename: 'updated-meeting.ics', content: value as string }]
      }),
      resend.emails.send({
        from: 'Meeteazy <notifications@meeteazy.com>',
        to: ownerEmail,
        subject: `You rescheduled the meeting with ${emailPayload.requesterName}`,
        html: createEmailHtml('You Rescheduled a Meeting', ownerEmailContent),
        attachments: [{ filename: 'updated-meeting.ics', content: value as string }]
      })
    ]);

    const failedEmails = emailResults.filter(result => result.status === 'rejected');

    if (failedEmails.length > 0) {
      console.error('❌ Failed to send one or more reschedule emails:');
      failedEmails.forEach((result) => {
        if (result.status === 'rejected') {
          console.error('Failure reason:', result.reason);
        }
      });
      
      return NextResponse.json({ 
        success: false,
        message: 'Booking rescheduled, but failed to send one or more confirmation emails. Please contact the other party directly.',
      }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Booking rescheduled and confirmations sent.' });

  } catch (error) {
    console.error('An unexpected error occurred in the reschedule-booking route:', error);
    if (error instanceof Error) {
        console.error(error.message);
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
