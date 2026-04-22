'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ColorSwatch } from '@/components/ui/ColorSwatch'

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

export default function NewProfessionalPage() {
  const router = useRouter()
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [displayName, setDisplayName] = useState('')
  const [color,       setColor]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      await apiClient.createProfessional(tenantId, {
        displayName: displayName.trim(),
        color:       color || undefined,
      })
      router.push('/dashboard/profesionales')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear el profesional. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/profesionales"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Volver a profesionales
      </Link>

      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Agregar profesional</h1>
      <p className="mt-1 text-sm text-gray-500">
        Completá los datos básicos. Después vas a poder configurar horarios y asignar servicios.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-2xl border bg-white p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">Datos básicos</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Nombre profesional <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Ej: Ana García"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-400">
                Este nombre se muestra en la página de reservas.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Color para la agenda
              </label>
              <ColorSwatch value={color} onChange={setColor} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed bg-gray-50 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-500">Horarios de atención</h2>
          <p className="mt-2 text-xs text-gray-400">
            Por ahora el profesional atiende con los horarios generales del negocio.
            La configuración individual de horarios llega pronto.
          </p>
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/profesionales')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={!displayName.trim() || saving}>
            {saving ? (
              <>
                <Spinner size="sm" className="text-white" />
                Guardando…
              </>
            ) : (
              'Crear profesional'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
