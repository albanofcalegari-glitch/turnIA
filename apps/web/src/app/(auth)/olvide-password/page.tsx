'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      await apiClient.forgotPassword(email.trim())
      setSent(true)
    } catch {
      setError('No pudimos procesar la solicitud. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/"><BrandLogo size="lg" /></Link>
        </div>

        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-gray-900">Recuperar contraseña</h1>
          <p className="mb-6 text-sm text-gray-500">
            Ingresá tu email y te enviamos un link para elegir una nueva contraseña.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Si el email está registrado, vas a recibir un link en los próximos minutos.
                Revisá también la carpeta de spam.
              </div>
              <Link href="/login" className="block text-center text-sm font-medium text-brand-600 hover:text-brand-700">
                Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
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

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={loading || !email}>
                {loading ? (<><Spinner size="sm" className="text-white" />Enviando…</>) : 'Enviar link'}
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
