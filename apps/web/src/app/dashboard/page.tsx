'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, CalendarRange, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useAgenda } from '@/features/agenda/useAgenda'
import { DayView } from '@/features/agenda/DayView'
import { WeekView } from '@/features/agenda/WeekView'
import type { Professional } from '@/features/booking/booking.types'

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', highlight ? 'text-brand-700' : 'text-gray-900')}>
        {value}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const tenantId  = user?.tenantId  ?? ''
  const timezone  = user?.tenantTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  const agenda = useAgenda(tenantId)
  const { view, setView, proFilter, setProFilter, stats } = agenda

  const [professionals, setProfessionals] = useState<Professional[]>([])

  // Fetch professional list for the filter dropdown
  useEffect(() => {
    if (!tenantId) return
    apiClient.getProfessionals(tenantId)
      .then(setProfessionals)
      .catch(() => {/* non-critical — filter just won't populate */})
  }, [tenantId])

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Agenda</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Professional filter */}
          {professionals.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5">
              <Users size={14} className="text-gray-400" />
              <select
                value={proFilter}
                onChange={e => setProFilter(e.target.value)}
                className="bg-transparent text-xs text-gray-700 focus:outline-none"
              >
                <option value="">Todos los profesionales</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Day / Week toggle */}
          <div className="flex rounded-lg border bg-white p-0.5">
            <button
              onClick={() => setView('day')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'day'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <CalendarDays size={13} />
              Día
            </button>
            <button
              onClick={() => setView('week')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'week'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <CalendarRange size={13} />
              Semana
            </button>
          </div>
        </div>
      </div>

      {/* Stats row — always show for day view; for week view shows selected day */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Turnos"      value={stats.total}     />
        <StatCard label="Confirmados" value={stats.confirmed} highlight />
        <StatCard label="Pendientes"  value={stats.pending}   />
        <StatCard label="Completados" value={stats.completed} />
      </div>

      {/* Agenda view */}
      <div className="rounded-xl border bg-white p-3 sm:p-5 overflow-x-auto">
        {view === 'day'
          ? <DayView  agenda={agenda} timezone={timezone} />
          : <WeekView agenda={agenda} timezone={timezone} />
        }
      </div>
    </div>
  )
}
