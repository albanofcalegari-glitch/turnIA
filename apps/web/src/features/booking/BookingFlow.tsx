'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Award, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LoyaltyCardView } from '@/features/loyalty/LoyaltyCardView'
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
                active ? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900' : '',
                !done && !active ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'         : '',
              ].join(' ')}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={[
                'hidden text-xs sm:block',
                active ? 'font-semibold text-brand-700 dark:text-brand-400' : 'text-gray-400',
              ].join(' ')}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={[
                'mx-1 h-0.5 w-8 sm:w-12 transition-colors',
                done ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
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
    tenant, loyaltyProgram, initLoading, initError,
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
        <div className="max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-2xl">😕</p>
          <p className="mt-3 font-semibold text-gray-900 dark:text-white">Negocio no encontrado</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-3xl">🔒</p>
          <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
            {tenant.name}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Las reservas online están temporalmente no disponibles.
          </p>
          <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-left text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            El negocio está al día con su mantenimiento. Por favor contactalo directamente para coordinar tu turno.
          </div>
          {(tenant.phone || tenant.address) && (
            <div className="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <BookingHeader tenant={tenant} slug={tenantSlug} />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <BookingSuccess
            appointments={booking.createdAppointments}
            timezone={booking.timezone}
            onReset={booking.reset}
            guestName={booking.guestInfo.name}
            loyaltyProgram={booking.loyaltyProgram}
            loyaltyCard={booking.loyaltyCard}
            tenantName={tenant.name}
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BookingHeader tenant={tenant} slug={tenantSlug} />

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
          <StepIndicator current={step} showBranchStep={booking.showBranchStep} />
        </div>

        {/* Loyalty card banner */}
        {loyaltyProgram && (
          <LoyaltyBanner booking={booking} tenant={tenant} />
        )}

        {/* Back button */}
        {canGoBack && (
          <button
            onClick={goBack}
            className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Volver
          </button>
        )}

        {/* Selected branch indicator — only shown after the user has actually
            picked one in a multi-branch tenant. Gives the user a persistent
            reminder of which sucursal they're booking against. */}
        {booking.showBranchStep && booking.selectedBranch && step !== 'branch' && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            Sucursal: <span className="font-semibold text-gray-900 dark:text-white">{booking.selectedBranch.name}</span>
          </div>
        )}

        {/* Multi-turno iteration indicator (only when there's no unified pro
            for all selected services and we're walking service-by-service) */}
        {booking.requiresMultiTurno && booking.currentService && step !== 'services' && step !== 'details' && step !== 'branch' && (
          <div className="mb-4 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400">
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

// ── Loyalty banner with email lookup ───────────────────────────────────────

function LoyaltyBanner({
  booking,
  tenant,
}: {
  booking: ReturnType<typeof useBooking>
  tenant: { name: string }
}) {
  const { loyaltyProgram, loyaltyCard, loyaltyCardLoading, lookupLoyaltyCard } = booking
  const [open, setOpen] = useState(true)
  const [email, setEmail] = useState('')
  const [searched, setSearched] = useState(false)

  if (!loyaltyProgram) return null

  const handleLookup = () => {
    if (!email.trim() || !email.includes('@')) return
    setSearched(true)
    lookupLoyaltyCard(email.trim())
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden dark:border-amber-800 dark:bg-amber-950/50">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
          <Award size={16} />
          {loyaltyProgram.cardTitle}
          {loyaltyProgram.cardSubtitle && (
            <span className="text-xs font-normal text-amber-600 dark:text-amber-400">— {loyaltyProgram.cardSubtitle}</span>
          )}
        </span>
        {open ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!loyaltyCard && (
            <div>
              <p className="text-xs text-amber-700 mb-2 dark:text-amber-400">
                Ingresá tu email para ver tu tarjeta de fidelidad
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setSearched(false) }}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-amber-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                />
                <button
                  onClick={handleLookup}
                  disabled={loyaltyCardLoading || !email.includes('@')}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {loyaltyCardLoading ? <Spinner size="sm" className="text-white" /> : <Search size={14} />}
                  Buscar
                </button>
              </div>
              {searched && !loyaltyCardLoading && !loyaltyCard && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  No encontramos una tarjeta con ese email. Reservá tu primer turno y se creará automáticamente.
                </p>
              )}
            </div>
          )}

          {loyaltyCard ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  {loyaltyCard.clientName}
                </p>
                <button
                  onClick={() => { setEmail(''); setSearched(false); booking.clearLoyaltyCard() }}
                  className="text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                >
                  Cambiar
                </button>
              </div>
              <LoyaltyCardView
                program={loyaltyProgram}
                stampsCount={loyaltyCard.stampsCount}
                rewardsAvailable={loyaltyCard.rewardsAvailable}
                clientName={loyaltyCard.clientName}
                tenantName={tenant.name}
              />
            </div>
          ) : !searched ? (
            <LoyaltyCardView
              program={loyaltyProgram}
              stampsCount={0}
              tenantName={tenant.name}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Shared header ──────────────────────────────────────────────────────────

function BookingHeader({ tenant, slug }: { tenant: { name: string; logoUrl: string | null }; slug: string }) {
  return (
    <header className="border-b bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {tenant.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-full object-cover" />
        )}
        <h1 className="text-base font-bold text-gray-900 sm:text-lg dark:text-white">{tenant.name}</h1>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href={`/${slug}/cancelar`} className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 sm:text-sm dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700">
            Cancelar turno
          </Link>
        </div>
      </div>
    </header>
  )
}
