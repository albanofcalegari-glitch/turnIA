'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Shield, LogOut, Building2, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TABS = [
  { href: '/admin',          label: 'Negocios', icon: Building2   },
  { href: '/admin/payments', label: 'Pagos',    icon: CreditCard  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    if (!loading && (!user || !user.isSuperAdmin)) {
      router.replace('/login')
    }
  }, [loading, user, router])

  if (loading || !user || !user.isSuperAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-brand-600" />
            <span className="text-lg font-bold text-brand-600">turnIT</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              SuperAdmin
            </span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {TABS.map(tab => {
            const isActive = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href as any}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'border-brand-600 font-medium text-brand-700'
                    : 'border-transparent text-gray-500 hover:text-gray-900',
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
