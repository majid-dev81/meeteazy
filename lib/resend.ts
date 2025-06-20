import { Resend } from 'resend'

const key = process.env.RESEND_API_KEY

if (!key) {
  console.warn('⚠️ RESEND_API_KEY is missing from .env.local. Emails will not be sent.')
}

const resend = new Resend(key || 'DISABLED')

export default resend