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

// ── Plans ────────────────────────────────────────────────────────────────────

export type PlanTier = 'trial' | 'standard' | 'pro' | 'business'

export interface PlanConfig {
  tier:             PlanTier
  label:            string
  amount:           number
  currency:         string
  maxProfessionals: number | null // null = unlimited
  reason:           string        // shown in MP checkout
}

export const PLANS: Record<Exclude<PlanTier, 'trial'>, PlanConfig> = {
  standard: {
    tier:             'standard',
    label:            'Estándar',
    amount:           60_000,
    currency:         'ARS',
    maxProfessionals: 1,
    reason:           'Suscripción TurnIT Estándar',
  },
  pro: {
    tier:             'pro',
    label:            'Pro',
    amount:           75_000,
    currency:         'ARS',
    maxProfessionals: null,
    reason:           'Suscripción TurnIT Pro',
  },
  business: {
    tier:             'business',
    label:            'Business',
    amount:           100_000,
    currency:         'ARS',
    maxProfessionals: null,
    reason:           'Suscripción TurnIT Business',
  },
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
