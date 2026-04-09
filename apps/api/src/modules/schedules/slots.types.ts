// Internal time interval (minutes from midnight local time)
export interface TimeInterval {
  startMinutes: number
  endMinutes:   number
}

export interface ServiceSnapshot {
  id:              string
  name:            string
  durationMinutes: number
  bufferBefore:    number
  bufferAfter:     number
  price:           number
}

export interface AvailableSlot {
  startAt:         string  // ISO 8601 UTC
  endAt:           string  // ISO 8601 UTC
  durationMinutes: number
}

export type UnavailableReason =
  | 'NOT_WORKING'      // professional has no schedule for this day at this branch
  | 'EXCEPTION_BLOCK'  // full-day exception (vacation, holiday, manual block)
  | 'FULLY_BLOCKED'    // schedule exists but all slots are taken

export interface UnavailableSlot {
  startAt:         string  // ISO 8601 UTC
  endAt:           string  // ISO 8601 UTC
  durationMinutes: number
}

export interface SlotsResponse {
  date:               string           // YYYY-MM-DD (local to tenant timezone)
  professionalId:     string
  /** Branch (sucursal) the slots were computed for. Always set in phase 2. */
  branchId:           string
  timezone:           string
  totalDurationMinutes: number
  slotIntervalMinutes:  number
  services:           ServiceSnapshot[]
  slots:              AvailableSlot[]
  unavailableSlots:   UnavailableSlot[]
  unavailableReason?: UnavailableReason
}

export interface DayAvailability {
  date:      string   // YYYY-MM-DD
  available: boolean
  reason?:   'NO_SCHEDULE' | 'VACATION' | 'HOLIDAY' | 'MANUAL_BLOCK'
}

export interface AvailableDaysResponse {
  month:          string
  professionalId: string
  branchId:       string
  days:           DayAvailability[]
}
