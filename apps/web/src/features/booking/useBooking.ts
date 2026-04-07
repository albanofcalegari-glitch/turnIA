'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, ApiError } from '@/lib/api'
import {
  Tenant,
  Service,
  Professional,
  AvailableSlot,
  SlotsResponse,
  CreatedAppointment,
  BookingState,
  BookingStep,
  GuestInfo,
  ServiceBooking,
  INITIAL_BOOKING_STATE,
} from './booking.types'

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useBooking(tenantSlug: string) {
  // ── Initial data (fetched once on mount) ──────────────────────────────────
  const [tenant,        setTenant]        = useState<Tenant | null>(null)
  const [services,      setServices]      = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [initLoading,   setInitLoading]   = useState(true)
  const [initError,     setInitError]     = useState<string | null>(null)

  // ── Slots (fetched when professional + date + services are selected) ───────
  const [slotsResponse, setSlotsResponse] = useState<SlotsResponse | null>(null)
  const [slotsLoading,  setSlotsLoading]  = useState(false)
  const [slotsError,    setSlotsError]    = useState<string | null>(null)

  // ── Submission ────────────────────────────────────────────────────────────
  const [submitting,          setSubmitting]          = useState(false)
  const [createdAppointments, setCreatedAppointments] = useState<CreatedAppointment[]>([])

  // ── Booking flow state ────────────────────────────────────────────────────
  const [state, setState] = useState<BookingState>(INITIAL_BOOKING_STATE)

  const update = (patch: Partial<BookingState>) =>
    setState(s => ({ ...s, ...patch }))

  // ── Derived: are we in multi-service mode? ────────────────────────────────
  const isMultiService = state.selectedServices.length > 1
  const currentService = isMultiService
    ? state.selectedServices[state.currentServiceIndex] ?? null
    : null

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setInitLoading(true)
      setInitError(null)
      try {
        const t = await apiClient.getTenantBySlug(tenantSlug)
        setTenant(t)
        // If the tenant's membership is suspended, skip loading services and
        // professionals — those endpoints would also reject the request.
        // BookingFlow will show a "temporalmente no disponible" screen.
        if (!t.isActive) return

        const [svcs, pros] = await Promise.all([
          apiClient.getServices(t.id),
          apiClient.getProfessionals(t.id),
        ])
        setServices(svcs.filter(s => s.isPublic))
        setProfessionals(pros.filter(p => p.acceptsOnlineBooking))
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Tenant no existe
        } else {
          setInitError('No se pudo cargar la página de reservas. Por favor intentá de nuevo.')
        }
      } finally {
        setInitLoading(false)
      }
    }
    init()
  }, [tenantSlug])

  // ── Fetch slots ───────────────────────────────────────────────────────────
  const fetchSlots = useCallback(async (
    tenantId:      string,
    proId:         string,
    date:          string,
    svcList:       Service[],
  ) => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSlotsResponse(null)
    try {
      const res = await apiClient.getSlots(
        tenantId,
        proId,
        date,
        svcList.map(s => s.id),
      )
      setSlotsResponse(res)
    } catch {
      setSlotsError('No se pudieron cargar los horarios. Intentá de nuevo.')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Step navigation
  // ─────────────────────────────────────────────────────────────────────────

  const STEP_ORDER: BookingStep[] = [
    'services', 'professional', 'date', 'slots', 'details',
  ]

  function goBack() {
    const idx = STEP_ORDER.indexOf(state.step)

    if (isMultiService && state.step === 'professional' && state.currentServiceIndex > 0) {
      // Go back to previous service's slot selection
      const prevIndex = state.currentServiceIndex - 1
      const prevBooking = state.serviceBookings[prevIndex]
      update({
        currentServiceIndex: prevIndex,
        serviceBookings: state.serviceBookings.slice(0, prevIndex),
        selectedProfessional: prevBooking?.professional ?? null,
        selectedDate: prevBooking?.date ?? '',
        selectedSlot: prevBooking?.slot ?? null,
        step: 'slots',
      })
      return
    }

    if (idx > 0) {
      update({ step: STEP_ORDER[idx - 1] })
    }
  }

  // ── Step 1: Toggle service selection ─────────────────────────────────────
  function toggleService(service: Service) {
    const already = state.selectedServices.some(s => s.id === service.id)
    const next = already
      ? state.selectedServices.filter(s => s.id !== service.id)
      : [...state.selectedServices, service]
    update({ selectedServices: next })
  }

  function confirmServices() {
    if (state.selectedServices.length === 0) return
    update({
      step: 'professional',
      currentServiceIndex: 0,
      serviceBookings: [],
    })
  }

  // ── Step 2: Select professional ───────────────────────────────────────────
  function selectProfessional(p: Professional) {
    update({ selectedProfessional: p, step: 'date' })
  }

  // ── Step 3: Select date ───────────────────────────────────────────────────
  function selectDate(date: string) {
    if (!tenant || !state.selectedProfessional) return

    // In multi-service mode, fetch slots for the current service only
    const svcList = isMultiService && currentService
      ? [currentService]
      : state.selectedServices

    update({ selectedDate: date, selectedSlot: null, step: 'slots' })
    fetchSlots(tenant.id, state.selectedProfessional.id, date, svcList)
  }

  // ── Step 4: Select slot ───────────────────────────────────────────────────
  function selectSlot(slot: AvailableSlot) {
    if (isMultiService && currentService && state.selectedProfessional) {
      // Save this service's booking and advance to next service or details
      const booking: ServiceBooking = {
        service:      currentService,
        professional: state.selectedProfessional,
        date:         state.selectedDate,
        slot,
      }

      const newBookings = [...state.serviceBookings, booking]
      const nextIndex = state.currentServiceIndex + 1

      if (nextIndex < state.selectedServices.length) {
        // More services to book — go back to professional selection
        update({
          serviceBookings: newBookings,
          currentServiceIndex: nextIndex,
          selectedProfessional: null,
          selectedDate: '',
          selectedSlot: null,
          step: 'professional',
          conflictError: false,
        })
      } else {
        // All services booked — go to details
        update({
          serviceBookings: newBookings,
          selectedSlot: slot,
          step: 'details',
          conflictError: false,
        })
      }
    } else {
      // Single service — original flow
      update({ selectedSlot: slot, step: 'details', conflictError: false })
    }
  }

  function refreshSlots() {
    if (!tenant || !state.selectedProfessional || !state.selectedDate) return
    const svcList = isMultiService && currentService
      ? [currentService]
      : state.selectedServices
    fetchSlots(tenant.id, state.selectedProfessional.id, state.selectedDate, svcList)
  }

  // ── Step 5: Update guest info ─────────────────────────────────────────────
  function updateGuestInfo(field: keyof GuestInfo, value: string) {
    update({ guestInfo: { ...state.guestInfo, [field]: value } })
  }

  // ── Step 5: Submit ────────────────────────────────────────────────────────
  async function submit() {
    if (!tenant) return
    setSubmitting(true)
    update({ submitError: null, conflictError: false })

    try {
      const appointments: CreatedAppointment[] = []

      if (isMultiService) {
        // Create one appointment per service booking
        for (const b of state.serviceBookings) {
          const appt = await apiClient.createAppointment(tenant.id, {
            professionalId: b.professional.id,
            startAt:        b.slot.startAt,
            items:          [{ serviceId: b.service.id }],
            notes:          state.guestInfo.notes || undefined,
            guestName:      state.guestInfo.name,
            guestEmail:     state.guestInfo.email,
            guestPhone:     state.guestInfo.phone || undefined,
          })
          appointments.push(appt)
        }
      } else {
        // Single service — original flow
        if (!state.selectedProfessional || !state.selectedSlot) return
        const appt = await apiClient.createAppointment(tenant.id, {
          professionalId: state.selectedProfessional.id,
          startAt:        state.selectedSlot.startAt,
          items:          state.selectedServices.map(s => ({ serviceId: s.id })),
          notes:          state.guestInfo.notes || undefined,
          guestName:      state.guestInfo.name,
          guestEmail:     state.guestInfo.email,
          guestPhone:     state.guestInfo.phone || undefined,
        })
        appointments.push(appt)
      }

      setCreatedAppointments(appointments)
      update({ step: 'success' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        update({ conflictError: true, submitError: 'Uno de los horarios ya fue tomado. Por favor volvé a elegir.' })
      } else {
        const message = err instanceof ApiError
          ? err.message
          : 'Error al crear el turno. Verificá tu conexión e intentá de nuevo.'
        update({ submitError: message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset for a new booking from success ─────────────────────────────────
  function reset() {
    setState(INITIAL_BOOKING_STATE)
    setSlotsResponse(null)
    setCreatedAppointments([])
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Professionals who offer the current service being booked.
   * In multi-service mode: filtered by current service only.
   * In single-service mode: must offer ALL selected services.
   */
  const eligibleProfessionals = isMultiService && currentService
    ? professionals.filter(p =>
        p.services.some(ps => ps.serviceId === currentService.id),
      )
    : professionals.filter(p =>
        state.selectedServices.every(svc =>
          p.services.some(ps => ps.serviceId === svc.id),
        ),
      )

  const timezone = slotsResponse?.timezone ?? tenant?.timezone ?? 'America/Argentina/Buenos_Aires'

  // For backward compatibility: expose first created appointment
  const createdAppointment = createdAppointments[0] ?? null

  return {
    // Data
    tenant,
    services,
    eligibleProfessionals,
    slotsResponse,
    createdAppointment,
    createdAppointments,
    timezone,

    // State
    ...state,
    isMultiService,
    currentService,

    // Loading / error
    initLoading,
    initError,
    slotsLoading,
    slotsError,
    submitting,

    // Actions
    toggleService,
    confirmServices,
    selectProfessional,
    selectDate,
    selectSlot,
    refreshSlots,
    updateGuestInfo,
    submit,
    goBack,
    reset,
  }
}
