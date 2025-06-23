// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This protects /dashboard from unauthorized access
export function middleware(req: NextRequest) {
  const token = req.cookies.get('__session')?.value

  const isAuth = !!token
  const url = req.nextUrl.clone()

  // If user is NOT authenticated and tries to access /dashboard, redirect to /signin
  if (url.pathname.startsWith('/dashboard') && !isAuth) {
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard'],
}