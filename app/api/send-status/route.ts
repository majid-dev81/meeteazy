export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'
import { createEvent } from 'ics'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, day, time, subject, status, ownerEmail, location } = body

    if (!name || !email || !status || !day || !time || !ownerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const now = new Date()
    const [hour, minute] = time.split(':').map(Number)
    const startDateTime = new Date(now.setHours(hour, minute, 0, 0))
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000)

    const start = [
      startDateTime.getFullYear(),
      startDateTime.getMonth() + 1,
      startDateTime.getDate(),
      startDateTime.getHours(),
      startDateTime.getMinutes(),
    ]

    const end = [
      endDateTime.getFullYear(),
      endDateTime.getMonth() + 1,
      endDateTime.getDate(),
      endDateTime.getHours(),
      endDateTime.getMinutes(),
    ]

    const eventTitle = subject || `Meeting with ${name}`
    const eventLocation = location || 'To be confirmed'

    const { error, value: icsContent } = createEvent({
      title: eventTitle,
      description: `Scheduled via Meeteazy${subject ? `\nSubject: ${subject}` : ''}`,
      start,
      end,
      location: eventLocation,
      status: 'CONFIRMED',
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

    const emailFooter = `
      <p style="margin-top: 24px; font-size: 13px; color: #555;">
        — The Meeteazy Team · <a href="https://meeteazy.com" style="color:#3b82f6; text-decoration: none;">meeteazy.com</a>
      </p>
    `

    const requesterHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${name},</h2>
        <p>Your booking request has been <strong>${status}</strong>.</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p>
          🗓️ <strong>Date:</strong> ${day}<br/>
          ⏰ <strong>Time:</strong> ${timeRange}<br/>
          📍 <strong>Location:</strong> ${eventLocation}
        </p>
        <p>📎 The calendar invite is attached.</p>
        ${emailFooter}
      </div>
    `

    const ownerHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Booking ${status} with ${name}</h2>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p>
          🗓️ <strong>Date:</strong> ${day}<br/>
          ⏰ <strong>Time:</strong> ${timeRange}<br/>
          📍 <strong>Location:</strong> ${eventLocation}
        </p>
        <p>📎 The calendar invite is attached.</p>
        ${emailFooter}
      </div>
    `

    const resultUser = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: `Your booking was ${status}`,
      html: requesterHtml,
      attachments,
    })

    const resultOwner = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: ownerEmail,
      subject: `Booking ${status} with ${name}`,
      html: ownerHtml,
      attachments,
    })

    console.log('✅ ICS email sent to both:', {
      requester: resultUser,
      owner: resultOwner,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('❌ Error in ICS API route:', e)
    return NextResponse.json({ error: 'Failed to send calendar email' }, { status: 500 })
  }
}