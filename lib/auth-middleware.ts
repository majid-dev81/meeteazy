// lib/auth-middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import rateLimit from './rate-limit'

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Up to 500 users/IPs per minute
})

export async function withApiProtection(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // 1. Apply rate limiting (e.g. 10 requests per minute per IP)
   const identifier = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || req.nextUrl.hostname || 'anonymous'
await limiter.check(10, identifier)
  } catch {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // 2. Enforce CORS: Only allow trusted origins
  const origin = req.headers.get('origin')
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://meeteazy.com').split(',')

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 })
  }

  // 3. Proceed to the real handler
  return handler(req)
}