// app/api/send-confirmation/route.ts

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { BookingConfirmationEmail } from '@/components/emails/BookingConfirmationEmail'
import * as ics from 'ics'
import { v4 as uuidv4 } from 'uuid'

// --- Environment Variables ---
const resendApiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.EMAIL_FROM

if (!resendApiKey) throw new Error('Missing RESEND_API_KEY in .env.local')
if (!fromEmail) throw new Error('Missing EMAIL_FROM in .env.local')

const resend = new Resend(resendApiKey)

export async function POST(req: Request) {
  console.log('✅ [/api/send-confirmation] API called')
  try {
    const body = await req.json()
    console.log('📨 Request Body:', body)

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
    } = body

    if (!ownerEmail || !ownerName || !requesterEmail || !requesterName || !date || !time || !duration) {
      console.error('❌ Missing required fields:', body)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const [year, month, day] = date.split('-').map(Number)
    const [hour, minute] = time.split(':').map(Number)

    const event: ics.EventAttributes = {
      start: [year, month, day, hour, minute],
      startInputType: 'local',
      startOutputType: 'utc',
      duration: { minutes: duration },
      uid: uuidv4(),
      title: subject,
      description: `Confirmed meeting between ${ownerName} and ${requesterName}.`,
      location,
      method: 'REQUEST',
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: { name: 'Meeteazy', email: fromEmail },
      attendees: [
        { name: ownerName, email: ownerEmail, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
        { name: requesterName, email: requesterEmail, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' },
      ],
    }

    const { error, value: icsContent } = ics.createEvent(event)
    if (error || !icsContent) {
      console.error('❌ ICS generation failed:', error)
      return NextResponse.json({ error: 'Failed to generate calendar invite' }, { status: 500 })
    }

    const icsString = icsContent.toString()

    const results = await Promise.allSettled([
      resend.emails.send({
        from: `Meeteazy <${fromEmail}>`,
        to: requesterEmail,
        subject: `🗓️ Invitation: ${subject}`,
        react: BookingConfirmationEmail({
          recipientName: requesterName,
          recipientType: 'requester',
          ownerName,
          requesterName,
          date,
          time,
          duration,
          subject,
          location,
        }),
        text: `You have been invited to a meeting with ${ownerName} on ${date} at ${time}.`,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(icsString).toString('base64'),
            contentType: 'text/calendar',
          },
        ],
      }),
      resend.emails.send({
        from: `Meeteazy <${fromEmail}>`,
        to: ownerEmail,
        subject: `🗓️ Invitation: ${subject}`,
        react: BookingConfirmationEmail({
          recipientName: ownerName,
          recipientType: 'owner',
          ownerName,
          requesterName,
          date,
          time,
          duration,
          subject,
          location,
        }),
        text: `You have been invited to a meeting with ${requesterName} on ${date} at ${time}.`,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(icsString).toString('base64'),
            contentType: 'text/calendar',
          },
        ],
      }),
    ])

    let allSuccessful = true
    results.forEach((res, i) => {
      const recipient = i === 0 ? requesterEmail : ownerEmail
      if (res.status === 'fulfilled') {
        console.log(`✅ Email sent to ${recipient}`, res.value)
      } else {
        allSuccessful = false
        console.error(`❌ Failed to send to ${recipient}`, res.reason)
      }
    })

    if (!allSuccessful) {
      return NextResponse.json({ error: 'One or more emails failed to send' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('❌ Unexpected error in confirmation route:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}