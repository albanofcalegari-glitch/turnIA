import { cn } from '@/lib/utils'
import type { AppointmentStatus } from './agenda.types'

const CONFIG: Record<AppointmentStatus, { label: string; cls: string }> = {
  PENDING:     { label: 'Pendiente',   cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED:   { label: 'Confirmado',  cls: 'bg-brand-100  text-brand-800  border-brand-200'  },
  CANCELLED:   { label: 'Cancelado',   cls: 'bg-red-100    text-red-800    border-red-200'    },
  COMPLETED:   { label: 'Completado',  cls: 'bg-gray-100   text-gray-700   border-gray-200'   },
  NO_SHOW:     { label: 'No vino',     cls: 'bg-orange-100 text-orange-800 border-orange-200' },
  RESCHEDULED: { label: 'Reprog.',     cls: 'bg-purple-100 text-purple-800 border-purple-200' },
}

export function StatusBadge({
  status,
  size = 'sm',
}: {
  status: AppointmentStatus
  size?:  'xs' | 'sm'
}) {
  const { label, cls } = CONFIG[status] ?? CONFIG.PENDING
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
      cls,
    )}>
      {label}
    </span>
  )
}
