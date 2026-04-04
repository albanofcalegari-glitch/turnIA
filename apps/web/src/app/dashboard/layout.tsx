'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Calendar, Scissors, Users, Clock, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const NAV = [
  { href: '/dashboard',               label: 'Agenda',         icon: Calendar  },
  { href: '/dashboard/servicios',     label: 'Servicios',      icon: Scissors  },
  { href: '/dashboard/profesionales', label: 'Profesionales',  icon: Users     },
  { href: '/dashboard/horarios',      label: 'Horarios',       icon: Clock     },
  { href: '/dashboard/configuracion', label: 'Configuración',  icon: Settings  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()

  // Client-side fallback: middleware handles server-side, but guard here too
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [loading, user, pathname, router])

  // Show nothing while checking session to avoid flash
  if (loading || !user) return null

  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r bg-white">
        {/* Logo */}
        <div className="border-b p-4">
          <span className="text-lg font-bold text-brand-600">TurnIA</span>
          {user.tenantName && (
            <p className="mt-0.5 truncate text-xs text-gray-400">{user.tenantName}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(item => {
            // Exact match for dashboard root, prefix match for sub-routes
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[10px] text-gray-400">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
