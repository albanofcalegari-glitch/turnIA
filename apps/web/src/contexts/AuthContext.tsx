'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, ApiError, type UserProfile } from '@/lib/api'
import { getSession, setSession, clearSession, type AuthSession, type UserSession } from '@/lib/auth-store'

// Profile → UserSession projection. Used by both login and the rehydrate refresh
// so the two paths can never drift apart.
function profileToUserSession(profile: UserProfile): UserSession {
  const primary = profile.tenants?.[0] ?? null
  return {
    id:                        profile.id,
    email:                     profile.email,
    firstName:                 profile.firstName,
    lastName:                  profile.lastName,
    isSuperAdmin:              profile.isSuperAdmin,
    tenantId:                  primary?.tenantId                   ?? null,
    tenantSlug:                primary?.tenant.slug                ?? null,
    tenantName:                primary?.tenant.name                ?? null,
    tenantTimezone:            primary?.tenant.timezone            ?? null,
    tenantIsActive:            primary?.tenant.isActive            ?? null,
    tenantMembershipExpiresAt: primary?.tenant.membershipExpiresAt ?? null,
    tenantHasMultipleBranches: primary?.tenant.hasMultipleBranches ?? false,
    tenantHasComplexServices:  primary?.tenant.hasComplexServices  ?? false,
    role:                      primary?.role                       ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:        AuthSession | null
  user:           UserSession | null
  loading:        boolean
  login:          (email: string, password: string) => Promise<void>
  logout:         () => void
  /**
   * Refetches the profile from the backend and updates the cached session.
   * Useful after mutations that change tenant-level flags (e.g. creating
   * the first complex service to reveal the "Órdenes" nav entry).
   */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const [loading, setLoading]      = useState(true)

  // Rehydrate from localStorage on mount, then refresh from server so the user
  // sees fresh tenant status (e.g. SuperAdmin deactivated the membership while
  // the user was logged in — the cached session would otherwise stay stale).
  useEffect(() => {
    const stored = getSession()
    if (!stored) {
      setLoading(false)
      return
    }
    apiClient.setToken(stored.accessToken)
    setSessionState(stored)
    setLoading(false)

    apiClient.getProfile()
      .then(profile => {
        const refreshed: AuthSession = {
          accessToken: stored.accessToken,
          user:        profileToUserSession(profile),
        }
        setSession(refreshed)
        setSessionState(refreshed)
      })
      .catch(err => {
        // 401 → token expired/revoked: drop the session
        if (err instanceof ApiError && err.status === 401) {
          clearSession()
          apiClient.clearToken()
          setSessionState(null)
        }
        // other errors: keep the cached session, user can retry later
      })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Step 1: obtain token
    const { accessToken } = await apiClient.login(email, password)
    apiClient.setToken(accessToken)

    // Step 2: fetch profile to get tenant + role info
    const profile = await apiClient.getProfile()
    const user    = profileToUserSession(profile)

    const newSession: AuthSession = { accessToken, user }
    setSession(newSession)
    setSessionState(newSession)

    // SuperAdmin sin tenant → panel admin; usuario con tenant → dashboard
    if (user.isSuperAdmin && !user.tenantId) {
      router.push('/admin')
    } else {
      router.push('/dashboard')
    }
  }, [router])

  const logout = useCallback(() => {
    clearSession()
    apiClient.clearToken()
    setSessionState(null)
    router.push('/login')
  }, [router])

  const refreshProfile = useCallback(async () => {
    // No-op when logged out — silently ignore so callers don't need to guard.
    const current = session
    if (!current) return
    try {
      const profile = await apiClient.getProfile()
      const refreshed: AuthSession = {
        accessToken: current.accessToken,
        user:        profileToUserSession(profile),
      }
      setSession(refreshed)
      setSessionState(refreshed)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        apiClient.clearToken()
        setSessionState(null)
      }
      // Other errors: keep cached state.
    }
  }, [session])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
