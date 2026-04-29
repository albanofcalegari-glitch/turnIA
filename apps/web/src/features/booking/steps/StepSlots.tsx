'use client'

import { useMemo } from 'react'
import { cn, formatDateLong, formatTime } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import type { useBooking } from '../useBooking'
import type { AvailableSlot, UnavailableSlot } from '../booking.types'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  NOT_WORKING:     'El profesional no trabaja este día.',
  EXCEPTION_BLOCK: 'El profesional no está disponible este día (bloqueo o vacaciones).',
  FULLY_BLOCKED:   'No hay horarios disponibles para esta fecha. Probá con otro día.',
}

type MergedSlot = { startAt: string; endAt: string; durationMinutes: number; available: boolean; capacity?: number; booked?: number; remainingCapacity?: number }

function SlotButton({
  slot,
  selected,
  timezone,
  onSelect,
}: {
  slot:     MergedSlot
  selected: boolean
  timezone: string
  onSelect: () => void
}) {
  if (!slot.available) {
    return (
      <div
        className="rounded-xl border-2 border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-300 line-through cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600"
        aria-disabled
      >
        {formatTime(slot.startAt, timezone)}
      </div>
    )
  }

  const isGroup = slot.capacity && slot.capacity > 1

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all',
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-400 hover:text-brand-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500 dark:hover:text-brand-400',
      )}
    >
      {formatTime(slot.startAt, timezone)}
      {isGroup && (
        <span className={cn('block text-[10px] font-normal mt-0.5', selected ? 'text-brand-100' : 'text-gray-400')}>
          {slot.remainingCapacity}/{slot.capacity} libres
        </span>
      )}
    </button>
  )
}

export function StepSlots({ booking }: Props) {
  const {
    selectedDate,
    selectedSlot,
    slotsResponse,
    slotsLoading,
    slotsError,
    conflictError,
    timezone,
    selectSlot,
    refreshSlots,
    goBack,
  } = booking

  // Merge available + unavailable slots into a single sorted list
  const mergedSlots = useMemo(() => {
    if (!slotsResponse) return []
    const available: MergedSlot[] = slotsResponse.slots.map(s => ({ ...s, available: true }))
    const unavailable: MergedSlot[] = (slotsResponse.unavailableSlots ?? []).map(s => ({ ...s, available: false }))
    return [...available, ...unavailable].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
  }, [slotsResponse])

  const hasAnySlots = mergedSlots.length > 0
  const hasAvailableSlots = slotsResponse ? slotsResponse.slots.length > 0 : false

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Elegí un horario</h2>
        {selectedDate && (
          <p className="mt-1 text-sm text-gray-500 capitalize dark:text-gray-400">{formatDateLong(selectedDate)}</p>
        )}
      </div>

      {/* 409 Conflict banner */}
      {conflictError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Ese horario acaba de ser reservado</p>
            <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">
              Otro usuario se adelantó. Los horarios se actualizaron — por favor elegí uno nuevo.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {slotsLoading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error fetching slots */}
      {!slotsLoading && slotsError && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">{slotsError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refreshSlots}>
            Reintentar
          </Button>
        </div>
      )}

      {/* No slots at all (not working / exception block) */}
      {!slotsLoading && !slotsError && slotsResponse && !hasAnySlots && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">Sin horarios disponibles</p>
          <p className="mt-1 text-sm text-gray-400">
            {slotsResponse.unavailableReason
              ? UNAVAILABLE_MESSAGES[slotsResponse.unavailableReason]
              : 'No hay turnos disponibles para esta fecha.'}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>
            Elegir otra fecha
          </Button>
        </div>
      )}

      {/* Slot grid (with both available and grayed-out unavailable) */}
      {!slotsLoading && !slotsError && slotsResponse && hasAnySlots && (
        <>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {mergedSlots.map((slot) => (
              <SlotButton
                key={slot.startAt}
                slot={slot}
                selected={slot.available && selectedSlot?.startAt === slot.startAt}
                timezone={timezone}
                onSelect={() => {
                  if (slot.available) {
                    selectSlot(slot as AvailableSlot)
                  }
                }}
              />
            ))}
          </div>

          {!hasAvailableSlots && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Todos los horarios están ocupados.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={goBack}>
                Elegir otra fecha
              </Button>
            </div>
          )}

          <p className="mt-4 text-xs text-gray-400 text-center">
            Duración total: {slotsResponse.totalDurationMinutes} min
          </p>
        </>
      )}
    </div>
  )
}
