// app/api/reschedule-booking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import resend from '@/lib/resend';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { parse, format, isBefore } from 'date-fns';

// Helper to generate styled HTML for emails, reusing existing styles
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

    // 1. Validate payload
    if (!ownerEmail || !bookingId || !newTime || !newDate) {
      return NextResponse.json({ error: 'Missing required fields in request body.' }, { status: 400 });
    }

    // 2. Validate that the new time is in the future
    const newDateTime = parse(`${newDate} ${newTime}`, 'yyyy-MM-dd HH:mm', new Date());
    if (isBefore(newDateTime, new Date())) {
      return NextResponse.json({ error: 'Cannot reschedule to a time in the past.' }, { status: 400 });
    }

    // 3. Get booking and owner documents from Firestore
    const bookingRef = doc(db, 'users', ownerEmail, 'bookings', bookingId);
    const ownerRef = doc(db, 'users', ownerEmail);

    const [bookingSnap, ownerSnap] = await Promise.all([getDoc(bookingRef), getDoc(ownerRef)]);

    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }
    if (!ownerSnap.exists()) {
      return NextResponse.json({ error: 'Calendar owner not found.' }, { status: 404 });
    }

    const booking = bookingSnap.data();
    const owner = ownerSnap.data();

    // Store old details for the email notification
    const oldTimeFormatted = format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a');
    const oldDateFormatted = format(new Date(booking.date), 'EEEE, MMMM d, yyyy');

    // 4. Update the booking in Firestore
    await updateDoc(bookingRef, {
      time: newTime,
      date: newDate,
      rescheduledAt: Timestamp.now(),
    });

    // 5. Send confirmation emails to both parties
    const emailPayload = {
      ownerName: owner.name || 'Meeteazy User',
      requesterName: booking.name,
      requesterEmail: booking.email,
      newTimeFormatted: format(newDateTime, 'h:mm a'),
      newDateFormatted: format(newDateTime, 'EEEE, MMMM d, yyyy'),
      subject: booking.subject,
      duration: booking.duration,
      location: booking.location,
    };

    // Email to the person who booked
    const requesterEmailContent = `
      <p class="text">Hi ${emailPayload.requesterName},</p>
      <p class="text">This is a confirmation that your meeting with <span class="strong">${emailPayload.ownerName}</span> has been rescheduled.</p>
      <div class="details">
        <p class="text"><span class="strong">Subject:</span> ${emailPayload.subject}</p>
        <p class="text"><span class="strong">Previous Time:</span> ${oldDateFormatted} at ${oldTimeFormatted}</p>
        <p class="text"><span class="strong">New Time:</span> ${emailPayload.newDateFormatted} at ${emailPayload.newTimeFormatted}</p>
      </div>
      <p class="text">If this new time does not work for you, please contact ${emailPayload.ownerName} directly.</p>
    `;
    
    // Email to the calendar owner
    const ownerEmailContent = `
      <p class="text">Hi ${emailPayload.ownerName},</p>
      <p class="text">You have successfully rescheduled your meeting with <span class="strong">${emailPayload.requesterName}</span>.</p>
       <div class="details">
        <p class="text"><span class="strong">Subject:</span> ${emailPayload.subject}</p>
        <p class="text"><span class="strong">Previous Time:</span> ${oldDateFormatted} at ${oldTimeFormatted}</p>
        <p class="text"><span class="strong">New Time:</span> ${emailPayload.newDateFormatted} at ${emailPayload.newTimeFormatted}</p>
      </div>
    `;

    await Promise.all([
      resend.emails.send({
        from: 'Meeteazy <notifications@meeteazy.com>',
        to: emailPayload.requesterEmail,
        subject: `Rescheduled: Your meeting with ${emailPayload.ownerName}`,
        html: createEmailHtml('Meeting Rescheduled', requesterEmailContent),
      }),
      resend.emails.send({
        from: 'Meeteazy <notifications@meeteazy.com>',
        to: ownerEmail,
        subject: `You rescheduled the meeting with ${emailPayload.requesterName}`,
        html: createEmailHtml('You Rescheduled a Meeting', ownerEmailContent),
      })
    ]);

    return NextResponse.json({ success: true, message: 'Booking rescheduled and confirmations sent.' });

  } catch (error) {
    console.error('Error rescheduling booking:', error);
    // Avoid leaking internal error details to the client
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}