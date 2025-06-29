// app/api/send-verification/route.ts

import { NextRequest, NextResponse } from 'next/server'
import resend from '@/lib/resend'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json()

    if (!email || !token) {
      return NextResponse.json({ error: 'Missing email or token' }, { status: 400 })
    }

    const verificationUrl = `http://localhost:3000/verify-email?token=${token}`

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>Welcome to Meeteazy 👋</h2>
        <p>Thanks for signing up! Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Verify My Email
        </a>
        <p style="margin-top: 24px; font-size: 13px; color: #555;">
          — The Meeteazy Team · <a href="https://meeteazy.com" style="color:#3b82f6; text-decoration: none;">meeteazy.com</a>
        </p>
      </div>
    `

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: email,
      subject: 'Verify your email for Meeteazy',
      html: htmlContent,
    })

    console.log('✅ Verification email sent:', result)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('❌ Failed to send verification email:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}