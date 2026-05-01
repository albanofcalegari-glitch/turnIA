'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <nav className="border-b border-gray-100 px-4 py-4 flex items-center justify-between max-w-7xl mx-auto sm:px-6">
      <BrandLogo size="xl" />

      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-4">
        <Link href="/que-es-turnit" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">¿Qué es Turnit?</Link>
        <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Iniciar sesión</Link>
        <Link href="/register" className="text-sm font-semibold bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 transition-all shadow-sm hover:shadow">
          Registrar negocio
        </Link>
      </div>

      {/* Mobile hamburger */}
      <div ref={ref} className="relative sm:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          aria-label="Menú"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 animate-fade-in rounded-xl border border-gray-200 bg-white p-2 shadow-xl z-50">
            <Link
              href="/que-es-turnit"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              ¿Qué es Turnit?
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
            >
              Registrar negocio
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
