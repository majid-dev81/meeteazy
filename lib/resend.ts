import { Resend } from 'resend'

const key = process.env.RESEND_API_KEY

if (!key) {
  console.warn('❌ RESEND_API_KEY missing. Emails will not send.')
}

const resend = new Resend(key || 'DISABLED')

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