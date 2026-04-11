'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Shield, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || !user.isSuperAdmin)) {
      router.replace('/login')
    }
  }, [loading, user, router])

  if (loading || !user || !user.isSuperAdmin) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
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
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
