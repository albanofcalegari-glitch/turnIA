'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, CalendarRange, Calendar, Users, Link2, Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useAgenda } from '@/features/agenda/useAgenda'
import { DayView } from '@/features/agenda/DayView'
import { WeekView } from '@/features/agenda/WeekView'
import { MonthView } from '@/features/agenda/MonthView'
import type { Professional } from '@/features/booking/booking.types'
import { useConfirm } from '@/components/ui/Dialog'

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover dark:border-gray-800 dark:bg-gray-900 dark:shadow-none',
      highlight && 'border-brand-100 bg-brand-50/30 dark:border-brand-600/30 dark:bg-brand-600/10',
    )}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-2 text-3xl font-extrabold tabular-nums', highlight ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900 dark:text-white')}>
        {value}
      </p>
    </div>
  )
}

function PublicUrlCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(`/${slug}`)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(`${window.location.origin}/${slug}`)
    }
  }, [slug])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-brand-200 bg-gradient-to-r from-brand-50 to-brand-50/60 px-5 py-6 shadow-card dark:border-brand-600/30 dark:from-brand-600/10 dark:to-brand-600/5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-7">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-400">
          <Link2 size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">Tu link público para reservar turnos</p>
          <p className="mt-0.5 truncate text-base font-mono text-gray-700 dark:text-gray-300">{url}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={copy}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
            copied
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-600/30 dark:bg-green-600/10 dark:text-green-400'
              : 'border-brand-300 bg-white text-brand-700 hover:bg-brand-50 shadow-sm dark:border-brand-600/30 dark:bg-gray-800 dark:text-brand-400 dark:hover:bg-gray-700',
          )}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ExternalLink size={15} />
          Abrir
        </a>
      </div>
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

  useEffect(() => {
    if (!tenantId) return
    apiClient.getProfessionals(tenantId)
      .then(setProfessionals)
      .catch(() => {})
  }, [tenantId])

  return (
    <div>
      {confirmDialog}
      {user?.tenantSlug && <PublicUrlCard slug={user.tenantSlug} />}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Agenda</h1>
        <div className="flex flex-wrap items-center gap-2">
          {professionals.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800">
              <Users size={14} className="text-gray-400" />
              <select
                value={proFilter}
                onChange={e => setProFilter(e.target.value)}
                className="bg-transparent text-xs text-gray-700 focus:outline-none dark:text-gray-300"
              >
                <option value="">Todos los profesionales</option>
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
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'day' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <CalendarDays size={13} /> Día
            </button>
            <button
              onClick={() => setView('week')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'week' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <CalendarRange size={13} /> Semana
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'month' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              )}
            >
              <Calendar size={13} /> Mes
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
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
