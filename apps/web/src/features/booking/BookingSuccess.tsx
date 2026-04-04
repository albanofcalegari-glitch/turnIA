'use client'

import { formatDateLong, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { CreatedAppointment } from './booking.types'

interface Props {
  appointment: CreatedAppointment
  timezone:    string
  onReset:     () => void
}

export function BookingSuccess({ appointment, timezone, onReset }: Props) {
  const date = appointment.startAt.split('T')[0]

  return (
    <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
      {/* Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
        <span className="text-3xl">✓</span>
      </div>

      {/* Title */}
      <h2 className="mt-5 text-2xl font-bold text-gray-900">¡Turno confirmado!</h2>
      <p className="mt-2 text-gray-500">
        Te esperamos. Revisá tu email para los detalles completos.
      </p>

      {/* Summary card */}
      <div className="mx-auto mt-6 max-w-sm rounded-xl border border-gray-200 divide-y divide-gray-100 text-left">
        <div className="flex items-center gap-3 px-4 py-3">
          <span>👤</span>
          <div>
            <p className="text-xs text-gray-400">Profesional</p>
            <p className="text-sm font-medium text-gray-900">
              {appointment.professional.displayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span>📅</span>
          <div>
            <p className="text-xs text-gray-400">Fecha y hora</p>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {formatDateLong(date)} — {formatTime(appointment.startAt, timezone)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <span>⏱</span>
          <div>
            <p className="text-xs text-gray-400">Duración</p>
            <p className="text-sm font-medium text-gray-900">{appointment.totalMinutes} min</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span>💰</span>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {new Intl.NumberFormat('es-AR', {
              style:    'currency',
              currency: appointment.currency || 'ARS',
              maximumFractionDigits: 0,
            }).format(
              typeof appointment.totalPrice === 'string'
                ? parseFloat(appointment.totalPrice)
                : appointment.totalPrice,
            )}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className="mt-4">
        <span className={[
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
          appointment.status === 'CONFIRMED'
            ? 'bg-brand-100 text-brand-700'
            : 'bg-yellow-100 text-yellow-700',
        ].join(' ')}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {appointment.status === 'CONFIRMED' ? 'Confirmado' : 'Pendiente de confirmación'}
        </span>
      </div>

      {/* Action */}
      <Button variant="outline" size="lg" className="mt-8 w-full max-w-sm" onClick={onReset}>
        Reservar otro turno
      </Button>
    </div>
  )
}
