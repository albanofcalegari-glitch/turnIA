'use client'

import { cn, formatTime, formatMonthYear } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from './StatusBadge'
import { AppointmentCard } from './AppointmentCard'
import { type Appointment } from './agenda.types'
import type { useAgenda } from './useAgenda'

type AgendaHook = ReturnType<typeof useAgenda>

interface Props {
  agenda:   AgendaHook
  timezone: string
}

const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function WeekView({ agenda, timezone }: Props) {
  const {
    selectedDate, setSelectedDate,
    weekAppointments,
    loading, error,
    actionLoading, executeAction,
    goToPrevWeek, goToNextWeek,
    refresh,
  } = agenda

  const monday   = getWeekMonday(selectedDate)
  const monthStr = formatMonthYear(monday.getFullYear(), monday.getMonth())

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  const today = new Date().toISOString().split('T')[0]

  // Expanded day — when null, show compact grid; when set, show full column
  function handleDayClick(date: string) {
    setSelectedDate(date)
  }

  return (
    <div>
      {/* Week nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            onClick={goToNextWeek}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
          >
            ›
          </button>
          <h2 className="ml-1 text-sm font-semibold text-gray-900 capitalize">{monthStr}</h2>
        </div>
        <button
          onClick={() => setSelectedDate(today)}
          className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Esta semana
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={refresh} className="text-xs font-medium text-red-700 underline">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {dates.map((date, idx) => {
            const appts = weekAppointments[date] ?? []
            const isToday = date === today
            const isSelected = date === selectedDate

            return (
              <div
                key={date}
                className={cn(
                  'rounded-xl border bg-white',
                  isSelected && 'ring-2 ring-brand-500',
                )}
              >
                {/* Day header */}
                <button
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    'w-full rounded-t-xl px-2 py-2 text-center transition-colors hover:bg-gray-50',
                    isToday && 'bg-brand-50',
                  )}
                >
                  <p className={cn('text-xs font-medium', isToday ? 'text-brand-600' : 'text-gray-500')}>
                    {DAY_SHORT[idx]}
                  </p>
                  <p className={cn(
                    'text-lg font-bold',
                    isToday ? 'text-brand-700' : 'text-gray-900',
                  )}>
                    {new Date(date + 'T12:00:00').getDate()}
                  </p>
                  {appts.length > 0 && (
                    <span className="mt-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                      {appts.length}
                    </span>
                  )}
                </button>

                {/* Compact appointment list */}
                <div className="space-y-1 p-1.5">
                  {appts.slice(0, 4).map((appt: Appointment) => (
                    <div
                      key={appt.id}
                      className="rounded-lg border bg-gray-50 px-2 py-1.5 text-left"
                    >
                      <p className="text-[10px] font-bold tabular-nums text-gray-700">
                        {formatTime(appt.startAt, timezone)}
                      </p>
                      <p className="truncate text-[10px] text-gray-500">
                        {appt.guestName
                          || (appt.client ? `${appt.client.firstName} ${appt.client.lastName}` : 'Invitado')}
                      </p>
                      <StatusBadge status={appt.status} size="xs" />
                    </div>
                  ))}
                  {appts.length > 4 && (
                    <p className="px-1 text-[10px] text-gray-400">+{appts.length - 4} más</p>
                  )}
                  {appts.length === 0 && (
                    <p className="px-1 py-2 text-center text-[10px] text-gray-300">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail panel for selected day */}
      {!loading && weekAppointments[selectedDate]?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 capitalize">
            Turnos del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-3">
            {weekAppointments[selectedDate].map(appt => (
              <AppointmentCard
                key={appt.id}
                appointment={appt}
                timezone={timezone}
                isLoading={!!actionLoading[appt.id]}
                onAction={(action, payload) => executeAction(appt.id, action, payload)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
