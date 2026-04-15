// ─────────────────────────────────────────────────────────────────────────────
// Auth session persistence
//
// Strategy: store token in localStorage for the API client + a non-httpOnly
// cookie so Next.js middleware can read it and protect routes server-side.
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSession {
  id:          string
  email:       string
  firstName:   string
  lastName:    string
  isSuperAdmin: boolean
  emailVerifiedAt: string | null
  /** Primary tenant this user belongs to (first in list). */
  tenantId:       string | null
  tenantSlug:     string | null
  tenantName:     string | null
  tenantTimezone: string | null
  /** Membership state — used to block the dashboard when SuperAdmin deactivates the tenant. */
  tenantIsActive:            boolean | null
  tenantMembershipExpiresAt: string | null
  /** Stage 1 (branches): drives whether the dashboard exposes the Sucursales nav item. */
  tenantHasMultipleBranches: boolean
  role:           string | null
}

export interface AuthSession {
  accessToken: string
  user:        UserSession
}

const AUTH_KEY    = 'turnia_auth'
const TOKEN_COOKIE = 'turnia_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60  // 7 days

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

export function setSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
  // Cookie for middleware — not httpOnly so the client can also clear it
  document.cookie = [
    `${TOKEN_COOKIE}=${session.accessToken}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ].join('; ')
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_KEY)
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}
