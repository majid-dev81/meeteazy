import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const verified = req.cookies.get('isVerified')?.value === 'true'
  const url = req.nextUrl.clone()

  if (url.pathname.startsWith('/dashboard') && !verified) {
    url.pathname = '/verify'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard'],
}