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
import { apiClient, ApiError } from '@/lib/api'
import { getSession, setSession, clearSession, type AuthSession, type UserSession } from '@/lib/auth-store'

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session:  AuthSession | null
  user:     UserSession | null
  loading:  boolean
  login:    (email: string, password: string) => Promise<void>
  logout:   () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const [loading, setLoading]      = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const stored = getSession()
    if (stored) {
      apiClient.setToken(stored.accessToken)
      setSessionState(stored)
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Step 1: obtain token
    const { accessToken } = await apiClient.login(email, password)
    apiClient.setToken(accessToken)

    // Step 2: fetch profile to get tenant + role info
    const profile = await apiClient.getProfile()
    const primary = profile.tenants?.[0] ?? null

    const user: UserSession = {
      id:          profile.id,
      email:       profile.email,
      firstName:   profile.firstName,
      lastName:    profile.lastName,
      isSuperAdmin: profile.isSuperAdmin,
      tenantId:       primary?.tenantId          ?? null,
      tenantSlug:     primary?.tenant.slug       ?? null,
      tenantName:     primary?.tenant.name       ?? null,
      tenantTimezone: primary?.tenant.timezone   ?? null,
      role:           primary?.role              ?? null,
    }

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

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, login, logout }}>
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
