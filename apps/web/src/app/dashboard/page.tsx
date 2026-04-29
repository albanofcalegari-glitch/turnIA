'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, CalendarRange, Calendar, Users, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useAgenda } from '@/features/agenda/useAgenda'
import { DayView } from '@/features/agenda/DayView'
import { WeekView } from '@/features/agenda/WeekView'
import { MonthView } from '@/features/agenda/MonthView'
import type { Professional } from '@/features/booking/booking.types'
import { useConfirm } from '@/components/ui/Dialog'
import { NewAppointmentModal } from '@/features/agenda/NewAppointmentModal'

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border bg-white p-3 shadow-card transition-shadow duration-200 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:p-5',
      highlight && 'border-brand-100 bg-brand-50/30 dark:border-brand-600/30 dark:bg-brand-600/10',
    )}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:text-xs">{label}</p>
      <p className={cn('mt-1 text-2xl font-extrabold tabular-nums sm:mt-2 sm:text-3xl', highlight ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900 dark:text-white')}>
        {value}
      </p>
    </div>
  )
}

export default function AgendaPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''
  const timezone = user?.tenantTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  const { confirm, element: confirmDialog } = useConfirm()
  const agenda = useAgenda(tenantId, confirm)
  const { view, setView, proFilter, setProFilter, stats } = agenda

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [showNewAppt,   setShowNewAppt]   = useState(false)

  useEffect(() => {
    if (!tenantId) return
    apiClient.getProfessionals(tenantId)
      .then(setProfessionals)
      .catch(() => {})
  }, [tenantId])

  return (
    <div>
      {confirmDialog}

      {showNewAppt && (
        <NewAppointmentModal
          tenantId={tenantId}
          onCreated={() => { setShowNewAppt(false); agenda.refresh() }}
          onClose={() => setShowNewAppt(false)}
        />
      )}

      <div className="mb-4 sm:mb-6">
        <h1 className="mb-3 text-lg font-bold text-gray-900 dark:text-white sm:text-2xl">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          {professionals.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
              <Users size={14} className="text-gray-400" />
              <select
                value={proFilter}
                onChange={e => setProFilter(e.target.value)}
                className="max-w-[140px] bg-transparent text-xs text-gray-700 focus:outline-none dark:text-gray-300 sm:max-w-none"
              >
                <option value="">Todos</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex rounded-lg border bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => setView('day')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-3',
                view === 'day' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <CalendarDays size={13} /> Día
            </button>
            <button
              onClick={() => setView('week')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-3',
                view === 'week' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <CalendarRange size={13} /> Sem
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:gap-1.5 sm:px-3',
                view === 'month' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <Calendar size={13} /> Mes
            </button>
          </div>
          <button
            onClick={() => setShowNewAppt(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Plus size={14} />
            Nuevo turno
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Turnos"      value={stats.total}     />
        <StatCard label="Confirmados" value={stats.confirmed} highlight />
        <StatCard label="Pendientes"  value={stats.pending}   />
        <StatCard label="Completados" value={stats.completed} />
      </div>

      <div className="rounded-xl border border-gray-200/80 bg-white p-3 shadow-card dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:p-5 overflow-x-auto">
        {view === 'day'
          ? <DayView   agenda={agenda} timezone={timezone} />
          : view === 'week'
          ? <WeekView  agenda={agenda} timezone={timezone} />
          : <MonthView agenda={agenda} timezone={timezone} />
        }
      </div>
    </div>
  )
}
