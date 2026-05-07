import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_HOST = 'admin.turnit.com.ar'

function isAdminHost(host: string) {
  return host.startsWith(ADMIN_HOST)
}

function isDev(host: string) {
  return host.startsWith('localhost') || host.startsWith('127.0.0.1')
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('turnia_token')?.value
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // Admin subdomain root → redirect to /admin
  if (isAdminHost(host) && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // Block /admin from main domain (only allow from admin subdomain or dev)
  if (pathname.startsWith('/admin') && !isDev(host) && !isAdminHost(host)) {
    return new NextResponse(null, { status: 404 })
  }

  // Auth: protected routes require token
  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) && !token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Auth: redirect authenticated users away from login/register
  if ((pathname === '/login' || pathname === '/register') && token) {
    const url = request.nextUrl.clone()
    url.pathname = isAdminHost(host) ? '/admin' : '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register', '/'],
}
