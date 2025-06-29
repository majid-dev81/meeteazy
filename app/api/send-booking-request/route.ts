// app/api/send-booking-request/route.ts

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { NewBookingEmail } from '@/components/emails/NewBookingEmail'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.EMAIL_FROM

export async function POST(request: Request) {
  if (!fromEmail) {
    console.error('EMAIL_FROM environment variable is not set.')
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const {
      to,
      ownerName,
      requesterName,
      requesterEmail,
      requesterPhone,
      subject,
      date,
      time,
      duration,
    } = body

    if (!to || !ownerName || !requesterName || !requesterEmail || !date || !time || !duration) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `New Meeting Request from ${requesterName}`,
      react: NewBookingEmail({
        ownerName,
        requesterName,
        requesterEmail,
        requesterPhone,
        date,
        time,
        duration,
        subject,
      }),
    })

    if (error) {
      console.error('Resend API Error:', error)
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Email sent successfully!', data })
  } catch (err) {
    console.error('API Error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}