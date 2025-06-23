import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { verified } = await req.json()

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: '__session',
    value: verified ? 'true' : 'false',
    httpOnly: true,
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  })

  return response
}