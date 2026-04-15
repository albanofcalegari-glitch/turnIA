'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  page:       number         // 1-indexed
  pageCount:  number
  onChange:   (page: number) => void
  className?: string
}

/**
 * Paginación compacta 1-indexed. Si hay ≤ 1 página, no renderiza nada.
 * Muestra máximo 5 números a la vez; los extremos se recortan con "…".
 */
export function Pagination({ page, pageCount, onChange, className }: Props) {
  if (pageCount <= 1) return null

  const pages = buildPageRange(page, pageCount)

  return (
    <div className={cn('mt-4 flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Página anterior"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={14} />
      </button>

      {pages.map((p, idx) =>
        p === '…' ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-gray-400">…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-8 min-w-[2rem] rounded-lg border px-2 text-xs font-medium transition-colors',
              p === page
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Página siguiente"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function buildPageRange(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const range: Array<number | '…'> = [1]
  const start = Math.max(2, current - 1)
  const end   = Math.min(total - 1, current + 1)
  if (start > 2) range.push('…')
  for (let i = start; i <= end; i++) range.push(i)
  if (end < total - 1) range.push('…')
  range.push(total)
  return range
}
