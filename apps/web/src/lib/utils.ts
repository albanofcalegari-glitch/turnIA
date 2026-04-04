import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date / time helpers ────────────────────────────────────────────────────

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function formatMonthYear(year: number, month: number): string {
  return `${MONTHS_ES[month]} ${year}`
}

export function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const weekday = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long' })
  return `${capitalize(weekday)}, ${d} de ${MONTHS_ES[m - 1]} de ${y}`
}

/** Format an ISO UTC timestamp as local time in the given timezone. */
export function formatTime(isoString: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: timezone,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).format(new Date(isoString))
}

/** YYYY-MM-DD for a given JS Date. */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
