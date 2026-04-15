'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Calendar, Scissors, Users, Clock, Settings, LogOut, Menu, X, ShieldOff, Building2, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  href: string
  label: string
  icon: typeof Calendar
  /** When set, the item is only rendered if the predicate returns true. */
  show?: (user: { tenantHasMultipleBranches: boolean }) => boolean
}

const NAV: NavItem[] = [
  { href: '/dashboard',               label: 'Agenda',         icon: Calendar  },
  { href: '/dashboard/servicios',     label: 'Servicios',      icon: Scissors  },
  { href: '/dashboard/profesionales', label: 'Profesionales',  icon: Users     },
  { href: '/dashboard/horarios',      label: 'Horarios',       icon: Clock     },
  // Stage 1 (branches): only shown when the tenant declared multiple sucursales
  // at registration. Single-branch tenants never see this entry, keeping the
  // dashboard identical to the pre-Phase-3 experience.
  {
    href:  '/dashboard/sucursales',
    label: 'Sucursales',
    icon:  Building2,
    show:  (u) => u.tenantHasMultipleBranches,
  },
  { href: '/dashboard/configuracion', label: 'Configuración',  icon: Settings  },
  { href: '/dashboard/suscripcion',   label: 'Suscripción',    icon: CreditCard },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Client-side fallback: middleware handles server-side, but guard here too
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [loading, user, pathname, router])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Show nothing while checking session to avoid flash
  if (loading || !user) return null

  // Tenant deactivated by SuperAdmin → block the whole dashboard with a notice.
  // SuperAdmins (without their own tenant) and users that aren't bound to a
  // tenant are not affected.
  if (user.tenantId && user.tenantIsActive === false) {
    return <DeactivatedScreen
      tenantName={user.tenantName}
      expiresAt={user.tenantMembershipExpiresAt}
      onLogout={logout}
    />
  }

  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="border-b p-4">
        <span className="text-lg font-bold text-brand-600">turnIT</span>
        {user.tenantName && (
          <p className="mt-0.5 truncate text-xs text-gray-400">{user.tenantName}</p>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.filter(item => !item.show || item.show({ tenantHasMultipleBranches: user.tenantHasMultipleBranches })).map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href as any}
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
    </>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4 md:hidden">
        <span className="text-lg font-bold text-brand-600">turnIT</span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: static, mobile: slide-over */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r bg-white transition-transform duration-200 md:static md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 pt-18 sm:p-6 md:pt-6">
        <MembershipBanner expiresAt={user.tenantMembershipExpiresAt} />
        {children}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner mostrado cuando quedan ≤ 7 días de prueba, o el trial ya venció y
// el tenant está en el periodo de gracia de 7 días (solo-lectura). Se oculta
// cuando la membresía está saludable (> 7 días) o no tiene vencimiento (las
// cuentas internas con expiresAt=null).
// ─────────────────────────────────────────────────────────────────────────────
function MembershipBanner({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const now     = new Date()
  const expiry  = new Date(expiresAt)
  const msLeft  = expiry.getTime() - now.getTime()
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

  // > 7 días → no molestamos.
  if (daysLeft > 7) return null

  // Vencido pero dentro de gracia (hasta 7 días post-expiry).
  if (daysLeft <= 0 && daysLeft > -7) {
    return (
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <strong>Suscripción vencida.</strong> Estás en modo <strong>solo lectura</strong> por {7 + daysLeft} {7 + daysLeft === 1 ? 'día' : 'días'} más. Luego tu cuenta se suspende.
        </div>
        <Link href="/dashboard/suscripcion" className="inline-block shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
          Pagar ahora
        </Link>
      </div>
    )
  }

  // Trial por vencer (≤ 7 días, todavía activo).
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        Te {daysLeft === 1 ? 'queda' : 'quedan'} <strong>{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</strong> de prueba. Suscribite para no perder el acceso.
      </div>
      <Link href="/dashboard/suscripcion" className="inline-block shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Suscribirme
      </Link>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Deactivated tenant — full-screen takeover
// ─────────────────────────────────────────────────────────────────────────────

function DeactivatedScreen({
  tenantName,
  expiresAt,
  onLogout,
}: {
  tenantName: string | null
  expiresAt:  string | null
  onLogout:   () => void
}) {
  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <ShieldOff className="text-red-600" size={28} />
        </div>

        <h1 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">
          Membresía desactivada
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          {tenantName ? <>La cuenta de <strong>{tenantName}</strong> está</> : 'Tu cuenta está'}{' '}
          temporalmente suspendida y los clientes ya no pueden reservar turnos online.
        </p>

        {formattedExpiry && (
          <p className="mt-3 text-xs text-gray-500">
            Vencimiento de la membresía: <strong>{formattedExpiry}</strong>
          </p>
        )}

        <div className="mt-6 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-800">
          Para reactivar el servicio, comunicate con el administrador de turnIT y regularizá el pago de tu membresía.
        </div>

        <button
          onClick={onLogout}
          className="mt-6 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
