'use client'

import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useBooking } from './useBooking'
import { StepBranch } from './steps/StepBranch'
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

const BASE_STEPS: { id: BookingStep; label: string }[] = [
  { id: 'services',     label: 'Servicio'     },
  { id: 'professional', label: 'Profesional'  },
  { id: 'date',         label: 'Fecha'        },
  { id: 'slots',        label: 'Horario'      },
  { id: 'details',      label: 'Confirmación' },
]

const BRANCH_STEP = { id: 'branch' as BookingStep, label: 'Sucursal' }

function StepIndicator({ current, showBranchStep }: { current: BookingStep; showBranchStep: boolean }) {
  if (current === 'success') return null
  const STEPS = showBranchStep ? [BRANCH_STEP, ...BASE_STEPS] : BASE_STEPS
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

  // ── Tenant existe pero membresía suspendida ───────────────────────────────
  if (!tenant.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-3xl">🔒</p>
          <p className="mt-3 text-lg font-semibold text-gray-900">
            {tenant.name}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Las reservas online están temporalmente no disponibles.
          </p>
          <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-left text-xs text-amber-800">
            El negocio está al día con su mantenimiento. Por favor contactalo directamente para coordinar tu turno.
          </div>
          {(tenant.phone || tenant.address) && (
            <div className="mt-4 space-y-1 text-xs text-gray-500">
              {tenant.phone   && <p>📞 {tenant.phone}</p>}
              {tenant.address && <p>📍 {tenant.address}</p>}
            </div>
          )}
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

  // The first step is `branch` for multi-branch tenants and `services`
  // otherwise — neither one has anything to go back to.
  const firstStep: BookingStep = booking.showBranchStep ? 'branch' : 'services'
  const canGoBack = step !== firstStep

  return (
    <div className="min-h-screen bg-gray-50">
      <BookingHeader tenant={tenant} slug={tenantSlug} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
          <StepIndicator current={step} showBranchStep={booking.showBranchStep} />
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

        {/* Selected branch indicator — only shown after the user has actually
            picked one in a multi-branch tenant. Gives the user a persistent
            reminder of which sucursal they're booking against. */}
        {booking.showBranchStep && booking.selectedBranch && step !== 'branch' && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600">
            Sucursal: <span className="font-semibold text-gray-900">{booking.selectedBranch.name}</span>
          </div>
        )}

        {/* Multi-turno iteration indicator (only when there's no unified pro
            for all selected services and we're walking service-by-service) */}
        {booking.requiresMultiTurno && booking.currentService && step !== 'services' && step !== 'details' && step !== 'branch' && (
          <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700">
            Reservando: <span className="font-semibold">{booking.currentService.name}</span>
            {' '}({booking.currentServiceIndex + 1} de {booking.selectedServices.length})
          </div>
        )}

        {/* Step content */}
        {step === 'branch'       && <StepBranch       booking={booking} />}
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
