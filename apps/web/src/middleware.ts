import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Route protection middleware.
 *
 * Reads the `turnia_token` cookie (set by auth-store.ts on login).
 * - /dashboard/* without token → redirect to /login
 * - /login or /register with token → redirect to /dashboard
 *
 * Note: this is a lightweight check against cookie presence only.
 * The actual JWT signature is verified by the backend on every API call.
 */
export function middleware(request: NextRequest) {
  const token    = request.cookies.get('turnia_token')?.value
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard') && !token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if ((pathname === '/login' || pathname === '/register') && token) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
}
