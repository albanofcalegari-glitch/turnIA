'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token }   = use(params)
  const router      = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await apiClient.resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('El link expiró o ya fue usado. Pedí uno nuevo.')
      } else {
        setError('No pudimos actualizar la contraseña. Intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandLogo size="lg" />
        </div>

        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Elegí una nueva contraseña</h1>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Listo, tu contraseña fue actualizada. Te llevamos al login…
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirmar contraseña</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={loading || !password || !confirm}>
                {loading ? (<><Spinner size="sm" className="text-white" />Guardando…</>) : 'Guardar contraseña'}
              </Button>

              <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
                Volver al login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
