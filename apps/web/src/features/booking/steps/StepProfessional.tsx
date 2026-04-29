'use client'

import { cn } from '@/lib/utils'
import type { useBooking } from '../useBooking'
import type { Professional } from '../booking.types'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

function ProfessionalCard({
  professional,
  selected,
  onSelect,
}: {
  professional: Professional
  selected:     boolean
  onSelect:     () => void
}) {
  const initials = professional.displayName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
        selected
          ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-900/20'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-750',
      )}
    >
      {/* Avatar */}
      {professional.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={professional.avatarUrl}
          alt={professional.displayName}
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: professional.color ?? '#6b7280' }}
        >
          {initials}
        </div>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-white">{professional.displayName}</p>
        {professional.bio && (
          <p className="mt-0.5 text-sm text-gray-500 line-clamp-2 dark:text-gray-400">{professional.bio}</p>
        )}
      </div>

      {/* Selection indicator */}
      <div className={cn(
        'ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        selected ? 'border-brand-600 bg-brand-600' : 'border-gray-300 dark:border-gray-600',
      )}>
        {selected && <span className="text-[10px] text-white font-bold">✓</span>}
      </div>
    </button>
  )
}

export function StepProfessional({ booking }: Props) {
  const {
    eligibleProfessionals,
    selectedProfessional,
    selectProfessional,
    selectedServices,
    requiresMultiTurno,
    currentService,
    currentServiceIndex,
  } = booking

  if (requiresMultiTurno && currentService) {
    if (eligibleProfessionals.length === 0) {
      return (
        <div className="rounded-2xl border bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 font-medium dark:text-gray-400">Sin profesionales disponibles</p>
          <p className="mt-1 text-sm text-gray-400">
            Ningún profesional ofrece &ldquo;{currentService.name}&rdquo;. Volvé al paso anterior y probá con otra combinación.
          </p>
        </div>
      )
    }

    if (eligibleProfessionals.length === 1 && !selectedProfessional) {
      selectProfessional(eligibleProfessionals[0])
      return null
    }

    return (
      <div>
        {currentServiceIndex === 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              No hay un solo profesional que haga los {selectedServices.length} servicios
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
              Vas a reservar un turno por cada servicio. Podés elegir un profesional diferente para cada uno.
            </p>
          </div>
        )}

        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Servicio {currentServiceIndex + 1} de {selectedServices.length}
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            ¿Con quién hacés &ldquo;{currentService.name}&rdquo;?
          </h2>
        </div>

        <div className="space-y-3">
          {eligibleProfessionals.map(p => (
            <ProfessionalCard
              key={p.id}
              professional={p}
              selected={selectedProfessional?.id === p.id}
              onSelect={() => selectProfessional(p)}
            />
          ))}
        </div>
      </div>
    )
  }

  if (eligibleProfessionals.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-500 font-medium dark:text-gray-400">Sin profesionales disponibles</p>
        <p className="mt-1 text-sm text-gray-400">
          {selectedServices.length === 1
            ? 'Ningún profesional ofrece este servicio en este momento.'
            : 'Ningún profesional ofrece todos los servicios seleccionados. Probá con otra combinación.'}
        </p>
      </div>
    )
  }

  if (eligibleProfessionals.length === 1 && !selectedProfessional) {
    selectProfessional(eligibleProfessionals[0])
    return null
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">¿Con quién querés atenderte?</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {selectedServices.length === 1
            ? `Profesionales que ofrecen "${selectedServices[0].name}"`
            : `Profesionales que ofrecen los ${selectedServices.length} servicios seleccionados`}
        </p>
      </div>

      <div className="space-y-3">
        {eligibleProfessionals.map(p => (
          <ProfessionalCard
            key={p.id}
            professional={p}
            selected={selectedProfessional?.id === p.id}
            onSelect={() => selectProfessional(p)}
          />
        ))}
      </div>
    </div>
  )
}
