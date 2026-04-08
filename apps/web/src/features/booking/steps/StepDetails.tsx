'use client'

import { cn, formatDateLong, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { useBooking } from '../useBooking'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

function Field({
  label,
  required,
  children,
}: {
  label:    string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

export function StepDetails({ booking }: Props) {
  const {
    selectedServices,
    selectedProfessional,
    selectedDate,
    selectedSlot,
    guestInfo,
    updateGuestInfo,
    submit,
    submitting,
    submitError,
    timezone,
    isMultiService,
    serviceBookings,
  } = booking

  const isValid = guestInfo.name.trim().length > 0 && guestInfo.email.trim().length > 0

  const totalPrice = isMultiService
    ? serviceBookings.reduce(
        (acc, b) => acc + (typeof b.service.price === 'string' ? parseFloat(b.service.price) : b.service.price),
        0,
      )
    : selectedServices.reduce(
        (acc, s) => acc + (typeof s.price === 'string' ? parseFloat(s.price) : s.price),
        0,
      )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Confirmá tu reserva</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isMultiService
            ? `Vas a reservar ${serviceBookings.length} turnos. Completá tus datos para confirmar.`
            : 'Completá tus datos para confirmar el turno.'}
        </p>
      </div>

      {/* Booking summary */}
      {isMultiService ? (
        /* Multi-service: show each booking separately */
        <div className="mb-6 space-y-3">
          {serviceBookings.map((b, idx) => (
            <div key={idx} className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{b.service.name}</p>
                  <p className="text-xs text-gray-500">
                    con {b.professional.displayName}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
                    typeof b.service.price === 'string' ? parseFloat(b.service.price) : b.service.price,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm">📅</span>
                <p className="text-sm text-gray-700 capitalize">
                  {formatDateLong(b.date)} — {formatTime(b.slot.startAt, timezone)}
                </p>
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm font-medium text-gray-600">Total ({serviceBookings.length} turnos)</p>
            <p className="text-base font-bold text-gray-900">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPrice)}
            </p>
          </div>
        </div>
      ) : (
        /* Single service: original summary */
        <div className="mb-6 rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {selectedProfessional && (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Profesional</p>
                <p className="text-sm font-medium text-gray-900">{selectedProfessional.displayName}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg">✂️</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Servicio{selectedServices.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {selectedServices.map(s => s.name).join(' + ')}
              </p>
            </div>
          </div>

          {selectedDate && selectedSlot && (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">📅</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Fecha y hora</p>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {formatDateLong(selectedDate)} — {formatTime(selectedSlot.startAt, timezone)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">💰</span>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
            </div>
            <p className="text-base font-bold text-gray-900">
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPrice)}
            </p>
          </div>
        </div>
      )}

      {/* Guest info form */}
      <div className="space-y-4">
        <Field label="Nombre completo" required>
          <input
            type="text"
            className={inputCls}
            placeholder="Juan García"
            value={guestInfo.name}
            onChange={e => updateGuestInfo('name', e.target.value)}
            autoComplete="name"
          />
        </Field>

        <Field label="Email" required>
          <input
            type="email"
            className={inputCls}
            placeholder="juan@ejemplo.com"
            value={guestInfo.email}
            onChange={e => updateGuestInfo('email', e.target.value)}
            autoComplete="email"
          />
        </Field>

        <Field label="Teléfono">
          <input
            type="tel"
            inputMode="tel"
            className={inputCls}
            placeholder="+54 9 11 1234-5678"
            value={guestInfo.phone}
            onChange={e => updateGuestInfo('phone', e.target.value.replace(/[^\d+\-\s()]/g, ''))}
            autoComplete="tel"
          />
        </Field>

        <Field label="Notas para el profesional">
          <textarea
            className={cn(inputCls, 'resize-none')}
            rows={3}
            placeholder="Ej: cabello teñido, alergias, preferencias…"
            value={guestInfo.notes}
            onChange={e => updateGuestInfo('notes', e.target.value)}
          />
        </Field>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Submit button */}
      <Button
        size="lg"
        className="mt-6 w-full"
        disabled={!isValid || submitting}
        onClick={submit}
      >
        {submitting ? (
          <>
            <Spinner size="sm" className="text-white" />
            Confirmando…
          </>
        ) : isMultiService ? (
          `Confirmar ${serviceBookings.length} turnos`
        ) : (
          'Confirmar turno'
        )}
      </Button>

      <p className="mt-3 text-center text-xs text-gray-400">
        Anotá la fecha y hora del turno. Si necesitás cancelarlo, podés hacerlo desde la sección "Cancelar turno".
      </p>
    </div>
  )
}
