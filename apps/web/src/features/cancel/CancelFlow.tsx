'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { cn, formatDateLong, formatTime } from '@/lib/utils'
import { apiClient, ApiError, type GuestAppointment } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Dialog'

interface Props {
  tenantSlug: string
}

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
  'dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400',
)

export function CancelFlow({ tenantSlug }: Props) {
  const [tenantId, setTenantId]         = useState<string | null>(null)
  const [tenantName, setTenantName]     = useState('')
  const [timezone, setTimezone]         = useState('America/Argentina/Buenos_Aires')
  const [email, setEmail]               = useState('')
  const [appointments, setAppointments] = useState<GuestAppointment[]>([])
  const [searched, setSearched]         = useState(false)
  const [loading, setLoading]           = useState(false)
  const [cancelling, setCancelling]     = useState<string | null>(null)
  const [cancelled, setCancelled]       = useState<Set<string>>(new Set())
  const [error, setError]               = useState<string | null>(null)
  const [initError, setInitError]       = useState(false)
  const { confirm, element: confirmDialog } = useConfirm()

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading) return

    setLoading(true)
    setError(null)
    setSearched(false)

    try {
      // Resolve tenant if not yet loaded
      let tid = tenantId
      if (!tid) {
        const tenant = await apiClient.getTenantBySlug(tenantSlug)
        tid = tenant.id
        setTenantId(tenant.id)
        setTenantName(tenant.name)
        setTimezone(tenant.timezone)
      }

      const appts = await apiClient.getGuestAppointments(tid!, email.trim())
      setAppointments(appts)
      setSearched(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setInitError(true)
      } else {
        setError('No se pudieron buscar los turnos. Intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel(apptId: string) {
    if (!tenantId || cancelling) return

    const ok = await confirm({
      title:       'Cancelar turno',
      message:     '¿Estás seguro de que querés cancelar este turno?',
      confirmText: 'Sí, cancelar',
      cancelText:  'Volver',
      variant:     'danger',
    })
    if (!ok) return

    setCancelling(apptId)
    setError(null)

    try {
      await apiClient.guestCancelAppointment(tenantId, apptId, email.trim())
      setCancelled(prev => new Set(prev).add(apptId))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al cancelar el turno.'
      setError(msg)
    } finally {
      setCancelling(null)
    }
  }

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl">😕</p>
          <p className="mt-3 font-semibold text-gray-900 dark:text-white">Negocio no encontrado</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Verificá la dirección e intentá de nuevo.</p>
        </div>
      </div>
    )
  }

  const activeAppointments = appointments.filter(a => !cancelled.has(a.id))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {confirmDialog}
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{tenantName || tenantSlug.replace(/-/g, ' ')}</h1>
          <span className="ml-auto text-sm text-gray-400">Cancelar turno</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Back to booking */}
        <Link
          href={`/${tenantSlug}`}
          className="mb-6 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ← Volver a reservar
        </Link>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cancelar un turno</h2>
        <p className="mt-1 text-sm text-gray-500 mb-6 dark:text-gray-400">
          Ingresá el email con el que reservaste para ver tus turnos.
        </p>

        {/* Email form */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className={cn(inputCls, 'flex-1')}
          />
          <Button type="submit" disabled={!email.trim() || loading}>
            {loading ? <Spinner size="sm" className="text-white" /> : 'Buscar'}
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {searched && (
          <div className="mt-6">
            {activeAppointments.length === 0 && cancelled.size === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center dark:border-gray-600 dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">No se encontraron turnos activos para este email.</p>
              </div>
            )}

            {(activeAppointments.length > 0 || cancelled.size > 0) && (
              <div className="space-y-3">
                {appointments.map(appt => {
                  const isCancelled = cancelled.has(appt.id)
                  const date = appt.startAt.split('T')[0]
                  const serviceName = appt.items.map(i => i.serviceName).join(' + ')

                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        'rounded-xl border bg-white p-4 dark:border-gray-700 dark:bg-gray-800',
                        isCancelled && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">{serviceName}</p>
                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            con {appt.professional.displayName}
                          </p>
                          <p className="mt-1 text-sm text-gray-700 capitalize dark:text-gray-300">
                            📅 {formatDateLong(date)} — {formatTime(appt.startAt, timezone)}
                          </p>
                        </div>

                        {isCancelled ? (
                          <span className="flex-shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Cancelado
                          </span>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={cancelling === appt.id}
                            onClick={() => handleCancel(appt.id)}
                          >
                            {cancelling === appt.id ? (
                              <Spinner size="sm" className="text-white" />
                            ) : (
                              'Cancelar'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {cancelled.size > 0 && (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-800 dark:bg-green-900/30">
                <p className="text-2xl">✅</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                  {cancelled.size === 1
                    ? 'Tu turno fue cancelado correctamente'
                    : `${cancelled.size} turnos fueron cancelados correctamente`}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Si querés podés volver a reservar cuando quieras.
                </p>
                <Link
                  href={`/${tenantSlug}`}
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Volver al inicio
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
