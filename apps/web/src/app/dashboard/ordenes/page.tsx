'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import Link from 'next/link'
import { ClipboardList, Plus, X, Calendar, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError, type WorkOrder, type WorkOrderStatus } from '@/lib/api'
import type { Service } from '@/features/booking/booking.types'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// Shared classes + status meta
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

const STATUS_META: Record<WorkOrderStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pendiente',   cls: 'bg-amber-50  text-amber-700  border-amber-200' },
  CONFIRMED:   { label: 'Confirmada',  cls: 'bg-brand-50  text-brand-700  border-brand-200' },
  IN_PROGRESS: { label: 'En curso',    cls: 'bg-blue-50   text-blue-700   border-blue-200'  },
  COMPLETED:   { label: 'Completada',  cls: 'bg-gray-100  text-gray-600   border-gray-200'  },
  CANCELLED:   { label: 'Cancelada',   cls: 'bg-red-50    text-red-700    border-red-200'   },
}

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', meta.cls)}>
      {meta.label}
    </span>
  )
}

function formatMoney(value: number | string, currency = 'ARS') {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const sameDay = s.toDateString() === e.toDateString()
  const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
  return sameDay ? fmt(s) : `${fmt(s)} → ${fmt(e)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OrdenesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [orders,   setOrders]   = useState<WorkOrder[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filter,   setFilter]   = useState<'ALL' | 'ACTIVE' | WorkOrderStatus>('ACTIVE')

  async function fetchOrders() {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      const rows = await apiClient.getWorkOrders(tenantId)
      setOrders(rows)
    } catch {
      setError('No se pudieron cargar las órdenes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrders() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId])

  const visible = useMemo(() => {
    if (filter === 'ALL')    return orders
    if (filter === 'ACTIVE') return orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
    return orders.filter(o => o.status === filter)
  }, [orders, filter])

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Órdenes de trabajo</h1>
        <Button onClick={() => setShowForm(true)} className="self-start sm:self-auto">
          <Plus size={16} />
          Nueva orden
        </Button>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'ACTIVE' as const,    label: 'Activas'    },
          { key: 'PENDING' as const,   label: 'Pendientes' },
          { key: 'CONFIRMED' as const, label: 'Confirmadas'},
          { key: 'IN_PROGRESS' as const, label: 'En curso' },
          { key: 'COMPLETED' as const, label: 'Completadas'},
          { key: 'CANCELLED' as const, label: 'Canceladas' },
          { key: 'ALL' as const,       label: 'Todas'      },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => { setError(null); fetchOrders() }} className="ml-2 underline">
            Reintentar
          </button>
        </div>
      )}

      {showForm && (
        <CreateOrderModal
          tenantId={tenantId}
          onClose={() => setShowForm(false)}
          onCreated={(wo) => {
            setOrders(prev => [wo, ...prev])
            setShowForm(false)
          }}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <ClipboardList size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">Sin órdenes</p>
          <p className="mt-1 text-sm text-gray-400">
            Creá una orden para coordinar servicios multi-profesional o multi-día.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Nueva orden
          </Button>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map(order => {
            const assignedCount = order.workSlots.reduce((acc, s) => acc + s.assignments.length, 0)
            const slotCount     = order.workSlots.length
            const clientName    = order.client
              ? `${order.client.firstName} ${order.client.lastName}`
              : 'Sin cliente'

            return (
              <Link
                key={order.id}
                href={`/dashboard/ordenes/${order.id}` as any}
                className="group flex items-center gap-3 rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm"
              >
                {order.service.color && (
                  <span className="h-10 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: order.service.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-gray-900">{order.service.name}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">{clientName}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDateRange(order.scheduledStartAt, order.scheduledEndAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {assignedCount} asignado(s) en {slotCount} tramo(s)
                    </span>
                    <span className="font-medium text-gray-700">
                      {formatMoney(order.totalPrice)}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────────────────────────────────────

interface ComplexServiceOption extends Service {
  minProfessionals?: number
  maxProfessionals?: number
  allowsMultiDay?:   boolean
}

function CreateOrderModal({
  tenantId,
  onCreated,
  onClose,
}: {
  tenantId:  string
  onCreated: (wo: WorkOrder) => void
  onClose:   () => void
}) {
  const [services,        setServices]        = useState<ComplexServiceOption[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [serviceId,       setServiceId]       = useState('')
  const [startDate,       setStartDate]       = useState(new Date().toISOString().slice(0, 10))
  const [totalPrice,      setTotalPrice]      = useState('')
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  useEffect(() => {
    apiClient.getServices(tenantId)
      .then(list => {
        const complex = (list as ComplexServiceOption[]).filter(s =>
          (typeof s.minProfessionals === 'number' && s.minProfessionals > 1) ||
          s.allowsMultiDay === true,
        )
        setServices(complex)
        if (complex.length > 0 && !serviceId) setServiceId(complex[0].id)
      })
      .catch(() => setError('No se pudieron cargar los servicios.'))
      .finally(() => setLoadingServices(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const isValid = serviceId && startDate

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const wo = await apiClient.createWorkOrder(tenantId, {
        serviceId,
        startDate:  `${startDate}T00:00:00.000Z`,
        totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
        notes:      notes.trim() || undefined,
      })
      onCreated(wo)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Error al crear la orden. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nueva orden</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {loadingServices ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No hay servicios complejos configurados. Creá uno desde{' '}
            <Link href="/dashboard/servicios" className="underline">Servicios</Link>{' '}
            activando <strong>Duración avanzada</strong>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Servicio <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className={inputCls}
                required
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.minProfessionals && s.minProfessionals > 1 ? ` · ${s.minProfessionals}+ pros` : ''}
                    {s.allowsMultiDay ? ' · multi-día' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Fecha de inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-500">
                Los tramos se generan hacia adelante desde esta fecha, saltando días no laborables.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Precio total (opcional)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Dejar vacío para usar el precio del servicio"
                value={totalPrice}
                onChange={e => setTotalPrice(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Detalles internos"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={!isValid || saving}>
                {saving ? <><Spinner size="sm" className="text-white" /> Creando…</> : 'Crear orden'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
