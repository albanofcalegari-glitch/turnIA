'use client'

import { formatDateLong, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { LoyaltyCardView } from '@/features/loyalty/LoyaltyCardView'
import { Gift } from 'lucide-react'
import type { CreatedAppointment } from './booking.types'
import type { BookingLoyaltyProgram, BookingLoyaltyCard } from '@/lib/api'

interface Props {
  appointments:    CreatedAppointment[]
  timezone:        string
  onReset:         () => void
  guestName?:      string
  loyaltyProgram?: BookingLoyaltyProgram | null
  loyaltyCard?:    BookingLoyaltyCard | null
  tenantName?:     string
}

function formatPrice(value: number | string, currency: string) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency || 'ARS',
    maximumFractionDigits: 0,
  }).format(num)
}

export function BookingSuccess({
  appointments,
  timezone,
  onReset,
  guestName,
  loyaltyProgram,
  loyaltyCard,
  tenantName,
}: Props) {
  const isMulti = appointments.length > 1

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
        {/* Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
          <span className="text-3xl">✓</span>
        </div>

        {/* Title */}
        <h2 className="mt-5 text-2xl font-bold text-gray-900">
          {isMulti ? `¡${appointments.length} turnos confirmados!` : '¡Turno confirmado!'}
        </h2>
        {guestName && (
          <p className="mt-1 text-sm text-gray-500">
            {guestName}, te esperamos.
          </p>
        )}
        {!guestName && (
          <p className="mt-2 text-gray-500">Te esperamos.</p>
        )}

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

      {/* Loyalty card section */}
      {loyaltyProgram && loyaltyCard && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {loyaltyCard.rewardsAvailable > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Gift size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  ¡Tenés {loyaltyCard.rewardsAvailable} {loyaltyCard.rewardsAvailable === 1 ? 'premio' : 'premios'} disponible{loyaltyCard.rewardsAvailable === 1 ? '' : 's'}!
                </p>
                <p className="text-xs text-amber-700">
                  {loyaltyProgram.rewardLabel} — pedilo en tu próxima visita
                </p>
              </div>
            </div>
          )}

          <p className="mb-3 text-center text-sm font-medium text-gray-600">Tu tarjeta de fidelidad</p>
          <LoyaltyCardView
            program={loyaltyProgram}
            stampsCount={loyaltyCard.stampsCount}
            rewardsAvailable={loyaltyCard.rewardsAvailable}
            clientName={loyaltyCard.clientName}
            tenantName={tenantName}
          />
        </div>
      )}

      {loyaltyProgram && !loyaltyCard && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
          <p className="mb-3 text-sm font-medium text-gray-600">Programa de fidelidad</p>
          <LoyaltyCardView
            program={loyaltyProgram}
            stampsCount={0}
            tenantName={tenantName}
          />
          <p className="mt-3 text-xs text-gray-500">
            Cada turno completado suma un sello. {loyaltyProgram.cardSubtitle}
          </p>
        </div>
      )}
    </div>
  )
}
