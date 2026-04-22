'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api'
import { toDateString } from '@/lib/utils'
import type { ConfirmOptions } from '@/components/ui/Dialog'
import type {
  Appointment,
  AppointmentAction,
  AgendaView,
} from './agenda.types'

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

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

/** Returns the first Monday on/before the 1st of the month containing `date`. */
function monthGridStart(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  return weekStart(first)
}

/** Returns 42 dates (6 weeks x 7 days) for a full-month calendar grid. */
function monthGridDates(anchor: Date): string[] {
  const start = monthGridStart(anchor)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return toDateString(d)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAgenda(tenantId: string, confirmFn?: ConfirmFn) {
  const [view,         setView]         = useState<AgendaView>('day')
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [proFilter,    setProFilter]    = useState<string>('')     // '' = all

  const [appointments, setAppointments] = useState<Appointment[]>([])
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
      if (view === 'month') {
        const anchor = new Date(selectedDate + 'T12:00:00')
        const dates  = monthGridDates(anchor)
        const result = await apiClient.getAppointments(tenantId, {
          from: dates[0],
          to:   dates[dates.length - 1],
          ...(proFilter ? { professionalId: proFilter } : {}),
        })
        setAppointments(result)
      } else if (view === 'week') {
        const monday = weekStart(new Date(selectedDate + 'T12:00:00'))
        const dates  = weekDates(monday)
        const result = await apiClient.getAppointments(tenantId, {
          from: dates[0],
          to:   dates[6],
          ...(proFilter ? { professionalId: proFilter } : {}),
        })
        setAppointments(result)
      } else {
        const result = await apiClient.getAppointments(tenantId, {
          date: selectedDate,
          ...(proFilter ? { professionalId: proFilter } : {}),
        })
        setAppointments(result)
      }
    } catch {
      setError('No se pudieron cargar los turnos. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [tenantId, selectedDate, proFilter, view])

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
    const confirmSpecs: Partial<Record<AppointmentAction, ConfirmOptions>> = {
      confirm:  { title: 'Confirmar turno',     message: '¿Confirmar este turno?',              confirmText: 'Confirmar' },
      complete: { title: 'Completar turno',     message: '¿Marcar este turno como completado?', confirmText: 'Completar' },
      no_show:  { title: 'Marcar no asistió',   message: '¿Marcar este turno como "no asistió"?', confirmText: 'Marcar no asistió', variant: 'danger' },
      reopen:   { title: 'Reabrir turno',       message: 'El turno vuelve al estado "Confirmado" y se podrá completar o cancelar de nuevo.', confirmText: 'Reabrir' },
    }
    const spec = confirmSpecs[action]
    if (spec) {
      const ok = confirmFn
        ? await confirmFn(spec)
        : window.confirm(typeof spec.message === 'string' ? spec.message : '¿Confirmar?')
      if (!ok) return
    }

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
        case 'reopen':
          updated = await apiClient.reopenAppointment(tenantId, appointmentId)
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
  }, [tenantId, confirmFn])

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

  /** Appointments grouped by date for the 6-week month grid. */
  const monthAppointments: Record<string, Appointment[]> = {}
  if (view === 'month') {
    const anchor = new Date(selectedDate + 'T12:00:00')
    monthGridDates(anchor).forEach(date => {
      monthAppointments[date] = appointments
        .filter(a => toDateString(new Date(a.startAt)) === date)
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
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

  // ── Month navigation ──────────────────────────────────────────────────────

  function goToPrevMonth() {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setMonth(d.getMonth() - 1)
    setSelectedDate(toDateString(d))
  }

  function goToNextMonth() {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setMonth(d.getMonth() + 1)
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
    monthAppointments,
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
    goToPrevMonth,
    goToNextMonth,
  }
}
