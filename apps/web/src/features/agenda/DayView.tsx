'use client'

import { formatDateLong } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { AppointmentCard } from './AppointmentCard'
import { WorkOrderBlock } from './WorkOrderBlock'
import type { useAgenda } from './useAgenda'

type AgendaHook = ReturnType<typeof useAgenda>

interface Props {
  agenda:   AgendaHook
  timezone: string
}

export function DayView({ agenda, timezone }: Props) {
  const {
    selectedDate, setSelectedDate,
    dayAppointments,
    dayWorkOrders,
    loading, error,
    actionLoading, executeAction,
    refresh,
  } = agenda

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  return (
    <div>
      {/* Date nav bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDay(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            onClick={() => shiftDay(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
          >
            ›
          </button>
          <h2 className="ml-1 text-sm font-semibold text-gray-900 capitalize">
            {formatDateLong(selectedDate)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Hoy
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={refresh} className="text-xs font-medium text-red-700 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && dayAppointments.length === 0 && dayWorkOrders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-3xl">📅</p>
          <p className="mt-3 font-medium text-gray-700">Sin turnos para este día</p>
          <p className="mt-1 text-sm text-gray-400">
            Los turnos reservados aparecerán acá.
          </p>
        </div>
      )}

      {/* Appointments list */}
      {!loading && dayAppointments.length > 0 && (
        <div className="space-y-3">
          {dayAppointments.map(appt => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              timezone={timezone}
              isLoading={!!actionLoading[appt.id]}
              onAction={(action, payload) => executeAction(appt.id, action, payload)}
            />
          ))}
        </div>
      )}

      {/* Work orders section — only rendered when the tenant has complex
          services and there are orders overlapping this day. Read-only;
          each block links to the order detail page. */}
      {!loading && dayWorkOrders.length > 0 && (
        <div className={dayAppointments.length > 0 ? 'mt-6' : ''}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Órdenes de trabajo ({dayWorkOrders.length})
          </h3>
          <div className="space-y-3">
            {dayWorkOrders.map(({ order, slot }) => (
              <WorkOrderBlock
                key={slot.id}
                order={order}
                slot={slot}
                timezone={timezone}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
