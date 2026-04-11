'use client'

import Link from 'next/link'
import { ClipboardList, Users, ChevronRight } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import type { WorkOrder, WorkOrderSlot, WorkOrderStatus } from '@/lib/api'

// ─────────────────────────────────────────────────────────────────────────────
// Status meta — mirrors the /dashboard/ordenes page for visual consistency
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<WorkOrderStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pendiente',  cls: 'bg-amber-50  text-amber-700  border-amber-200' },
  CONFIRMED:   { label: 'Confirmada', cls: 'bg-brand-50  text-brand-700  border-brand-200' },
  IN_PROGRESS: { label: 'En curso',   cls: 'bg-blue-50   text-blue-700   border-blue-200'  },
  COMPLETED:   { label: 'Completada', cls: 'bg-gray-100  text-gray-600   border-gray-200'  },
  CANCELLED:   { label: 'Cancelada',  cls: 'bg-red-50    text-red-700    border-red-200'   },
}

interface Props {
  order:    WorkOrder
  /** The specific WorkSlot that matches the day being displayed. */
  slot:     WorkOrderSlot
  timezone: string
}

/**
 * Read-only block rendered in the agenda for work orders.
 * Clicks through to /dashboard/ordenes/[id] — no inline actions.
 */
export function WorkOrderBlock({ order, slot, timezone }: Props) {
  const meta       = STATUS_META[order.status]
  const isTerminal = order.status === 'COMPLETED' || order.status === 'CANCELLED'
  const assigned   = slot.assignments
  const clientName = order.client
    ? `${order.client.firstName} ${order.client.lastName}`
    : null

  return (
    <Link
      href={`/dashboard/ordenes/${order.id}` as any}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-l-4 bg-white p-4 transition-shadow hover:shadow-sm',
        isTerminal && 'opacity-60',
      )}
      style={{ borderLeftColor: order.service.color ?? '#6b7280' }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <ClipboardList size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-gray-900">
            {formatTime(slot.startAt, timezone)}
          </span>
          <span className="text-xs text-gray-400">
            → {formatTime(slot.endAt, timezone)}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', meta.cls)}>
            {meta.label}
          </span>
        </div>

        <p className="mt-1 truncate font-semibold text-gray-900">{order.service.name}</p>
        {clientName && (
          <p className="truncate text-xs text-gray-500">{clientName}</p>
        )}

        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
          <Users size={12} />
          {assigned.length > 0
            ? assigned.map(a => a.professional.displayName).join(', ')
            : 'Sin asignar'}
        </div>
      </div>

      <ChevronRight size={18} className="flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
    </Link>
  )
}
