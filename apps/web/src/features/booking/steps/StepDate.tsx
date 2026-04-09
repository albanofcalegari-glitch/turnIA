'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn, formatMonthYear, toDateString } from '@/lib/utils'
import type { useBooking } from '../useBooking'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

// Max booking window: 60 days from today
const MAX_DAYS_AHEAD = 60

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun … 6=Sat
  // Convert to Monday-first: Sun(0)→6, Mon(1)→0, …
  const offset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function StepDate({ booking }: Props) {
  const {
    selectedDate, selectDate,
    tenant, availableDays, fetchAvailableDays,
    selectedProfessional, selectedBranch,
  } = booking

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000)

  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  // Fetch available days when the viewed month changes
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  useEffect(() => {
    if (tenant && selectedProfessional) {
      fetchAvailableDays(
        tenant.id,
        selectedProfessional.id,
        monthKey,
        selectedBranch?.id ?? null,
      )
    }
  }, [tenant, selectedProfessional, monthKey, selectedBranch, fetchAvailableDays])

  // Build a Set of unavailable dates for fast lookup
  const unavailableDates = useMemo(() => {
    if (!availableDays || availableDays.month !== monthKey) return new Set<string>()
    return new Set(
      availableDays.days
        .filter(d => !d.available)
        .map(d => d.date),
    )
  }, [availableDays, monthKey])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Disable prev button if already at current month
  const canGoPrev = viewYear > today.getFullYear() || viewMonth > today.getMonth()
  // Disable next if beyond max window
  const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
  const viewFirst = new Date(viewYear, viewMonth, 1)
  const canGoNext = viewFirst < maxMonth

  const cells = buildCalendarGrid(viewYear, viewMonth)

  function isCellDisabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day)
    if (d < today || d > maxDate) return true
    // Gray out days where the professional doesn't work
    const dateStr = toDateString(d)
    if (unavailableDates.has(dateStr)) return true
    return false
  }

  function isCellSelected(day: number): boolean {
    return selectedDate === toDateString(new Date(viewYear, viewMonth, day))
  }

  function isToday(day: number): boolean {
    return (
      viewYear  === today.getFullYear() &&
      viewMonth === today.getMonth()    &&
      day       === today.getDate()
    )
  }

  function handleSelect(day: number) {
    if (isCellDisabled(day)) return
    selectDate(toDateString(new Date(viewYear, viewMonth, day)))
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">¿Qué día te viene bien?</h2>
        <p className="mt-1 text-sm text-gray-500">Elegí una fecha para ver los horarios disponibles.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-30"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <p className="text-sm font-semibold text-gray-900 capitalize">
            {formatMonthYear(viewYear, viewMonth)}
          </p>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        {/* Day labels */}
        <div className="mb-1 grid grid-cols-7 gap-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-1 text-center text-xs font-medium text-gray-400">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />

            const disabled = isCellDisabled(day)
            const selected = isCellSelected(day)
            const todayCell = isToday(day)

            return (
              <button
                key={day}
                onClick={() => handleSelect(day)}
                disabled={disabled}
                aria-label={`${day} de ${formatMonthYear(viewYear, viewMonth)}`}
                className={cn(
                  'aspect-square rounded-lg text-sm font-medium transition-colors',
                  disabled  && 'cursor-not-allowed text-gray-200',
                  !disabled && !selected && 'text-gray-700 hover:bg-brand-50 hover:text-brand-700',
                  todayCell && !selected && !disabled && 'font-bold text-brand-600 underline underline-offset-2',
                  selected  && 'bg-brand-600 text-white',
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
