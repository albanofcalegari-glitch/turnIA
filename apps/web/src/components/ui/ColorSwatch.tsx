'use client'

import { cn } from '@/lib/utils'

/**
 * Paleta fija de colores probada (contraste legible sobre blanco + texto
 * oscuro). La comparte Servicios y Profesionales para mantener coherencia
 * visual en la agenda.
 */
export const PRESET_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6b7280', // gray-500
]

export function ColorSwatch({
  value,
  onChange,
  className,
}: {
  value?:     string | null
  onChange:   (color: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {PRESET_COLORS.map((c) => {
        const selected = (value ?? '').toLowerCase() === c
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            className={cn(
              'h-7 w-7 rounded-full border-2 transition-transform',
              selected ? 'border-gray-900 scale-110' : 'border-white shadow-sm hover:scale-105',
            )}
            style={{ backgroundColor: c }}
          />
        )
      })}
    </div>
  )
}
