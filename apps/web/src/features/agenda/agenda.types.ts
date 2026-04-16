export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'RESCHEDULED'

export interface AppointmentItem {
  id:              string
  serviceId:       string
  serviceName:     string
  durationMinutes: number
  price:           number | string
  order:           number
}

export interface AppointmentProfessional {
  id:          string
  displayName: string
  avatarUrl:   string | null
  color:       string | null
}

export interface LoyaltyCardSummary {
  id:               string
  stampsCount:      number
  rewardsAvailable: number
}

export interface AppointmentClient {
  id:          string
  firstName:   string
  lastName:    string
  email:       string
  loyaltyCard: LoyaltyCardSummary | null
}

export interface Appointment {
  id:             string
  tenantId:       string
  clientId:       string | null
  professionalId: string
  status:         AppointmentStatus
  startAt:        string    // ISO UTC
  endAt:          string    // ISO UTC
  totalMinutes:   number
  totalPrice:     number | string
  currency:       string
  notes:          string | null
  internalNotes:  string | null
  // Guest fields
  guestName:      string | null
  guestEmail:     string | null
  guestPhone:     string | null
  confirmedAt:    string | null
  completedAt:    string | null
  cancelledAt:    string | null
  cancelledBy:    string | null
  cancellationReason: string | null
  createdAt:      string
  updatedAt:      string
  // Relations
  items:          AppointmentItem[]
  professional:   AppointmentProfessional
  client:         AppointmentClient | null
}

/** Which status transitions are allowed from a given status */
export const ALLOWED_ACTIONS: Record<AppointmentStatus, AppointmentAction[]> = {
  PENDING:     ['confirm', 'cancel', 'no_show'],
  CONFIRMED:   ['complete', 'cancel', 'no_show'],
  CANCELLED:   [],
  COMPLETED:   [],
  NO_SHOW:     [],
  RESCHEDULED: ['confirm', 'cancel'],
}

export type AppointmentAction = 'confirm' | 'cancel' | 'complete' | 'no_show'

export type AgendaView = 'day' | 'week' | 'month'
