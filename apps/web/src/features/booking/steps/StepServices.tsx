'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { useBooking } from '../useBooking'
import type { Service } from '../booking.types'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

function formatPrice(price: number | string, currency: string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price
  if (!num) return ''
  return new Intl.NumberFormat('es-AR', {
    style:    'currency',
    currency: currency || 'ARS',
    maximumFractionDigits: 0,
  }).format(num)
}

function ServiceCard({
  service,
  selected,
  onToggle,
}: {
  service:  Service
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border-2 p-4 text-left transition-all',
        selected
          ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {service.color && (
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: service.color }}
              />
            )}
            <p className="font-semibold text-gray-900 truncate">{service.name}</p>
          </div>
          {service.description && (
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{service.description}</p>
          )}
          <p className="mt-1.5 text-sm text-gray-400">
            {service.durationMinutes} min
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {formatPrice(service.price, service.currency) && (
            <p className="text-base font-semibold text-gray-900">
              {formatPrice(service.price, service.currency)}
            </p>
          )}
          <div className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
            selected ? 'border-brand-600 bg-brand-600' : 'border-gray-300',
          )}>
            {selected && <span className="text-[10px] text-white font-bold">✓</span>}
          </div>
        </div>
      </div>
    </button>
  )
}

export function StepServices({ booking }: Props) {
  const { services, selectedServices, toggleService, confirmServices } = booking
  const totalMinutes = selectedServices.reduce((acc, s) => acc + s.durationMinutes, 0)
  const totalPrice = selectedServices.reduce(
    (acc, s) => acc + (typeof s.price === 'string' ? parseFloat(s.price) : s.price),
    0,
  )

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center">
        <p className="text-gray-400">Este negocio aún no tiene servicios disponibles.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">¿Qué servicio querés reservar?</h2>
        <p className="mt-1 text-sm text-gray-500">Podés elegir uno o varios servicios.</p>
      </div>

      <div className="space-y-3">
        {services.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            selected={selectedServices.some(s => s.id === service.id)}
            onToggle={() => toggleService(service)}
          />
        ))}
      </div>

      {selectedServices.length > 0 && (
        <div className="mt-6 rounded-xl bg-brand-50 border border-brand-200 p-4">
          <div className="flex justify-between text-sm text-gray-700">
            <span>{selectedServices.length} servicio{selectedServices.length > 1 ? 's' : ''}</span>
            <span>{totalMinutes} min{totalPrice > 0 ? ` · ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPrice)}` : ''}</span>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Button
          size="lg"
          className="w-full"
          disabled={selectedServices.length === 0}
          onClick={confirmServices}
        >
          Continuar →
        </Button>
      </div>
    </div>
  )
}
