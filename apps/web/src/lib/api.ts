import type { Tenant, Branch, Service, Professional, SlotsResponse, AvailableDaysResponse, CreatedAppointment } from '@/features/booking/booking.types'
import type { Appointment } from '@/features/agenda/agenda.types'

// Profile response from GET /auth/me
export interface UserProfile {
  id:              string
  email:           string
  firstName:       string
  lastName:        string
  isSuperAdmin:    boolean
  emailVerifiedAt: string | null
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
      plan:                string
      membershipExpiresAt: string | null
      hasMultipleBranches: boolean
    }
  }>
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
    // Nest serializes a handler that returns null as an empty body with no
    // content-type — .json() then fails with "Unexpected end of JSON input".
    // Treat empty 2xx responses as null.
    const text = await res.text()
    if (!text) return null as T
    return JSON.parse(text) as T
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

  forgotPassword = (email: string) =>
    this.request<{ ok: true }>('/auth/forgot-password', {
      method: 'POST',
      body:   JSON.stringify({ email }),
    })

  resetPassword = (token: string, password: string) =>
    this.request<{ ok: true }>('/auth/reset-password', {
      method: 'POST',
      body:   JSON.stringify({ token, password }),
    })

  verifyEmail = (token: string) =>
    this.request<{ ok: true }>('/auth/verify-email', {
      method: 'POST',
      body:   JSON.stringify({ token }),
    })

  resendVerification = () =>
    this.request<{ ok: true }>('/auth/resend-verification', { method: 'POST' })

  getMonthlyReports = (tenantId: string, months = 6) =>
    this.request<Array<{ month: string; appointments: number; services: number; uniqueClients: number }>>(
      `/reports/monthly?months=${months}`,
      { headers: { 'X-Tenant-ID': tenantId } },
    )

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

  reopenAppointment = (tenantId: string, id: string) =>
    this.request<Appointment>(`/appointments/${id}/reopen`, {
      method:  'PATCH',
      headers: { 'X-Tenant-ID': tenantId },
    })

  // ── Appointment attachments ────────────────────────────────────────────

  listAttachments = (tenantId: string, appointmentId: string) =>
    this.request<Attachment[]>(`/appointments/${appointmentId}/attachments`, {
      headers: { 'X-Tenant-ID': tenantId },
    })

  /**
   * Uploads a file as an appointment attachment. Uses FormData so the
   * browser sets the multipart Content-Type + boundary header itself —
   * don't hand-set Content-Type here, it will break the multipart parse.
   */
  uploadAttachment = async (tenantId: string, appointmentId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/appointments/${appointmentId}/attachments`, {
      method:  'POST',
      body:    form,
      headers: {
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        'X-Tenant-ID': tenantId,
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const raw  = body.message
      const msg  = typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0]) : 'Error al subir el archivo'
      throw new ApiError(res.status, msg)
    }
    return res.json() as Promise<Attachment>
  }

  deleteAttachment = (tenantId: string, appointmentId: string, attachmentId: string) =>
    this.request<{ ok: true }>(`/appointments/${appointmentId}/attachments/${attachmentId}`, {
      method:  'DELETE',
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

  // ── Subscriptions (Mercado Pago) ────────────────────────────────────────

  /**
   * Start the subscription flow. Returns an `initPoint` URL the caller
   * should redirect to so the admin can authorise the card on MP. The
   * tenant's membership is only extended once MP confirms the first
   * payment via webhook.
   */
  subscribe = (tier: 'standard' | 'pro' = 'standard') =>
    this.request<{ initPoint: string; subscriptionId: string; reused: boolean }>('/subscriptions/me', {
      method: 'POST',
      body:   JSON.stringify({ tier }),
    })

  getMySubscription = () =>
    this.request<MySubscription | null>('/subscriptions/me')

  getPlanRequirement = () =>
    this.request<{ profCount: number; requiredTier: 'standard' | 'pro' }>('/subscriptions/me/plan-requirement')

  cancelSubscription = () =>
    this.request<MySubscription>('/subscriptions/me/cancel', { method: 'POST' })

  adminGetPayments = (filters: { tenantId?: string; status?: string; from?: string; to?: string } = {}) => {
    const params = new URLSearchParams()
    if (filters.tenantId) params.set('tenantId', filters.tenantId)
    if (filters.status)   params.set('status',   filters.status)
    if (filters.from)     params.set('from',     filters.from)
    if (filters.to)       params.set('to',       filters.to)
    const q = params.toString()
    return this.request<AdminPayment[]>(`/subscriptions/admin/payments${q ? '?' + q : ''}`)
  }

  adminGetPaymentMetrics = () =>
    this.request<PaymentMetrics>('/subscriptions/admin/metrics')

  // ── Loyalty ─────────────────────────────────────────────────────────────

  getLoyaltyProgram = () =>
    this.request<LoyaltyProgram>('/loyalty/program')

  updateLoyaltyProgram = (dto: Partial<LoyaltyProgramInput>) =>
    this.request<LoyaltyProgram>('/loyalty/program', {
      method: 'PUT',
      body:   JSON.stringify(dto),
    })

  listLoyaltyCards = () =>
    this.request<LoyaltyCardWithClient[]>('/loyalty/cards')

  redeemLoyaltyReward = (cardId: string, rewardId: string, appointmentId?: string) =>
    this.request<{ redemption: LoyaltyRedemption; card: LoyaltyCard }>(
      `/loyalty/cards/${cardId}/redeem`,
      { method: 'POST', body: JSON.stringify({ rewardId, appointmentId }) },
    )

  getMyLoyaltyCard = () =>
    this.request<MyLoyaltyCardResponse>('/loyalty/me')

  getBookingLoyaltyProgram = (tenantId: string) =>
    this.request<BookingLoyaltyProgram | null>(`/loyalty/booking-program/${tenantId}`)

  getBookingLoyaltyCard = (tenantId: string, email: string) =>
    this.request<BookingLoyaltyCard | null>(
      `/loyalty/booking-card/${tenantId}?email=${encodeURIComponent(email)}`,
    )
}

// ── Loyalty types ───────────────────────────────────────────────────────────

export type LoyaltyRewardType = 'FREE_SERVICE' | 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT'
export type LoyaltyRewardMode = 'CUMULATIVE' | 'INDEPENDENT'

export interface LoyaltyRewardItem {
  id:             string
  programId:      string
  position:       number
  stampsRequired: number
  rewardType:     LoyaltyRewardType
  rewardValue:    string | number | null
  rewardLabel:    string
}

export interface LoyaltyProgram {
  id:              string
  tenantId:        string
  isActive:        boolean
  showOnBooking:   boolean
  rewardMode:      LoyaltyRewardMode
  stampsRequired:  number
  rewardType:      LoyaltyRewardType
  rewardValue:     string | number | null
  rewardLabel:     string
  eligibleServiceIds: string[] | null
  cardTitle:       string
  cardSubtitle:    string | null
  cardColor:       string
  cardAccentColor: string | null
  cardBgImageUrl:  string | null
  rewards:         LoyaltyRewardItem[]
  createdAt:       string
  updatedAt:       string
}

export interface BookingLoyaltyProgram {
  cardTitle:       string
  cardSubtitle:    string | null
  cardColor:       string
  cardAccentColor: string | null
  cardBgImageUrl:  string | null
  stampsRequired:  number
  rewardType:      LoyaltyRewardType
  rewardLabel:     string
  rewardMode:      LoyaltyRewardMode
  rewards:         Omit<LoyaltyRewardItem, 'programId'>[]
}

export interface BookingLoyaltyCard {
  stampsCount:      number
  rewardsAvailable: number
  clientName:       string
}

export interface RewardItemInput {
  position:       number
  stampsRequired: number
  rewardType:     LoyaltyRewardType
  rewardValue?:   number | null
  rewardLabel:    string
}

export interface LoyaltyProgramInput {
  isActive:        boolean
  showOnBooking?:  boolean
  rewardMode?:     LoyaltyRewardMode
  rewards?:        RewardItemInput[]
  eligibleServiceIds?: string[] | null
  cardTitle:       string
  cardSubtitle:    string | null
  cardColor:       string
  cardAccentColor: string | null
  cardBgImageUrl:  string | null
}

export interface LoyaltyCard {
  id:                 string
  tenantId:           string
  programId:          string
  clientId:           string
  stampsCount:        number
  totalStampsEarned:  number
  rewardsAvailable:   number
  rewardsRedeemed:    number
  availableRewardIds: string[]
  lastStampAt:        string | null
  createdAt:          string
  updatedAt:          string
}

export interface LoyaltyCardWithClient extends LoyaltyCard {
  client: {
    id:        string
    firstName: string
    lastName:  string
    email:     string | null
    phone:     string | null
  }
}

export interface LoyaltyRedemption {
  id:            string
  cardId:        string
  appointmentId: string | null
  rewardType:    LoyaltyRewardType
  rewardValue:   string | number | null
  rewardLabel:   string
  redeemedAt:    string
}

export interface MyLoyaltyCardResponse {
  program: LoyaltyProgram
  card:    LoyaltyCard
  client:  { id: string; firstName: string; lastName: string }
}

export interface MySubscription {
  id:              string
  status:          string
  amount:          string | number
  currency:        string
  frequency:       number
  frequencyType:   string
  payerEmail:      string
  initPoint:       string | null
  nextPaymentDate: string | null
  cancelledAt:     string | null
  createdAt:       string
  payments: Array<{
    id:            string
    mpPaymentId:   string
    status:        string
    amount:        string | number
    currency:      string
    paymentMethod: string | null
    paidAt:        string | null
    createdAt:     string
  }>
}

export interface AdminPayment {
  id:            string
  tenantId:      string
  mpPaymentId:   string
  status:        string
  statusDetail:  string | null
  amount:        string | number
  currency:      string
  paymentMethod: string | null
  paymentType:   string | null
  paidAt:        string | null
  createdAt:     string
  tenant: { id: string; name: string; slug: string }
}

export interface PaymentMetrics {
  mrr:                  number
  activeSubscriptions:  number
  collectedThisMonth:   number
  paymentsThisMonth:    number
  failedLast30d:        number
}

export interface Attachment {
  id:            string
  appointmentId: string
  url:           string
  filename:      string
  mimeType:      string
  sizeBytes:     number
  uploadedById:  string | null
  createdAt:     string
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
