'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, type WorkOrder, type WorkOrderSlot } from '@/lib/api'
import { toDateString } from '@/lib/utils'
import type {
  Appointment,
  AppointmentAction,
  AgendaView,
} from './agenda.types'

// ─────────────────────────────────────────────────────────────────────────────
// Types for WorkOrder presence in the agenda
// ─────────────────────────────────────────────────────────────────────────────

/** A work-order anchored to a specific slot on a specific day. */
export interface AgendaWorkOrderEntry {
  order: WorkOrder
  slot:  WorkOrderSlot
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date`. */
function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()           // 0=Sun, 1=Mon, …
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns YYYY-MM-DD for each day in the week starting at monday. */
function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return toDateString(d)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAgenda(tenantId: string, options?: { workOrdersEnabled?: boolean }) {
  const workOrdersEnabled = options?.workOrdersEnabled ?? false

  const [view,         setView]         = useState<AgendaView>('day')
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [proFilter,    setProFilter]    = useState<string>('')     // '' = all

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [workOrders,   setWorkOrders]   = useState<WorkOrder[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)

  // Track which appointment is being actioned (id → action)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchAppointments = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    try {
      // Appointments (existing behaviour)
      const apptsPromise = view === 'week'
        ? (() => {
            const monday = weekStart(new Date(selectedDate + 'T12:00:00'))
            const dates  = weekDates(monday)
            return apiClient.getAppointments(tenantId, {
              from: dates[0],
              to:   dates[6],
              ...(proFilter ? { professionalId: proFilter } : {}),
            })
          })()
        : apiClient.getAppointments(tenantId, {
            date: selectedDate,
            ...(proFilter ? { professionalId: proFilter } : {}),
          })

      // Work orders (Phase 1). We fetch ALL orders (no date filter) because
      // a WorkOrder can span days that started before the visible range, and
      // the list is expected to stay small in the MVP. Client-side filters
      // down to the visible day/week. Only fetched when the tenant has
      // complex services so peluquerías pay zero extra cost.
      const woPromise = workOrdersEnabled
        ? apiClient.getWorkOrders(tenantId).catch(() => [] as WorkOrder[])
        : Promise.resolve([] as WorkOrder[])

      const [appts, wos] = await Promise.all([apptsPromise, woPromise])
      setAppointments(appts)
      setWorkOrders(wos)
    } catch {
      setError('No se pudieron cargar los turnos. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedDate, proFilter, view, workOrdersEnabled])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Executes a status transition for a single appointment.
   * On success, updates the appointment in-place without a full refetch.
   */
  const executeAction = useCallback(async (
    appointmentId: string,
    action:        AppointmentAction,
    payload?:      { reason?: string },
  ) => {
    setActionLoading(prev => ({ ...prev, [appointmentId]: true }))
    try {
      let updated: Appointment
      switch (action) {
        case 'confirm':
          updated = await apiClient.confirmAppointment(tenantId, appointmentId)
          break
        case 'cancel':
          updated = await apiClient.cancelAppointment(tenantId, appointmentId, payload?.reason)
          break
        case 'complete':
          updated = await apiClient.completeAppointment(tenantId, appointmentId)
          break
        case 'no_show':
          updated = await apiClient.noShowAppointment(tenantId, appointmentId)
          break
      }
      // Optimistic update: replace the appointment in the local list
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, ...updated } : a),
      )
    } catch {
      setError('Error al actualizar el turno. Intentá de nuevo.')
    } finally {
      setActionLoading(prev => ({ ...prev, [appointmentId]: false }))
    }
  }, [tenantId])

  // ── Derived data ─────────────────────────────────────────────────────────

  /** Appointments for the currently selected day (sorted by startAt). */
  const dayAppointments = appointments
    .filter(a => a.startAt.startsWith(selectedDate) || toDateString(new Date(a.startAt)) === selectedDate)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))

  /** Appointments grouped by date string for week view. */
  const weekAppointments: Record<string, Appointment[]> = {}
  if (view === 'week') {
    const monday = weekStart(new Date(selectedDate + 'T12:00:00'))
    weekDates(monday).forEach(date => {
      weekAppointments[date] = appointments
        .filter(a => toDateString(new Date(a.startAt)) === date)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
    })
  }

  // ── Work orders derived state ───────────────────────────────────────────

  /**
   * Work-order slots anchored to the selected day. A single order can
   * contribute multiple slots across days; we pick the slot matching
   * `selectedDate` (by startAt timezone-agnostic date compare).
   */
  const dayWorkOrders: AgendaWorkOrderEntry[] = workOrders
    .flatMap(order =>
      order.workSlots
        .filter(slot => toDateString(new Date(slot.startAt)) === selectedDate)
        .map(slot => ({ order, slot })),
    )
    .sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt))

  /** Work-order slots grouped by date for the week view. */
  const weekWorkOrders: Record<string, AgendaWorkOrderEntry[]> = {}
  if (view === 'week') {
    const monday = weekStart(new Date(selectedDate + 'T12:00:00'))
    weekDates(monday).forEach(date => {
      weekWorkOrders[date] = workOrders
        .flatMap(order =>
          order.workSlots
            .filter(slot => toDateString(new Date(slot.startAt)) === date)
            .map(slot => ({ order, slot })),
        )
        .sort((a, b) => a.slot.startAt.localeCompare(b.slot.startAt))
    })
  }

  /** Stats for the selected day. */
  const stats = {
    total:     dayAppointments.length,
    confirmed: dayAppointments.filter(a => a.status === 'CONFIRMED').length,
    pending:   dayAppointments.filter(a => a.status === 'PENDING').length,
    completed: dayAppointments.filter(a => a.status === 'COMPLETED').length,
  }

  // ── Week navigation ────────────────────────────────────────────────────────

  function goToPrevWeek() {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    setSelectedDate(toDateString(d))
  }

  function goToNextWeek() {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    setSelectedDate(toDateString(d))
  }

  return {
    // State
    view,
    setView,
    selectedDate,
    setSelectedDate,
    proFilter,
    setProFilter,

    // Data
    dayAppointments,
    weekAppointments,
    dayWorkOrders,
    weekWorkOrders,
    stats,

    // Loading / error
    loading,
    error,
    actionLoading,

    // Actions
    executeAction,
    refresh: fetchAppointments,
    goToPrevWeek,
    goToNextWeek,
  }
}
