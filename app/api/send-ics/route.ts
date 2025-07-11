// app/api/send-ics/route.ts

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'
import { createEvent, EventAttributes } from 'ics'
import { withApiProtection } from '@/lib/auth-middleware'

/**
 * Converts a JavaScript Date object to the array format required by the 'ics' library.
 * @param date The date to convert.
 * @returns A tuple representing the date: [year, month, day, hours, minutes].
 */
function toDateArray(date: Date): [number, number, number, number, number] {
  return [
    date.getFullYear(),
    date.getMonth() + 1, // Note: 'ics' library uses 1-based months.
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ]
}

/**
 * Calculates the next upcoming date for a given day of the week (e.g., "Monday").
 * @param day The name of the weekday.
 * @returns A Date object for the next occurrence of that day.
 */
function getUpcomingDateForWeekday(day: string): Date {
  const daysMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  }
  const today = new Date()
  const current = today.getDay()
  const target = daysMap[day] ?? 1 // Default to Monday if invalid
  const delta = (target - current + 7) % 7 || 7
  const result = new Date()
  result.setDate(today.getDate() + delta)
  return result
}

export const POST = (req: NextRequest) =>
  withApiProtection(req, async (req) => {
    try {
      // 1. Parse and validate the request body
      const body = await req.json()
      const { name, email, day, time, subject, status, ownerEmail, location } = body

      if (!name || !email || !status || !day || !time || !ownerEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // 2. Calculate event start and end times
      const baseDate = getUpcomingDateForWeekday(day)
      const [hour, minute] = time.split(':').map(Number)
      baseDate.setHours(hour, minute, 0, 0)

      const startDateTime = new Date(baseDate)
      const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000) // Assume a 30-minute duration

      // 3. Create the calendar event attributes
      const event: EventAttributes = {
        title: subject || `Meeting with ${name}`,
        description: `Scheduled via Meeteazy. For details, contact ${ownerEmail}.`,
        location: location || 'To be confirmed',
        start: toDateArray(startDateTime),
        end: toDateArray(endDateTime),
        status: 'CONFIRMED',
        organizer: { name: 'Meeteazy', email: ownerEmail },
        attendees: [
          { name: name, email: email, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' },
          { name: 'Organizer', email: ownerEmail, rsvp: true, partstat: 'ACCEPTED', role: 'CHAIR' },
        ],
      }

      const { error, value: icsContent } = createEvent(event)

      if (error || !icsContent) {
        console.error('ICS generation error:', error)
        return NextResponse.json({ error: 'Failed to generate calendar invite' }, { status: 500 })
      }

      // 4. Prepare the attachment by encoding the .ics content to base64
      // This is the required format for string-based file content in Resend's API.
      const icsBase64 = Buffer.from(icsContent).toString('base64');
      const attachments = [{
        filename: 'invite.ics',
        content: icsBase64,
      }];

      // 5. Prepare email content for both recipients
      const timeRange = `${startDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const emailFooter = `<p style="margin-top:24px; font-size:13px; color:#555;">— The Meeteazy Team · <a href="https://meeteazy.com" style="color:#3b82f6; text-decoration:none;">meeteazy.com</a></p>`;
      
      const requesterHtml = `<div style="font-family:Arial,sans-serif; padding:20px;"><h2>Hello ${name},</h2><p>Your booking request has been <strong>${status}</strong>.</p>${subject ? `<p><strong>Subject:</strong> ${subject}</p>`:''}<p>🗓️ <strong>Date:</strong> ${day}<br/>⏰ <strong>Time:</strong> ${timeRange}<br/>📍 <strong>Location:</strong> ${event.location}</p><p>📎 A calendar invite is attached to this email.</p>${emailFooter}</div>`;
      const ownerHtml = `<div style="font-family:Arial,sans-serif; padding:20px;"><h2>Booking ${status} with ${name}</h2>${subject ? `<p><strong>Subject:</strong> ${subject}</p>`:''}<p>🗓️ <strong>Date:</strong> ${day}<br/>⏰ <strong>Time:</strong> ${timeRange}<br/>📍 <strong>Location:</strong> ${event.location}</p><p>📎 The calendar invite is attached.</p>${emailFooter}</div>`;

      // 6. Create email sending promises to be run in parallel
      const emailPromises = [
        resend.emails.send({
          from: `Meeteazy <${process.env.EMAIL_FROM!}>`,
          to: email,
          subject: `Your booking was ${status}: ${event.title}`,
          html: requesterHtml,
          attachments,
        }),
        resend.emails.send({
          from: `Meeteazy <${process.env.EMAIL_FROM!}>`,
          to: ownerEmail,
          subject: `Booking ${status} with ${name}`,
          html: ownerHtml,
          attachments,
        }),
      ];

      // 7. Execute all promises and handle the results
      console.log(`✉️ Sending ICS invites to ${email} and ${ownerEmail}...`);
      const results = await Promise.allSettled(emailPromises);
      const errors: { recipient: string; error: string }[] = [];

      results.forEach((result, index) => {
        const recipient = index === 0 ? `user (${email})` : `owner (${ownerEmail})`;
        // A failure can be a rejected promise or a resolved promise with an API error object
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)) {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          console.error(`❌ Failed to send ICS to ${recipient}:`, error);
          errors.push({ recipient, error: (error as Error).message });
        }
      });

      // 8. Return a detailed response based on the outcomes
      if (errors.length > 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'One or more calendar invites failed to send.', 
          errors 
        }, { status: 500 });
      }

      console.log('✅ ICS invites sent successfully to all recipients.');
      return NextResponse.json({ success: true, message: 'Calendar invites sent successfully.' });

    } catch (e) {
      console.error('❌ Unhandled error in ICS API route:', e);
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
  });