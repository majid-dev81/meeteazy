export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'
import { db } from '@/lib/firebase'
import { doc, updateDoc, getDoc } from 'firebase/firestore'

export async function POST(req: NextRequest) {
  try {
    const { userEmail, bookingId } = await req.json()

    if (!userEmail || !bookingId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const ref = doc(db, 'users', userEmail, 'bookings', bookingId)

    // Update status in Firestore
    await updateDoc(ref, { status: 'cancelled' })

    const snap = await getDoc(ref)
    const data = snap.data()

    if (!data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { name, email, day, time, subject } = data

    const footer = `
      <p style="margin-top: 24px; font-size: 13px; color: #555;">
        — The Meeteazy Team · <a href="https://meeteazy.com" style="color:#3b82f6; text-decoration: none;">meeteazy.com</a>
      </p>
    `

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${name},</h2>
        <p>We regret to inform you that your booking for <strong>${day} at ${time}</strong> has been <strong>cancelled</strong>.</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p>We apologize for any inconvenience.</p>
        ${footer}
      </div>
    `

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: 'Your booking has been cancelled',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('❌ Error in cancellation API:', e)
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
  }
}