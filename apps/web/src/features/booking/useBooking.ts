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
  const [createdAppointment,  setCreatedAppointment]  = useState<CreatedAppointment | null>(null)

  // ── Booking flow state ────────────────────────────────────────────────────
  const [state, setState] = useState<BookingState>(INITIAL_BOOKING_STATE)

  const update = (patch: Partial<BookingState>) =>
    setState(s => ({ ...s, ...patch }))

  // ── Load initial data ─────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setInitLoading(true)
      setInitError(null)
      try {
        const t = await apiClient.getTenantBySlug(tenantSlug)
        const [svcs, pros] = await Promise.all([
          apiClient.getServices(t.id),
          apiClient.getProfessionals(t.id),
        ])
        setTenant(t)
        setServices(svcs.filter(s => s.isPublic))
        setProfessionals(pros.filter(p => p.acceptsOnlineBooking))
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Tenant no existe — dejar initError null para que BookingFlow
          // muestre el mensaje por defecto "Negocio no encontrado"
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
    selectedSvcs:  Service[],
  ) => {
    setSlotsLoading(true)
    setSlotsError(null)
    setSlotsResponse(null)
    try {
      const res = await apiClient.getSlots(
        tenantId,
        proId,
        date,
        selectedSvcs.map(s => s.id),
      )
      setSlotsResponse(res)
    } catch {
      setSlotsError('No se pudieron cargar los horarios. Intentá de nuevo.')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Step navigation actions
  // ─────────────────────────────────────────────────────────────────────────

  const STEP_ORDER: BookingStep[] = [
    'services', 'professional', 'date', 'slots', 'details',
  ]

  function goBack() {
    const idx = STEP_ORDER.indexOf(state.step)
    if (idx > 0) update({ step: STEP_ORDER[idx - 1] })
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
    update({ step: 'professional' })
  }

  // ── Step 2: Select professional ───────────────────────────────────────────
  function selectProfessional(p: Professional) {
    update({ selectedProfessional: p, step: 'date' })
  }

  // ── Step 3: Select date ───────────────────────────────────────────────────
  function selectDate(date: string) {
    if (!tenant || !state.selectedProfessional) return
    update({ selectedDate: date, selectedSlot: null, step: 'slots' })
    fetchSlots(tenant.id, state.selectedProfessional.id, date, state.selectedServices)
  }

  // ── Step 4: Select slot ───────────────────────────────────────────────────
  function selectSlot(slot: AvailableSlot) {
    update({ selectedSlot: slot, step: 'details', conflictError: false })
  }

  function refreshSlots() {
    if (!tenant || !state.selectedProfessional || !state.selectedDate) return
    fetchSlots(tenant.id, state.selectedProfessional.id, state.selectedDate, state.selectedServices)
  }

  // ── Step 5: Update guest info ─────────────────────────────────────────────
  function updateGuestInfo(field: keyof GuestInfo, value: string) {
    update({ guestInfo: { ...state.guestInfo, [field]: value } })
  }

  // ── Step 5: Submit ────────────────────────────────────────────────────────
  async function submit() {
    if (!tenant || !state.selectedProfessional || !state.selectedSlot) return

    setSubmitting(true)
    update({ submitError: null, conflictError: false })

    try {
      const appt = await apiClient.createAppointment(tenant.id, {
        professionalId: state.selectedProfessional.id,
        startAt:        state.selectedSlot.startAt,
        items:          state.selectedServices.map(s => ({ serviceId: s.id })),
        notes:          state.guestInfo.notes || undefined,
        guestName:      state.guestInfo.name,
        guestEmail:     state.guestInfo.email,
        guestPhone:     state.guestInfo.phone || undefined,
      })

      setCreatedAppointment(appt)
      update({ step: 'success' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Slot was taken by a concurrent booking.
        // Clear the selected slot, refresh the slots list, go back to pick another.
        update({
          conflictError: true,
          selectedSlot:  null,
          step:          'slots',
        })
        refreshSlots()
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
    setCreatedAppointment(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Professionals who offer ALL currently selected services.
   * Recomputed whenever selectedServices changes.
   */
  const eligibleProfessionals = professionals.filter(p =>
    state.selectedServices.every(svc =>
      p.services.some(ps => ps.serviceId === svc.id),
    ),
  )

  const timezone = slotsResponse?.timezone ?? tenant?.timezone ?? 'America/Argentina/Buenos_Aires'

  return {
    // Data
    tenant,
    services,
    eligibleProfessionals,
    slotsResponse,
    createdAppointment,
    timezone,

    // State
    ...state,

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
