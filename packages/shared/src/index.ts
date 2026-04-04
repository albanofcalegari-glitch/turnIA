// ── Enums ────────────────────────────────────────────────────────────────────

export enum TenantRole {
  ADMIN        = 'ADMIN',
  PROFESSIONAL = 'PROFESSIONAL',
  CLIENT       = 'CLIENT',
}

export enum AppointmentStatus {
  PENDING     = 'PENDING',
  CONFIRMED   = 'CONFIRMED',
  CANCELLED   = 'CANCELLED',
  COMPLETED   = 'COMPLETED',
  NO_SHOW     = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

export enum ExceptionType {
  BLOCK        = 'BLOCK',
  VACATION     = 'VACATION',
  HOLIDAY      = 'HOLIDAY',
  CUSTOM_HOURS = 'CUSTOM_HOURS',
}

// ── Common types ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:  T[]
  total: number
  page:  number
  limit: number
}

export interface ApiResponse<T = void> {
  success: boolean
  data?:   T
  message?: string
  errors?:  string[]
}

export interface JwtPayload {
  sub:     string        // userId
  email:   string
  tenantId?: string
  role?:   TenantRole
  isSuperAdmin: boolean
}

// ── Time slots ────────────────────────────────────────────────────────────────

export interface TimeSlot {
  startAt:   string  // ISO datetime
  endAt:     string
  available: boolean
}

export interface AvailabilityRequest {
  professionalId: string
  serviceIds:     string[]
  date:           string  // YYYY-MM-DD
}
