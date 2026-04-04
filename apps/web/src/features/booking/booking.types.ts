// ─────────────────────────────────────────────────────────────────────────────
// Domain types — mirrors backend response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface Tenant {
  id:       string
  slug:     string
  name:     string
  type:     string
  timezone: string
  logoUrl:  string | null
  phone:    string | null
  address:  string | null
}

export interface ServiceCategory {
  id:   string
  name: string
}

export interface Service {
  id:              string
  name:            string
  description:     string | null
  durationMinutes: number
  price:           number | string   // Prisma Decimal serializes as string
  currency:        string
  color:           string | null
  categoryId:      string | null
  isPublic:        boolean
}

export interface ProfessionalService {
  serviceId:        string
  overridePrice:    number | string | null
  overrideDuration: number | null
  service:          Service
}

export interface Professional {
  id:                   string
  displayName:          string
  avatarUrl:            string | null
  bio:                  string | null
  color:                string | null
  acceptsOnlineBooking: boolean
  services:             ProfessionalService[]
}

export interface AvailableSlot {
  startAt:         string   // ISO UTC
  endAt:           string   // ISO UTC
  durationMinutes: number
}

export interface SlotsResponse {
  date:                string
  professionalId:      string
  timezone:            string
  totalDurationMinutes: number
  slotIntervalMinutes: number
  slots:               AvailableSlot[]
  unavailableReason?:  'NOT_WORKING' | 'EXCEPTION_BLOCK' | 'FULLY_BLOCKED'
}

export interface CreatedAppointment {
  id:           string
  startAt:      string
  endAt:        string
  status:       string
  totalMinutes: number
  totalPrice:   number | string
  currency:     string
  professional: { id: string; displayName: string; avatarUrl: string | null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking flow state
// ─────────────────────────────────────────────────────────────────────────────

export type BookingStep =
  | 'services'
  | 'professional'
  | 'date'
  | 'slots'
  | 'details'
  | 'success'

export interface GuestInfo {
  name:  string
  email: string
  phone: string
  notes: string
}

export interface BookingState {
  step:                 BookingStep
  selectedServices:     Service[]
  selectedProfessional: Professional | null
  selectedDate:         string          // YYYY-MM-DD
  selectedSlot:         AvailableSlot | null
  guestInfo:            GuestInfo
  conflictError:        boolean         // true after a 409 response
  submitError:          string | null   // non-409 submit errors
}

export const INITIAL_BOOKING_STATE: BookingState = {
  step:                 'services',
  selectedServices:     [],
  selectedProfessional: null,
  selectedDate:         '',
  selectedSlot:         null,
  guestInfo:            { name: '', email: '', phone: '', notes: '' },
  conflictError:        false,
  submitError:          null,
}
