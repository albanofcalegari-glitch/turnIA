'use client'

import { List, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'list' | 'grid'

interface Props {
  value:    ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

/**
 * Toggle compacto entre vista lista (filas densas) y vista mosaico (cards en
 * grid). Mantiene consistencia visual con el toggle día/semana de la agenda.
 */
export function ViewToggle({ value, onChange, className }: Props) {
  return (
    <div className={cn('flex rounded-lg border bg-white p-0.5', className)}>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        title="Vista lista"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
          value === 'list'
            ? 'bg-brand-600 text-white'
            : 'text-gray-600 hover:text-gray-900',
        )}
      >
        <List size={13} />
        Lista
      </button>
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        title="Vista mosaico"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
          value === 'grid'
            ? 'bg-brand-600 text-white'
            : 'text-gray-600 hover:text-gray-900',
        )}
      >
        <LayoutGrid size={13} />
        Mosaico
      </button>
    </div>
  )
}
