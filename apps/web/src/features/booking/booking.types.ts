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
  /** When false, the tenant exists but its membership is suspended — bookings are blocked. */
  isActive: boolean
  /**
   * Stage 1 (branches): UI hint. When true the booking flow shows a branch
   * picker step (only if there's actually >1 active branch). When false the
   * booking flow stays single-sucursal and never mentions branches at all.
   */
  hasMultipleBranches: boolean
}

/**
 * Public branch info exposed by `GET /branches`. Mirrors the select in
 * BranchesService.findActiveByTenant.
 */
export interface Branch {
  id:        string
  name:      string
  slug:      string
  address:   string | null
  phone:     string | null
  timezone:  string | null
  isDefault: boolean
  order:     number
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
  | 'branch'
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

/** A completed booking for one service (used when booking multiple services). */
export interface ServiceBooking {
  service:      Service
  professional: Professional
  date:         string          // YYYY-MM-DD
  slot:         AvailableSlot
}

export interface BookingState {
  step:                 BookingStep
  /** Stage 1 (branches): null until the user picks a branch (or the hook
   *  auto-picks the only active one for single-branch tenants). */
  selectedBranch:       Branch | null
  selectedServices:     Service[]
  selectedProfessional: Professional | null
  selectedDate:         string          // YYYY-MM-DD
  selectedSlot:         AvailableSlot | null
  guestInfo:            GuestInfo
  conflictError:        boolean         // true after a 409 response
  submitError:          string | null   // non-409 submit errors
  // Multi-service iteration
  currentServiceIndex:  number          // which service we're currently booking
  serviceBookings:      ServiceBooking[] // completed bookings per service
}

export const INITIAL_BOOKING_STATE: BookingState = {
  step:                 'services',
  selectedBranch:       null,
  selectedServices:     [],
  selectedProfessional: null,
  selectedDate:         '',
  selectedSlot:         null,
  guestInfo:            { name: '', email: '', phone: '', notes: '' },
  conflictError:        false,
  submitError:          null,
  currentServiceIndex:  0,
  serviceBookings:      [],
}
