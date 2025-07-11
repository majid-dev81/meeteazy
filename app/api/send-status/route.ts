export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'
import { createEvent } from 'ics'
import { withApiProtection } from '@/lib/auth-middleware'

interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}

function toDateArray(date: Date): [number, number, number, number, number] {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes()
  ]
}

interface EmailTemplateProps {
  recipientName: string;
  recipientType: 'owner' | 'requester' | 'invitee';
  organizerName: string;
  ownerName?: string;
  additionalInvitees?: AdditionalInvitee[];
  subject?: string;
  status: string;
  day: string;
  timeRange: string;
  eventLocation: string;
}

const generateEmailTemplate = ({
  recipientName,
  recipientType,
  organizerName,
  ownerName,
  additionalInvitees = [],
  subject,
  status,
  day,
  timeRange,
  eventLocation,
}: EmailTemplateProps): string => {
  const emailFooter = `
    <p style="margin-top: 24px; font-size: 13px; color: #555;">
      — The Meeteazy Team · <a href="https://meeteazy.com" style="color:#3b82f6; text-decoration: none;">meeteazy.com</a>
    </p>
  `;

  // Build attendees list for display
  const allAttendees = [
    { name: organizerName, role: 'Organizer' },
    ...(ownerName && ownerName !== organizerName ? [{ name: ownerName, role: 'Host' }] : []),
    ...additionalInvitees.map(inv => ({ name: inv.name, role: 'Attendee' }))
  ];

  const attendeesHtml = allAttendees.length > 1 ? `
    <div style="margin: 15px 0;">
      <strong>Attendees:</strong>
      <ul style="margin: 8px 0; padding-left: 20px;">
        ${allAttendees.map(attendee => `
          <li style="margin: 4px 0;">${attendee.name} (${attendee.role})</li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  if (recipientType === 'owner') {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Booking ${status} with ${organizerName}</h2>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        ${attendeesHtml}
        <p>
          🗓️ <strong>Date:</strong> ${day}<br/>
          ⏰ <strong>Time:</strong> ${timeRange}<br/>
          📍 <strong>Location:</strong> ${eventLocation}
        </p>
        <p>📎 The calendar invite is attached.</p>
        ${emailFooter}
      </div>
    `;
  } else if (recipientType === 'requester') {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${recipientName},</h2>
        <p>Your booking request has been <strong>${status}</strong>.</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        ${attendeesHtml}
        <p>
          🗓️ <strong>Date:</strong> ${day}<br/>
          ⏰ <strong>Time:</strong> ${timeRange}<br/>
          📍 <strong>Location:</strong> ${eventLocation}
        </p>
        <p>📎 The calendar invite is attached.</p>
        ${emailFooter}
      </div>
    `;
  } else { // invitee
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${recipientName},</h2>
        <p>A meeting you were invited to has been <strong>${status}</strong>.</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p><strong>Organized by:</strong> ${organizerName}</p>
        ${ownerName && ownerName !== organizerName ? `<p><strong>Host:</strong> ${ownerName}</p>` : ''}
        ${attendeesHtml}
        <p>
          🗓️ <strong>Date:</strong> ${day}<br/>
          ⏰ <strong>Time:</strong> ${timeRange}<br/>
          📍 <strong>Location:</strong> ${eventLocation}
        </p>
        <p>📎 The calendar invite is attached.</p>
        ${emailFooter}
      </div>
    `;
  }
};

export const POST = (req: NextRequest) =>
  withApiProtection(req, async (req) => {
    try {
      const body = await req.json()
      const { 
        name, 
        email, 
        day, 
        time, 
        subject, 
        status, 
        ownerEmail, 
        ownerName,
        location,
        additionalInvitees = [] // 🎯 NEW: Additional invitees array
      } = body

      if (!name || !email || !status || !day || !time || !ownerEmail) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // 🎯 VALIDATE ADDITIONAL INVITEES
      const validInvitees = (additionalInvitees as AdditionalInvitee[]).filter((inv) => 
        inv && inv.name && inv.email && inv.email.includes('@')
      );

      // ✅ CORRECTED DATE PARSING
      const dateTimeString = `${day}T${time}:00`
      const startDateTime = new Date(dateTimeString)
      const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000) // 30 mins

      const start = toDateArray(startDateTime)
      const end = toDateArray(endDateTime)

      const eventTitle = subject || `Meeting with ${name}`
      const eventLocation = location || 'To be confirmed'

      // 🎯 BUILD ATTENDEES LIST FOR ICS
      const icsAttendees = [
        { name, email, rsvp: true, partstat: 'NEEDS-ACTION' as const, role: 'REQ-PARTICIPANT' as const },
        ...(ownerEmail !== email ? [{ 
          name: ownerName || 'Host', 
          email: ownerEmail, 
          rsvp: true, 
          partstat: 'ACCEPTED' as const, 
          role: 'REQ-PARTICIPANT' as const 
        }] : []),
        ...validInvitees.map((inv) => ({
          name: inv.name,
          email: inv.email,
          rsvp: true,
          partstat: 'NEEDS-ACTION' as const,
          role: 'REQ-PARTICIPANT' as const
        }))
      ];

      const { error, value: icsContent } = createEvent({
        title: eventTitle,
        description: `Scheduled via Meeteazy${subject ? `\nSubject: ${subject}` : ''}${validInvitees.length > 0 ? `\nAttendees: ${[name, ...validInvitees.map(inv => inv.name)].join(', ')}` : ''}`,
        start,
        end,
        location: eventLocation,
        status: 'CONFIRMED',
        organizer: { name: ownerName || 'Host', email: ownerEmail },
        attendees: icsAttendees,
      })

      if (error || !icsContent) {
        console.error('ICS generation error:', error)
        return NextResponse.json({ error: 'Failed to generate calendar invite' }, { status: 500 })
      }

      const attachments = [
        {
          filename: 'meeting.ics',
          content: icsContent,
          contentType: 'text/calendar',
        },
      ]

      const timeRange = `${time} – ${String(Number(time.split(':')[0]) + (time.includes(':30') ? 1 : 0)).padStart(2, '0')}:${time.endsWith(':30') ? '00' : '30'}`

      const emailResults = [];

      // --- Send to requester ---
      const requesterHtml = generateEmailTemplate({
        recipientName: name,
        recipientType: 'requester',
        organizerName: name,
        ownerName,
        additionalInvitees: validInvitees,
        subject,
        status,
        day,
        timeRange,
        eventLocation,
      });

      const resultUser = await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: email,
        subject: `Your booking was ${status}`,
        html: requesterHtml,
        attachments,
      })

      if (resultUser.error) {
        console.error('❌ Error sending to requester:', resultUser.error);
        emailResults.push({ recipient: 'requester', error: resultUser.error.message });
      } else {
        emailResults.push({ recipient: 'requester', success: true, id: resultUser.data?.id });
      }

      // --- Send to owner (if different from requester) ---
      if (ownerEmail !== email) {
        const ownerHtml = generateEmailTemplate({
          recipientName: ownerName || 'Host',
          recipientType: 'owner',
          organizerName: name,
          ownerName,
          additionalInvitees: validInvitees,
          subject,
          status,
          day,
          timeRange,
          eventLocation,
        });

        const resultOwner = await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: ownerEmail,
          subject: `Booking ${status} with ${name}`,
          html: ownerHtml,
          attachments,
        })

        if (resultOwner.error) {
          console.error('❌ Error sending to owner:', resultOwner.error);
          emailResults.push({ recipient: 'owner', error: resultOwner.error.message });
        } else {
          emailResults.push({ recipient: 'owner', success: true, id: resultOwner.data?.id });
        }
      }

      // 🎯 SEND TO ALL ADDITIONAL INVITEES
      for (const invitee of validInvitees) {
        const inviteeHtml = generateEmailTemplate({
          recipientName: invitee.name,
          recipientType: 'invitee',
          organizerName: name,
          ownerName,
          additionalInvitees: validInvitees,
          subject,
          status,
          day,
          timeRange,
          eventLocation,
        });

        try {
          const inviteeResult = await resend.emails.send({
            from: process.env.EMAIL_FROM!,
            to: invitee.email,
            subject: `Meeting ${status}: ${eventTitle}`,
            html: inviteeHtml,
            attachments,
          });

          if (inviteeResult.error) {
            console.error(`❌ Error sending to invitee ${invitee.name}:`, inviteeResult.error);
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

      console.log(`✅ ICS emails sent to ${successCount}/${totalRecipients} recipients:`, {
        results: emailResults,
        totalInvitees: validInvitees.length
      });

      return NextResponse.json({ 
        success: true,
        message: `Calendar emails sent to ${successCount}/${totalRecipients} recipients`,
        details: emailResults,
        totalInvitees: validInvitees.length
      })
    } catch (e) {
      console.error('❌ Error in ICS API route:', e)
      return NextResponse.json({ error: 'Failed to send calendar email' }, { status: 500 })
    }
  })