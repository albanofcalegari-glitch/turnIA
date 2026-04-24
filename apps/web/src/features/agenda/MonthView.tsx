'use client'

import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatTime, toDateString } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Dialog } from '@/components/ui/Dialog'
import { AppointmentCard } from './AppointmentCard'
import type { useAgenda } from './useAgenda'
import type { Appointment } from './agenda.types'

type AgendaHook = ReturnType<typeof useAgenda>

interface Props {
  agenda:   AgendaHook
  timezone: string
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function MonthView({ agenda, timezone }: Props) {
  const {
    selectedDate, setSelectedDate,
    monthAppointments,
    loading, error,
    actionLoading, executeAction,
    refresh,
    goToPrevMonth, goToNextMonth,
  } = agenda

  const [openDate, setOpenDate] = useState<string | null>(null)
  const closeDetail = useCallback(() => setOpenDate(null), [])

  const anchor = useMemo(() => new Date(selectedDate + 'T12:00:00'), [selectedDate])
  const monthIdx = anchor.getMonth()
  const today    = toDateString(new Date())

  const gridDates = Object.keys(monthAppointments)

  const openAppointments: Appointment[] = openDate ? (monthAppointments[openDate] ?? []) : []

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={goToNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={14} />
          </button>
          <h2 className="ml-1 text-sm font-semibold text-gray-900 capitalize">
            {MONTH_NAMES[monthIdx]} {anchor.getFullYear()}
          </h2>
        </div>

        <button
          onClick={() => setSelectedDate(toDateString(new Date()))}
          className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Hoy
        </button>
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

      {/* Grid */}
      {!loading && (
        <div className="overflow-hidden rounded-xl border">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-[10px] font-medium uppercase tracking-wide text-gray-500">
            {WEEKDAYS.map(w => (
              <div key={w} className="py-2">{w}</div>
            ))}
          </div>
          {/* 6 rows x 7 cols */}
          <div className="grid grid-cols-7">
            {gridDates.map(date => {
              const d = new Date(date + 'T12:00:00')
              const inMonth = d.getMonth() === monthIdx
              const isToday = date === today
              const appts   = monthAppointments[date] ?? []
              const count   = appts.length
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setOpenDate(date)}
                  className={cn(
                    'relative flex min-h-[72px] flex-col items-start border-b border-r p-1.5 text-left transition-colors hover:bg-brand-50/60',
                    !inMonth && 'bg-gray-50/60 text-gray-400',
                    isToday && 'bg-brand-50/40',
                  )}
                >
                  <span className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
                    isToday ? 'bg-brand-600 text-white' : 'text-gray-700',
                    !inMonth && !isToday && 'text-gray-400',
                  )}>
                    {d.getDate()}
                  </span>
                  {count > 0 && (
                    <div className="mt-1 flex w-full flex-col gap-0.5">
                      {appts.slice(0, 3).map(a => (
                        <span
                          key={a.id}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${a.professional.color ?? '#6b7280'}22`,
                            color:           a.professional.color ?? '#374151',
                          }}
                        >
                          {formatTime(a.startAt, timezone)} · {a.guestName || a.client?.firstName || 'Turno'}
                        </span>
                      ))}
                      {count > 3 && (
                        <span className="text-[10px] font-medium text-gray-500">
                          +{count - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Day detail modal */}
      <Dialog
        open={openDate !== null}
        onClose={closeDetail}
        title={openDate ? formatDayLabel(openDate) : undefined}
        className="max-w-lg"
      >
        {openAppointments.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            Sin turnos para este día.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {openAppointments.map(appt => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                timezone={timezone}
                isLoading={!!actionLoading[appt.id]}
                onAction={(action, payload) => executeAction(appt.id, action, payload)}
                onLoyaltyRedeemed={refresh}
              />
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setOpenDate(null)}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </Dialog>
    </div>
  )
}

function formatDayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()]
  return `${weekday} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`
}
