'use client'

import { cn, formatMonthYear, toDateString } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { AppointmentCard } from './AppointmentCard'
import type { useAgenda } from './useAgenda'

type AgendaHook = ReturnType<typeof useAgenda>

interface Props {
  agenda:   AgendaHook
  timezone: string
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function getMonthGrid(selectedDate: string): string[][] {
  const d = new Date(selectedDate + 'T12:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)

  let startDay = first.getDay() - 1
  if (startDay < 0) startDay = 6

  const totalDays = last.getDate()
  const weeks: string[][] = []
  let week: string[] = []

  for (let i = 0; i < startDay; i++) {
    const prev = new Date(year, month, -(startDay - 1 - i))
    week.push(toDateString(prev))
  }

  for (let day = 1; day <= totalDays; day++) {
    week.push(toDateString(new Date(year, month, day)))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    let nextDay = 1
    while (week.length < 7) {
      week.push(toDateString(new Date(year, month + 1, nextDay++)))
    }
    weeks.push(week)
  }

  return weeks
}

export function MonthView({ agenda, timezone }: Props) {
  const {
    selectedDate, setSelectedDate, setView,
    monthAppointments,
    loading, error,
    actionLoading, executeAction,
    goToPrevMonth, goToNextMonth,
    refresh,
  } = agenda

  const d = new Date(selectedDate + 'T12:00:00')
  const currentMonth = d.getMonth()
  const monthStr = formatMonthYear(d.getFullYear(), currentMonth)
  const weeks = getMonthGrid(selectedDate)
  const today = toDateString(new Date())

  function handleDayClick(date: string) {
    setSelectedDate(date)
    setView('day')
  }

  return (
    <div>
      {/* Month nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-500 hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            onClick={goToNextMonth}
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
          Este mes
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
        <div>
          {/* Header row */}
          <div className="grid grid-cols-7 border-b">
            {DAY_LABELS.map(label => (
              <div key={label} className="py-2 text-center text-xs font-medium text-gray-500">
                {label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {week.map(date => {
                const dayNum = new Date(date + 'T12:00:00').getDate()
                const isCurrentMonth = new Date(date + 'T12:00:00').getMonth() === currentMonth
                const isToday = date === today
                const isSelected = date === selectedDate
                const appts = monthAppointments[date] ?? []

                return (
                  <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    className={cn(
                      'relative min-h-[80px] border-r last:border-r-0 p-1.5 text-left transition-colors hover:bg-gray-50',
                      !isCurrentMonth && 'bg-gray-50/50',
                      isSelected && 'ring-2 ring-inset ring-brand-500',
                    )}
                  >
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday && 'bg-brand-600 text-white',
                      !isToday && isCurrentMonth && 'text-gray-900',
                      !isToday && !isCurrentMonth && 'text-gray-300',
                    )}>
                      {dayNum}
                    </span>

                    {appts.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {appts.slice(0, 3).map(a => (
                          <div
                            key={a.id}
                            className={cn(
                              'truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                              a.status === 'COMPLETED' && 'bg-green-50 text-green-700',
                              a.status === 'CONFIRMED' && 'bg-brand-50 text-brand-700',
                              a.status === 'PENDING'   && 'bg-amber-50 text-amber-700',
                              a.status === 'CANCELLED' && 'bg-gray-100 text-gray-400 line-through',
                              a.status === 'NO_SHOW'   && 'bg-red-50 text-red-600',
                            )}
                          >
                            {new Date(a.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })}{' '}
                            {a.guestName || (a.client ? a.client.firstName : '')}
                          </div>
                        ))}
                        {appts.length > 3 && (
                          <p className="text-[9px] text-gray-400 pl-1">+{appts.length - 3} más</p>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Detail panel for selected day */}
      {!loading && (monthAppointments[selectedDate]?.length ?? 0) > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 capitalize">
            Turnos del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-3">
            {(monthAppointments[selectedDate] ?? []).map(appt => (
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
        </div>
      )}
    </div>
  )
}
