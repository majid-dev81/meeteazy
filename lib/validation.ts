// lib/validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// ✅ Booking validation schema
export const bookingSchema = z.object({
  requesterName: z.string().min(1).max(100),
  requesterEmail: z.string().email(),
  subject: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().min(15).max(480)
})

// 🧼 Input sanitizer using DOMPurify
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}
// ✅ Simple logout validation (no validation needed - just for consistency)
export const logoutSchema = z.object({})