// lib/resend.ts

import { Resend } from 'resend'

const key = process.env.RESEND_API_KEY

if (!key) {
  throw new Error('❌ RESEND_API_KEY is missing. Please set it in your environment variables.')
}

const resend = new Resend(key)

export async function testEmail() {
  console.log('📤 Attempting to send test email...')
  try {
    const result = await resend.emails.send({
      from: 'notifications@meeteazy.com',
      to: 'mmajid81@hotmail.com', // use your test email
      subject: '🚀 Meeteazy Test Email',
      html: '<strong>This is a test from Meeteazy local</strong>',
    })

    console.log('📬 Test email result:', result)
  } catch (error) {
    console.error('❌ Email send failed:', error)
  }
}

export default resend