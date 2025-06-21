// app/api/send-status/route.ts

export const runtime = 'nodejs' // prevent Edge issues

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, day, time, subject, status } = body

    if (!email || !status) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${name},</h2>
        <p>Your booking request for <strong>${day} at ${time}</strong> has been <strong>${status}</strong>.</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p>Thanks for using Meeteazy!</p>
      </div>
    `

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: `Your booking was ${status}`,
      html,
    })

    console.log('✅ Email sent via API route:', result)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('❌ Error in API route:', e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}