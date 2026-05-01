'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, LogIn, UserPlus, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/login',          label: 'Iniciar sesión', icon: LogIn },
  { href: '/register',       label: 'Crear cuenta',   icon: UserPlus },
  { href: '/que-es-turnit',  label: '¿Qué es Turnit?', icon: HelpCircle },
]

export function PublicMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors',
          open
            ? 'border-gray-300 bg-white text-gray-900'
            : 'border-gray-200 bg-white/90 text-gray-600 backdrop-blur-sm hover:bg-white hover:text-gray-900',
        )}
        aria-label="Menú"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 animate-fade-in rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          {LINKS.map(link => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href as any}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <link.icon size={16} className={isActive ? 'text-brand-600' : 'text-gray-400'} />
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
