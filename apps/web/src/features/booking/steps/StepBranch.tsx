'use client'

import { Building2, MapPin, Phone, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { useBooking } from '../useBooking'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

export function StepBranch({ booking }: Props) {
  const { branches, selectedBranch, selectBranch } = booking

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Elegí la sucursal</h2>
        <p className="mt-1 text-sm text-gray-500">
          Seleccioná dónde querés reservar tu turno.
        </p>
      </div>

      <div className="space-y-3">
        {branches.map(br => {
          const isSelected = selectedBranch?.id === br.id
          return (
            <button
              key={br.id}
              type="button"
              onClick={() => selectBranch(br)}
              className={cn(
                'flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition-colors',
                isSelected
                  ? 'border-brand-500 ring-2 ring-brand-500/20'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <div className={cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg',
                isSelected ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700',
              )}>
                <Building2 size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{br.name}</p>
                {br.address && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 truncate">
                    <MapPin size={12} className="flex-shrink-0" />
                    {br.address}
                  </p>
                )}
                {br.phone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 truncate">
                    <Phone size={12} className="flex-shrink-0" />
                    {br.phone}
                  </p>
                )}
              </div>

              {isSelected && (
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check size={14} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
