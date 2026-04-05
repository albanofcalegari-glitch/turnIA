'use client'

import { formatDateLong, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { CreatedAppointment } from './booking.types'

interface Props {
  appointments: CreatedAppointment[]
  timezone:     string
  onReset:      () => void
}

function formatPrice(value: number | string, currency: string) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency || 'ARS',
    maximumFractionDigits: 0,
  }).format(num)
}

export function BookingSuccess({ appointments, timezone, onReset }: Props) {
  const isMulti = appointments.length > 1

  return (
    <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
      {/* Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
        <span className="text-3xl">✓</span>
      </div>

      {/* Title */}
      <h2 className="mt-5 text-2xl font-bold text-gray-900">
        {isMulti ? `¡${appointments.length} turnos confirmados!` : '¡Turno confirmado!'}
      </h2>
      <p className="mt-2 text-gray-500">
        Te esperamos. Revisá tu email para los detalles completos.
      </p>

      {/* Summary cards */}
      <div className="mx-auto mt-6 max-w-sm space-y-3">
        {appointments.map((appt, idx) => {
          const date = appt.startAt.split('T')[0]
          return (
            <div key={appt.id} className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-left">
              {isMulti && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  <p className="text-xs font-medium text-gray-600">Turno {idx + 1}</p>
                </div>
              )}

              <div className="flex items-center gap-3 px-4 py-3">
                <span>👤</span>
                <div>
                  <p className="text-xs text-gray-400">Profesional</p>
                  <p className="text-sm font-medium text-gray-900">
                    {appt.professional.displayName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3">
                <span>📅</span>
                <div>
                  <p className="text-xs text-gray-400">Fecha y hora</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {formatDateLong(date)} — {formatTime(appt.startAt, timezone)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span>⏱</span>
                  <p className="text-xs text-gray-400">{appt.totalMinutes} min</p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {formatPrice(appt.totalPrice, appt.currency)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Status badge */}
      <div className="mt-4">
        <span className={[
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
          appointments[0].status === 'CONFIRMED'
            ? 'bg-brand-100 text-brand-700'
            : 'bg-yellow-100 text-yellow-700',
        ].join(' ')}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {appointments[0].status === 'CONFIRMED' ? 'Confirmado' : 'Pendiente de confirmación'}
        </span>
      </div>

      {/* Action */}
      <Button variant="outline" size="lg" className="mt-8 w-full max-w-sm" onClick={onReset}>
        Reservar otro turno
      </Button>
    </div>
  )
}
