import type { Tenant, Branch, Service, Professional, SlotsResponse, AvailableDaysResponse, CreatedAppointment } from '@/features/booking/booking.types'
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
      hasMultipleBranches: boolean
      /** Phase 1 (work-orders): at least one service is multi-pro or multi-day. */
      hasComplexServices:  boolean
    }
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Work Orders (Phase 1) — typed response shapes
// ─────────────────────────────────────────────────────────────────────────────

export type DurationUnit     = 'MINUTES' | 'HOURS' | 'WORKDAYS'
export type WorkOrderStatus  = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type WorkSlotStatus   = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export interface WorkOrderAssignment {
  id:             string
  workSlotId:     string
  professionalId: string
  assignedAt:     string
  professional: {
    id:          string
    displayName: string
    color:       string | null
    avatarUrl?:  string | null
  }
}

export interface WorkOrderSlot {
  id:         string
  workOrderId: string
  date:       string        // ISO — day anchor at midnight UTC
  startTime:  string        // "HH:MM"
  endTime:    string        // "HH:MM"
  startAt:    string        // ISO UTC
  endAt:      string        // ISO UTC
  status:     WorkSlotStatus
  assignments: WorkOrderAssignment[]
}

export interface WorkOrderService {
  id:    string
  name:  string
  color: string | null
  // Only populated on the detail response:
  minProfessionals?: number
  maxProfessionals?: number
  durationMinutes?:  number
  price?:            number | string
  currency?:         string
}

export interface WorkOrderClient {
  id:        string
  firstName: string
  lastName:  string
  email?:    string | null
  phone?:    string | null
}

export interface WorkOrder {
  id:               string
  tenantId:         string
  branchId:         string
  serviceId:        string
  clientId:         string | null
  status:           WorkOrderStatus
  scheduledStartAt: string   // ISO UTC
  scheduledEndAt:   string   // ISO UTC
  totalPrice:       number | string
  estimatedMinutes: number
  notes:            string | null
  confirmedAt:      string | null
  completedAt:      string | null
  cancelledAt:      string | null
  createdAt:        string
  updatedAt:        string
  service:          WorkOrderService
  client:           WorkOrderClient | null
  branch:           { id: string; name: string }
  workSlots:        WorkOrderSlot[]
}

/** Lightweight professional row returned by available-professionals endpoint. */
export interface SlotAvailablePro {
  id:          string
  displayName: string
  color:       string | null
}

/** Admin view of a branch — includes inactive ones and isActive flag. */
export interface AdminBranch {
  id:        string
  tenantId:  string
  name:      string
  slug:      string
  address:   string | null
  phone:     string | null
  timezone:  string | null
  isDefault: boolean
  isActive:  boolean
  order:     number
  createdAt: string
  updatedAt: string
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

  /**
   * Patches the current tenant's schedule rules. Today only `slotDurationMinutes`
   * is exposed by the backend DTO. Authenticated — JWT scopes the update to
   * the caller's tenant.
   */
  updateMyScheduleRules = (data: { slotDurationMinutes?: number }) =>
    this.request<{ slotDurationMinutes: number }>('/tenants/me/schedule-rules', {
      method: 'PATCH',
      body:   JSON.stringify(data),
    })

  // ── Branches ──────────────────────────────────────────────────────────────

  /**
   * Public — returns active branches for the current tenant. Used by both
   * the public booking flow (to render the branch picker step) and the
   * dashboard (as a lighter-weight read than the admin endpoint).
   */
  getBranches = (tenantId: string) =>
    this.request<Branch[]>('/branches', {
      headers: { 'X-Tenant-ID': tenantId },
    })

  /** Admin — returns all branches including inactive ones. */
  getAllBranches = (tenantId: string) =>
    this.request<AdminBranch[]>('/branches/admin/all', {
      headers: { 'X-Tenant-ID': tenantId },
    })

  createBranch = (tenantId: string, data: object) =>
    this.request<AdminBranch>('/branches', {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  updateBranch = (tenantId: string, id: string, data: object) =>
    this.request<AdminBranch>(`/branches/${id}`, {
      method:  'PATCH',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  /** Soft-delete: backend marks isActive=false; default branch can't be removed. */
  deleteBranch = (tenantId: string, id: string) =>
    this.request<AdminBranch>(`/branches/${id}`, {
      method:  'DELETE',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Services (public — no auth required) ─────────────────────────────────

  /**
   * Returns all active public services for the tenant.
   * Sends X-Tenant-ID header (tenantId resolved by getTenantBySlug first).
   *
   * `excludeComplex`: when true, services that can only be fulfilled via a
   * WorkOrder (minProfessionals > 1 or allowsMultiDay) are hidden. Used by
   * the guest booking catalog — admin contexts omit this to see every service.
   */
  getServices = (tenantId: string, options: { excludeComplex?: boolean } = {}) => {
    const query = options.excludeComplex ? '?excludeComplex=true' : ''
    return this.request<Service[]>(`/services${query}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
  }

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
   * @param branchId     Optional sucursal id. When omitted the backend falls
   *                     back to the tenant's only active branch (single-branch
   *                     tenants get this for free).
   */
  getSlots = (
    tenantId:    string,
    proId:       string,
    date:        string,
    serviceIds:  string[],
    branchId?:   string | null,
  ) => {
    const params = new URLSearchParams({ date, serviceIds: serviceIds.join(',') })
    if (branchId) params.set('branchId', branchId)
    return this.request<SlotsResponse>(
      `/schedules/${proId}/slots?${params.toString()}`,
      { headers: { 'X-Tenant-ID': tenantId } },
    )
  }

  getAvailableDays = (
    tenantId:    string,
    proId:       string,
    month:       string,
    branchId?:   string | null,
  ) => {
    const params = new URLSearchParams({ month })
    if (branchId) params.set('branchId', branchId)
    return this.request<AvailableDaysResponse>(
      `/schedules/${proId}/available-days?${params.toString()}`,
      { headers: { 'X-Tenant-ID': tenantId } },
    )
  }

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

  /**
   * Soft-deletes a professional. Backend returns 409 if there are PENDING/
   * CONFIRMED future appointments — surface that exact message to the user
   * so they know how to unblock it.
   */
  deleteProfessional = (tenantId: string, professionalId: string) =>
    this.request<{ id: string; deleted: boolean; alreadyInactive?: boolean }>(
      `/professionals/${professionalId}`,
      { method: 'DELETE', headers: { 'X-Tenant-ID': tenantId } },
    )

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

  // ── Work Orders (Phase 1 — admin-only) ───────────────────────────────────

  /**
   * List work orders for the tenant. All filters are optional.
   * `from` / `to` are YYYY-MM-DD strings and filter by `scheduledStartAt`.
   */
  getWorkOrders = (
    tenantId: string,
    filters?: { status?: WorkOrderStatus; branchId?: string; from?: string; to?: string },
  ) => {
    const params = new URLSearchParams()
    if (filters?.status)   params.set('status',   filters.status)
    if (filters?.branchId) params.set('branchId', filters.branchId)
    if (filters?.from)     params.set('from',     filters.from)
    if (filters?.to)       params.set('to',       filters.to)
    const q = params.toString()
    return this.request<WorkOrder[]>(`/work-orders${q ? '?' + q : ''}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
  }

  getWorkOrder = (tenantId: string, id: string) =>
    this.request<WorkOrder>(`/work-orders/${id}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })

  createWorkOrder = (tenantId: string, data: {
    serviceId:   string
    branchId?:   string
    clientId?:   string
    startDate:   string   // ISO — typically `${yyyy-mm-dd}T00:00:00.000Z`
    totalPrice?: number
    notes?:      string
  }) =>
    this.request<WorkOrder>('/work-orders', {
      method:  'POST',
      body:    JSON.stringify(data),
      headers: { 'X-Tenant-ID': tenantId },
    })

  updateWorkOrderStatus = (tenantId: string, id: string, status: WorkOrderStatus) =>
    this.request<WorkOrder>(`/work-orders/${id}/status`, {
      method:  'PATCH',
      body:    JSON.stringify({ status }),
      headers: { 'X-Tenant-ID': tenantId },
    })

  getSlotAvailableProfessionals = (tenantId: string, workOrderId: string, slotId: string) =>
    this.request<SlotAvailablePro[]>(
      `/work-orders/${workOrderId}/slots/${slotId}/available-professionals`,
      { headers: { 'X-Tenant-ID': tenantId } },
    )

  assignProfessionalToSlot = (
    tenantId: string,
    workOrderId: string,
    slotId: string,
    professionalId: string,
  ) =>
    this.request<WorkOrderAssignment>(`/work-orders/${workOrderId}/slots/${slotId}/assign`, {
      method:  'POST',
      body:    JSON.stringify({ professionalId }),
      headers: { 'X-Tenant-ID': tenantId },
    })

  unassignProfessionalFromSlot = (
    tenantId: string,
    workOrderId: string,
    slotId: string,
    professionalId: string,
  ) =>
    this.request<{ success: boolean }>(
      `/work-orders/${workOrderId}/slots/${slotId}/assign/${professionalId}`,
      {
        method:  'DELETE',
        headers: { 'X-Tenant-ID': tenantId },
      },
    )

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
