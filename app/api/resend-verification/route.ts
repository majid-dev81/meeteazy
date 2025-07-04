// app/api/resend-verification/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { v4 as uuidv4 } from 'uuid'
import resend from '@/lib/resend'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const ref = doc(db, 'users', email)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const newToken = uuidv4()

    await updateDoc(ref, {
      verificationToken: newToken,
    })

    // ✅ Use environment-based URL for prod/dev
const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://meeteazy.com'
    const verificationUrl = `${baseUrl}/verify-email?token=${newToken}`

    // Corrected: Removed duplicate htmlContent declaration
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>Welcome back to Meeteazy 👋</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Verify Email
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

    console.log('🔁 Resent verification email:', result)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error resending verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
