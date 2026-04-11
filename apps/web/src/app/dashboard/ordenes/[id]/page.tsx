'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Calendar, Users, Plus, X, Trash2, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  apiClient, ApiError,
  type WorkOrder, type WorkOrderSlot, type WorkOrderStatus, type SlotAvailablePro,
} from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// Status meta + transitions (mirrors backend ALLOWED map)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<WorkOrderStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pendiente',   cls: 'bg-amber-50  text-amber-700  border-amber-200' },
  CONFIRMED:   { label: 'Confirmada',  cls: 'bg-brand-50  text-brand-700  border-brand-200' },
  IN_PROGRESS: { label: 'En curso',    cls: 'bg-blue-50   text-blue-700   border-blue-200'  },
  COMPLETED:   { label: 'Completada',  cls: 'bg-gray-100  text-gray-600   border-gray-200'  },
  CANCELLED:   { label: 'Cancelada',   cls: 'bg-red-50    text-red-700    border-red-200'   },
}

type ActionVariant = 'primary' | 'danger'

const NEXT_ACTIONS: Record<WorkOrderStatus, Array<{ to: WorkOrderStatus; label: string; variant: ActionVariant }>> = {
  PENDING:     [{ to: 'CONFIRMED',   label: 'Confirmar',  variant: 'primary' }, { to: 'CANCELLED', label: 'Cancelar', variant: 'danger' }],
  CONFIRMED:   [{ to: 'IN_PROGRESS', label: 'Iniciar',    variant: 'primary' }, { to: 'CANCELLED', label: 'Cancelar', variant: 'danger' }],
  IN_PROGRESS: [{ to: 'COMPLETED',   label: 'Completar',  variant: 'primary' }, { to: 'CANCELLED', label: 'Cancelar', variant: 'danger' }],
  COMPLETED:   [],
  CANCELLED:   [],
}

function formatSlotDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    weekday: 'short',
    day:     '2-digit',
    month:   'short',
  })
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime.slice(0, 5)} – ${endTime.slice(0, 5)}`
}

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.cls)}>
      {meta.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''
  const params   = useParams<{ id: string }>()
  const orderId  = params.id

  const [order,    setOrder]    = useState<WorkOrder | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [acting,   setActing]   = useState<WorkOrderStatus | null>(null)
  const [actError, setActError] = useState<string | null>(null)

  async function fetchOrder() {
    if (!tenantId || !orderId) return
    setLoading(true)
    setError(null)
    try {
      const wo = await apiClient.getWorkOrder(tenantId, orderId)
      setOrder(wo)
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('No se pudo cargar la orden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrder() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenantId, orderId])

  async function transitionStatus(next: WorkOrderStatus) {
    if (!order || acting) return
    if (next === 'CANCELLED' && !confirm('¿Cancelar esta orden? No se puede deshacer.')) return
    setActing(next)
    setActError(null)
    try {
      await apiClient.updateWorkOrderStatus(tenantId, order.id, next)
      // Refetch full order to keep all relational fields (service, client, branch)
      // which the PATCH response does not include.
      await fetchOrder()
    } catch (err) {
      if (err instanceof ApiError) setActError(err.message)
      else setActError('Error al cambiar el estado.')
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div>
        <Link href={'/dashboard/ordenes' as any} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Volver
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Orden no encontrada'}
        </div>
      </div>
    )
  }

  const clientName = order.client
    ? `${order.client.firstName} ${order.client.lastName}`
    : 'Sin cliente'

  const totalAssigned = order.workSlots.reduce((acc, s) => acc + s.assignments.length, 0)

  const actions = NEXT_ACTIONS[order.status]

  return (
    <div>
      <Link
        href={'/dashboard/ordenes' as any}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft size={14} /> Órdenes
      </Link>

      {/* Header card */}
      <div className="mb-5 rounded-2xl border bg-white p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {order.service.color && (
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: order.service.color }} />
              )}
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{order.service.name}</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">{clientName} · {order.branch.name}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatSlotDate(order.scheduledStartAt)} → {formatSlotDate(order.scheduledEndAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} />
            {totalAssigned} asignación(es) en {order.workSlots.length} tramo(s)
          </span>
          <span className="flex items-center gap-1.5">
            ≈ {order.estimatedMinutes} min
          </span>
        </div>

        {order.notes && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm italic text-gray-600">
            "{order.notes}"
          </p>
        )}

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {actions.map(a => (
              <Button
                key={a.to}
                variant={a.variant === 'danger' ? 'outline' : 'primary'}
                disabled={acting !== null}
                onClick={() => transitionStatus(a.to)}
                className={cn(
                  a.variant === 'danger' && 'border-red-300 text-red-700 hover:bg-red-50',
                )}
              >
                {acting === a.to ? <Spinner size="sm" /> : null}
                {a.label}
              </Button>
            ))}
          </div>
        )}

        {actError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{actError}</span>
          </div>
        )}
      </div>

      {/* Slots */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Tramos</h2>
      <div className="space-y-3">
        {order.workSlots.map(slot => (
          <SlotCard
            key={slot.id}
            tenantId={tenantId}
            order={order}
            slot={slot}
            onSlotUpdated={() => fetchOrder()}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot card with assignment UI
// ─────────────────────────────────────────────────────────────────────────────

function SlotCard({
  tenantId,
  order,
  slot,
  onSlotUpdated,
}: {
  tenantId:      string
  order:         WorkOrder
  slot:          WorkOrderSlot
  onSlotUpdated: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeErr,  setRemoveErr]  = useState<string | null>(null)

  const isLocked = order.status === 'COMPLETED' || order.status === 'CANCELLED'

  async function handleRemove(professionalId: string, name: string) {
    if (!confirm(`¿Quitar a ${name} de este tramo?`)) return
    setRemovingId(professionalId)
    setRemoveErr(null)
    try {
      await apiClient.unassignProfessionalFromSlot(tenantId, order.id, slot.id, professionalId)
      onSlotUpdated()
    } catch (err) {
      if (err instanceof ApiError) setRemoveErr(err.message)
      else setRemoveErr('Error al quitar el profesional.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold capitalize text-gray-900">
            {formatSlotDate(slot.startAt)}
          </p>
          <p className="text-xs text-gray-500">
            {formatTimeRange(slot.startTime, slot.endTime)}
          </p>
        </div>
        {!isLocked && (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Plus size={12} /> Asignar
          </button>
        )}
      </div>

      {/* Assigned professionals */}
      {slot.assignments.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {slot.assignments.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-2"
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: a.professional.color ?? '#6b7280' }}
              >
                {a.professional.displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs text-gray-700">{a.professional.displayName}</span>
              {!isLocked && (
                <button
                  disabled={removingId === a.professionalId}
                  onClick={() => handleRemove(a.professionalId, a.professional.displayName)}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  title="Quitar"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400">Sin profesionales asignados.</p>
      )}

      {removeErr && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {removeErr}
        </div>
      )}

      {showPicker && (
        <AvailableProPicker
          tenantId={tenantId}
          workOrderId={order.id}
          slotId={slot.id}
          onClose={() => setShowPicker(false)}
          onAssigned={() => { setShowPicker(false); onSlotUpdated() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Available-professionals picker (modal)
// ─────────────────────────────────────────────────────────────────────────────

function AvailableProPicker({
  tenantId,
  workOrderId,
  slotId,
  onClose,
  onAssigned,
}: {
  tenantId:    string
  workOrderId: string
  slotId:      string
  onClose:     () => void
  onAssigned:  () => void
}) {
  const [pros,      setPros]      = useState<SlotAvailablePro[]>([])
  const [loading,   setLoading]   = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    apiClient.getSlotAvailableProfessionals(tenantId, workOrderId, slotId)
      .then(setPros)
      .catch(err => {
        if (err instanceof ApiError) setError(err.message)
        else setError('No se pudieron cargar los profesionales.')
      })
      .finally(() => setLoading(false))
  }, [tenantId, workOrderId, slotId])

  async function pick(proId: string) {
    setAssigning(proId)
    setError(null)
    try {
      await apiClient.assignProfessionalToSlot(tenantId, workOrderId, slotId, proId)
      onAssigned()
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Error al asignar el profesional.')
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Asignar profesional</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Spinner size="md" />
          </div>
        )}

        {!loading && pros.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-500">
            No hay profesionales disponibles para este tramo.
          </p>
        )}

        {!loading && pros.length > 0 && (
          <div className="space-y-2">
            {pros.map(pro => (
              <button
                key={pro.id}
                disabled={assigning !== null}
                onClick={() => pick(pro.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: pro.color ?? '#6b7280' }}
                >
                  {pro.displayName.slice(0, 1).toUpperCase()}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{pro.displayName}</span>
                {assigning === pro.id && <Spinner size="sm" />}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
