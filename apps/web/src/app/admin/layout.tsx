'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Shield, LogOut, LayoutDashboard, Building2, CreditCard, BarChart3, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const NAV = [
  { href: '/admin',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/admin/negocios',   label: 'Negocios',      icon: Building2       },
  { href: '/admin/pagos',      label: 'Pagos',         icon: CreditCard      },
  { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3       },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && (!user || !user.isSuperAdmin)) {
      router.replace('/admin/login')
    }
  }, [loading, user, router])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (pathname === '/admin/login') return <>{children}</>
  if (loading || !user || !user.isSuperAdmin) return null

  const sidebar = (
    <>
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-brand-600 dark:text-brand-400" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">turnIT</span>
          </div>
          <ThemeToggle />
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">Panel de administración</p>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map(item => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all',
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-600/20 dark:text-brand-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
              )}
            >
              <item.icon size={16} className={cn(isActive ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center gap-2.5 rounded-lg p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-600/30 dark:text-brand-400">
            SA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-300">{user.email}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Super Admin</p>
          </div>
          <button onClick={logout} title="Cerrar sesión" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95 md:hidden">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-brand-600 dark:text-brand-400" />
          <span className="font-bold text-gray-900 dark:text-white">turnIT</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-gray-200 bg-white shadow-sidebar transition-transform duration-200 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none md:static md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {sidebar}
      </aside>

      <main className="flex-1 overflow-auto p-4 pt-18 sm:p-6 md:pt-6">
        {children}
      </main>
    </div>
  )
}
