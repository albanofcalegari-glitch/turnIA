'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, CalendarRange, Calendar, Users, Plus, Banknote, CreditCard, ArrowRightLeft, Wallet, DollarSign } from 'lucide-react'
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

const PAYMENT_CONFIG: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  CASH:        { label: 'Efectivo',        icon: Banknote,       color: 'text-green-600 dark:text-green-400' },
  DEBIT_CARD:  { label: 'Tarjeta débito',  icon: CreditCard,     color: 'text-blue-600 dark:text-blue-400' },
  CREDIT_CARD: { label: 'Tarjeta crédito', icon: CreditCard,     color: 'text-purple-600 dark:text-purple-400' },
  TRANSFER:    { label: 'Transferencia',   icon: ArrowRightLeft, color: 'text-cyan-600 dark:text-cyan-400' },
  MERCADOPAGO: { label: 'MercadoPago',     icon: Wallet,         color: 'text-sky-600 dark:text-sky-400' },
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function AgendaPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''
  const timezone = user?.tenantTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  const { confirm, element: confirmDialog } = useConfirm()
  const agenda = useAgenda(tenantId, confirm)
  const { view, setView, proFilter, setProFilter, stats, dayAppointments } = agenda

  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [showNewAppt,   setShowNewAppt]   = useState(false)

  const cajaDiaria = useMemo(() => {
    const completed = dayAppointments.filter(a => a.status === 'COMPLETED')
    const byMethod: Record<string, { count: number; total: number }> = {}
    let grandTotal = 0
    for (const a of completed) {
      const price = typeof a.totalPrice === 'string' ? parseFloat(a.totalPrice) : a.totalPrice
      grandTotal += price
      const method = a.paymentMethod ?? 'SIN_DATO'
      if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 }
      byMethod[method].count++
      byMethod[method].total += price
    }
    return { grandTotal, byMethod, completedCount: completed.length }
  }, [dayAppointments])

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

      {cajaDiaria.completedCount > 0 && (
        <div className="mb-4 rounded-xl border bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900 dark:shadow-none sm:mb-6 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Caja del día</h3>
            </div>
            <p className="text-lg font-extrabold tabular-nums text-green-700 dark:text-green-400">
              {fmtARS(cajaDiaria.grandTotal)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(cajaDiaria.byMethod)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([method, data]) => {
                const cfg = PAYMENT_CONFIG[method]
                const Icon = cfg?.icon ?? DollarSign
                return (
                  <div key={method} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                    <Icon size={15} className={cfg?.color ?? 'text-gray-400'} />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cfg?.label ?? 'Sin dato'}</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmtARS(data.total)}</p>
                      <p className="text-[10px] text-gray-400">{data.count} turno{data.count > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

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
