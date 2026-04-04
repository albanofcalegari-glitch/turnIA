'use client'

import { cn, formatDateLong, formatTime } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import type { useBooking } from '../useBooking'
import type { AvailableSlot } from '../booking.types'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  NOT_WORKING:     'El profesional no trabaja este día.',
  EXCEPTION_BLOCK: 'El profesional no está disponible este día (bloqueo o vacaciones).',
  FULLY_BLOCKED:   'No hay horarios disponibles para esta fecha. Probá con otro día.',
}

function SlotButton({
  slot,
  selected,
  timezone,
  onSelect,
}: {
  slot:     AvailableSlot
  selected: boolean
  timezone: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all',
        selected
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-400 hover:text-brand-700',
      )}
    >
      {formatTime(slot.startAt, timezone)}
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

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Elegí un horario</h2>
        {selectedDate && (
          <p className="mt-1 text-sm text-gray-500 capitalize">{formatDateLong(selectedDate)}</p>
        )}
      </div>

      {/* 409 Conflict banner */}
      {conflictError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="text-lg leading-none">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">Ese horario acaba de ser reservado</p>
            <p className="mt-0.5 text-sm text-red-700">
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
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">{slotsError}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refreshSlots}>
            Reintentar
          </Button>
        </div>
      )}

      {/* No slots available */}
      {!slotsLoading && !slotsError && slotsResponse && slotsResponse.slots.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium text-gray-700">Sin horarios disponibles</p>
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

      {/* Slot grid */}
      {!slotsLoading && !slotsError && slotsResponse && slotsResponse.slots.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {slotsResponse.slots.map((slot: AvailableSlot) => (
              <SlotButton
                key={slot.startAt}
                slot={slot}
                selected={selectedSlot?.startAt === slot.startAt}
                timezone={timezone}
                onSelect={() => selectSlot(slot)}
              />
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400 text-center">
            Duración total: {slotsResponse.totalDurationMinutes} min
          </p>
        </>
      )}
    </div>
  )
}
