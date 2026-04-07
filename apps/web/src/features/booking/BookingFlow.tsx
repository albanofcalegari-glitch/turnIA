'use client'

import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useBooking } from './useBooking'
import { StepServices } from './steps/StepServices'
import { StepProfessional } from './steps/StepProfessional'
import { StepDate } from './steps/StepDate'
import { StepSlots } from './steps/StepSlots'
import { StepDetails } from './steps/StepDetails'
import { BookingSuccess } from './BookingSuccess'
import type { BookingStep } from './booking.types'

interface Props {
  tenantSlug: string
}

// ── Step indicator ─────────────────────────────────────────────────────────

const STEPS: { id: BookingStep; label: string }[] = [
  { id: 'services',     label: 'Servicio'     },
  { id: 'professional', label: 'Profesional'  },
  { id: 'date',         label: 'Fecha'        },
  { id: 'slots',        label: 'Horario'      },
  { id: 'details',      label: 'Confirmación' },
]

function StepIndicator({ current }: { current: BookingStep }) {
  if (current === 'success') return null
  const currentIdx = STEPS.findIndex(s => s.id === current)

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => {
        const done    = idx < currentIdx
        const active  = idx === currentIdx
        const isLast  = idx === STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={[
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                done   ? 'bg-brand-600 text-white'                     : '',
                active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : '',
                !done && !active ? 'bg-gray-100 text-gray-400'         : '',
              ].join(' ')}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={[
                'hidden text-xs sm:block',
                active ? 'font-semibold text-brand-700' : 'text-gray-400',
              ].join(' ')}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={[
                'mx-1 h-0.5 w-8 sm:w-12 transition-colors',
                done ? 'bg-brand-600' : 'bg-gray-200',
              ].join(' ')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function BookingFlow({ tenantSlug }: Props) {
  const booking = useBooking(tenantSlug)

  const {
    tenant, initLoading, initError,
    step, goBack,
  } = booking

  // ── Full-page loading ─────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-gray-500">
          <Spinner size="lg" />
          <p className="text-sm">Cargando…</p>
        </div>
      </div>
    )
  }

  // ── Init error ────────────────────────────────────────────────────────────
  if (initError || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-2xl">😕</p>
          <p className="mt-3 font-semibold text-gray-900">Negocio no encontrado</p>
          <p className="mt-1 text-sm text-gray-500">
            {initError ?? 'Verificá la dirección e intentá de nuevo.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'success' && booking.createdAppointments.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <BookingHeader tenant={tenant} slug={tenantSlug} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <BookingSuccess
            appointments={booking.createdAppointments}
            timezone={booking.timezone}
            onReset={booking.reset}
          />
        </main>
      </div>
    )
  }

  const canGoBack = step !== 'services'

  return (
    <div className="min-h-screen bg-gray-50">
      <BookingHeader tenant={tenant} slug={tenantSlug} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
          <StepIndicator current={step} />
        </div>

        {/* Back button */}
        {canGoBack && (
          <button
            onClick={goBack}
            className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← Volver
          </button>
        )}

        {/* Multi-service indicator */}
        {booking.isMultiService && booking.currentService && step !== 'services' && step !== 'details' && (
          <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
            Reservando: <span className="font-semibold">{booking.currentService.name}</span>
            {' '}({booking.currentServiceIndex + 1} de {booking.selectedServices.length})
          </div>
        )}

        {/* Step content */}
        {step === 'services'     && <StepServices     booking={booking} />}
        {step === 'professional' && <StepProfessional booking={booking} />}
        {step === 'date'         && <StepDate         booking={booking} />}
        {step === 'slots'        && <StepSlots        booking={booking} />}
        {step === 'details'      && <StepDetails      booking={booking} />}
      </main>
    </div>
  )
}

// ── Shared header ──────────────────────────────────────────────────────────

function BookingHeader({ tenant, slug }: { tenant: { name: string; logoUrl: string | null }; slug: string }) {
  return (
    <header className="border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {tenant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-full object-cover" />
        )}
        <h1 className="text-base font-bold text-gray-900 sm:text-lg">{tenant.name}</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <span className="hidden text-sm text-gray-400 sm:block">Reservar turno</span>
          <Link href={`/${slug}/cancelar`} className="text-xs text-red-500 hover:text-red-700 sm:text-sm">
            Cancelar turno
          </Link>
        </div>
      </div>
    </header>
  )
}
