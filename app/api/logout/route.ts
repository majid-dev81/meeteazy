// app/api/logout/route.ts
import { NextResponse } from 'next/server'

export async function POST() {
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
}