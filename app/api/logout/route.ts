// app/api/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withApiProtection } from '@/lib/auth-middleware'

export const POST = (req: NextRequest) =>
  withApiProtection(req, async (req) => {
    const response = NextResponse.json({ success: true })

    response.cookies.set({
      name: '__session',
      value: '',
      httpOnly: true,
      secure: true,
      path: '/',
      maxAge: 0, // Expire immediately
      sameSite: 'lax',
    })

    return response
  })