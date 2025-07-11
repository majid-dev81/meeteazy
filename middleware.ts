// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This protects /dashboard from unauthorized access
export function middleware(req: NextRequest) {
  const token = req.cookies.get('__session')?.value
  const isAuth = !!token
  const url = req.nextUrl.clone()

  // 🔒 Auth-protected dashboard route
  if (url.pathname.startsWith('/dashboard') && !isAuth) {
    url.pathname = '/signin'
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()

  // ✅ Security Headers for Corporate Compliance
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  return response
}

// 🌐 Apply middleware to all pages, but only protect /dashboard auth
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|api).*)',
}