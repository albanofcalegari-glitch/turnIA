import type { Tenant, Service, Professional, SlotsResponse, CreatedAppointment } from '@/features/booking/booking.types'
import type { Appointment } from '@/features/agenda/agenda.types'

// Profile response from GET /auth/me
export interface UserProfile {
  id:           string
  email:        string
  firstName:    string
  lastName:     string
  isSuperAdmin: boolean
  tenants: Array<{
    tenantId: string
    role:     string
    tenant:   {
      id:                  string
      slug:                string
      name:                string
      type:                string
      timezone:            string
      isActive:            boolean
      membershipExpiresAt: string | null
    }
  }>
}

export interface GuestAppointment {
  id:           string
  startAt:      string
  endAt:        string
  status:       string
  totalMinutes: number
  totalPrice:   number | string
  currency:     string
  guestName:    string | null
  guestEmail:   string | null
  professional: { id: string; displayName: string }
  items:        Array<{ serviceName: string; durationMinutes: number; price: number | string }>
}

export interface WorkScheduleItem {
  id:             string
  professionalId: string
  dayOfWeek:      number
  startTime:      string
  endTime:        string
  isActive:       boolean
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─────────────────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed API error — carries the HTTP status code so callers can distinguish
 * 409 Conflict (slot taken) from 400 Bad Request or 5xx errors.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────────────────

class ApiClient {
  private token: string | null = null

  setToken(token: string)  { this.token = token }
  clearToken()             { this.token = null  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const raw = body.message
      let message: string
      if (typeof raw === 'string') {
        message = raw
      } else if (Array.isArray(raw)) {
        message = String(raw[0])
      } else {
        message = 'Error en la solicitud'
      }
      throw new ApiError(res.status, message)
    }

    // 204 No Content
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  login = (email: string, password: string) =>
    this.request<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    })

  register = (data: object) =>
    this.request<{ accessToken: string }>('/auth/register', {
      method: 'POST',
      body:   JSON.stringify(data),
    })

  // ── Tenants ───────────────────────────────────────────────────────────────

  registerTenant = (data: object) =>
    this.request('/tenants/register', { method: 'POST', body: JSON.stringify(data) })

  /**
   * Fetches public tenant info by slug.
   * Used by the booking flow to resolve the slug → tenantId mapping.
   */
  getTenantBySlug = (slug: string) =>
    this.request<Tenant>(`/tenants/${slug}/public`)

  // ── Services (public — no auth required) ─────────────────────────────────

  /**
   * Returns all active public services for the tenant.
   * Sends X-Tenant-ID header (tenantId resolved by getTenantBySlug first).
   */
  getServices = (tenantId: string) =>
    this.request<Service[]>('/services', {
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Professionals (public — no auth required) ─────────────────────────────

  /**
   * Returns all active professionals for the tenant who accept online booking.
   * Includes their offered services for client-side filtering.
   */
  getProfessionals = (tenantId: string) =>
    this.request<Professional[]>('/professionals', {
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Schedules ─────────────────────────────────────────────────────────────

  /**
   * Returns available booking slots for a professional on a given date.
   * Public endpoint — no auth required.
   *
   * @param tenantId     Resolved tenant ID
   * @param proId        Professional ID
   * @param date         YYYY-MM-DD in tenant's local timezone
   * @param serviceIds   Ordered list of service IDs to book in sequence
   */
  getSlots = (tenantId: string, proId: string, date: string, serviceIds: string[]) =>
    this.request<SlotsResponse>(
      `/schedules/${proId}/slots?date=${date}&serviceIds=${serviceIds.join(',')}`,
      { headers: { 'X-Tenant-ID': tenantId } },
    )

  // ── Work Schedules (admin) ─────────────────────────────────────────────

  getWorkSchedule = (tenantId: string, professionalId: string) =>
    this.request<WorkScheduleItem[]>(`/schedules/${professionalId}/work-schedule`, {
      headers: { 'X-Tenant-ID': tenantId },
    })

  createWorkSchedule = (tenantId: string, professionalId: string, data: object) =>
    this.request<WorkScheduleItem>(`/schedules/${professionalId}/work-schedule`, {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  updateWorkSchedule = (tenantId: string, professionalId: string, id: string, data: object) =>
    this.request<WorkScheduleItem>(`/schedules/${professionalId}/work-schedule/${id}`, {
      method:  'PATCH',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  deleteWorkSchedule = (tenantId: string, professionalId: string, id: string) =>
    this.request(`/schedules/${professionalId}/work-schedule/${id}`, {
      method:  'DELETE',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Guest appointments (public) ────────────────────────────────────────

  getGuestAppointments = (tenantId: string, email: string) =>
    this.request<GuestAppointment[]>(`/appointments/guest?email=${encodeURIComponent(email)}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })

  guestCancelAppointment = (tenantId: string, id: string, email: string, reason?: string) =>
    this.request(`/appointments/${id}/guest-cancel`, {
      method:  'PATCH',
      body:    JSON.stringify({ email, reason }),
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Appointments ──────────────────────────────────────────────────────────

  /**
   * Creates a new appointment.
   *
   * Throws ApiError(409) when the slot was taken by a concurrent booking.
   * The caller must catch this and redirect the user to pick a new slot.
   */
  createAppointment = (tenantId: string, data: object) =>
    this.request<CreatedAppointment>('/appointments', {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  getAppointments = (tenantId: string, filters?: { date?: string; from?: string; to?: string; professionalId?: string }) => {
    const params = new URLSearchParams()
    if (filters?.date)           params.set('date', filters.date)
    if (filters?.from)           params.set('from', filters.from)
    if (filters?.to)             params.set('to',   filters.to)
    if (filters?.professionalId) params.set('professionalId', filters.professionalId)
    const q = params.toString()
    return this.request<Appointment[]>(`/appointments${q ? '?' + q : ''}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
  }

  // ── Services (admin — auth required) ────────────────────────────────────

  createService = (tenantId: string, data: object) =>
    this.request<Service>('/services', {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  updateService = (tenantId: string, id: string, data: object) =>
    this.request<Service>(`/services/${id}`, {
      method:  'PUT',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  deleteService = (tenantId: string, id: string) =>
    this.request<Service>(`/services/${id}`, {
      method:  'DELETE',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Professionals (admin — auth required) ──────────────────────────────

  createProfessional = (tenantId: string, data: object) =>
    this.request<Professional>('/professionals', {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  addServiceToProfessional = (tenantId: string, professionalId: string, serviceId: string) =>
    this.request(`/professionals/${professionalId}/services`, {
      method:  'POST',
      body:    JSON.stringify({ serviceId }),
      headers: { 'X-Tenant-ID': tenantId },
    })

  removeServiceFromProfessional = (tenantId: string, professionalId: string, serviceId: string) =>
    this.request(`/professionals/${professionalId}/services/${serviceId}`, {
      method:  'DELETE',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Auth profile ──────────────────────────────────────────────────────────

  getProfile = () => this.request<UserProfile>('/auth/me')

  // ── Appointment status actions ─────────────────────────────────────────────

  confirmAppointment = (tenantId: string, id: string) =>
    this.request<Appointment>(`/appointments/${id}/confirm`, {
      method:  'PATCH',
      headers: { 'X-Tenant-ID': tenantId },
    })

  cancelAppointment = (tenantId: string, id: string, reason?: string) =>
    this.request<Appointment>(`/appointments/${id}/cancel`, {
      method:  'PATCH',
      body:    JSON.stringify({ reason }),
      headers: { 'X-Tenant-ID': tenantId },
    })

  completeAppointment = (tenantId: string, id: string) =>
    this.request<Appointment>(`/appointments/${id}/complete`, {
      method:  'PATCH',
      headers: { 'X-Tenant-ID': tenantId },
    })

  noShowAppointment = (tenantId: string, id: string) =>
    this.request<Appointment>(`/appointments/${id}/no-show`, {
      method:  'PATCH',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── SuperAdmin ──────────────────────────────────────────────────────────

  getAllTenants = () =>
    this.request<AdminTenant[]>('/tenants/admin/all')

  updateTenant = (id: string, data: { isActive?: boolean; plan?: string; membershipExpiresAt?: string | null }) =>
    this.request<AdminTenant>(`/tenants/admin/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })

  deactivateExpiredTenants = () =>
    this.request<{ deactivated: number }>('/tenants/admin/deactivate-expired', {
      method: 'POST',
    })
}

export interface AdminTenant {
  id:                  string
  slug:                string
  name:                string
  type:                string
  plan:                string
  isActive:            boolean
  membershipExpiresAt: string | null
  createdAt:           string
  _count: {
    appointments:  number
    professionals: number
    services:      number
  }
}

export const apiClient = new ApiClient()
