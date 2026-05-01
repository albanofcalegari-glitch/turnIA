'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'

export default function LoginPage() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
      // AuthContext.login redirects to /dashboard on success
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Email o contraseña incorrectos.')
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Tu cuenta está deshabilitada. Contactá al administrador.')
      } else {
        setError('Error al iniciar sesión. Verificá tu conexión e intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/"><BrandLogo size="lg" /></Link>
          <p className="mt-1 text-sm text-gray-500">Panel de administración</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-card">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Iniciar sesión</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@negocio.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Contraseña
                </label>
                <Link
                  href="/olvide-password"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  ¿Olvidaste la contraseña?
                </Link>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Ingresando…
                </>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">Registrate gratis</Link>
        </p>
      </div>
    </div>
  )
}
