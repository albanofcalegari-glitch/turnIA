'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, CalendarRange, CalendarDays as CalendarMonthIcon, Users, Link2, Copy, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { useAgenda } from '@/features/agenda/useAgenda'
import { DayView } from '@/features/agenda/DayView'
import { WeekView } from '@/features/agenda/WeekView'
import { MonthView } from '@/features/agenda/MonthView'
import type { Professional } from '@/features/booking/booking.types'
import { useConfirm } from '@/components/ui/Dialog'

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
// Public booking URL — visible on the dashboard so the owner can copy/share it
// ─────────────────────────────────────────────────────────────────────────────

function PublicUrlCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  // Build the full URL on the client to pick up the actual host:port the
  // owner is using (works for localhost dev as well as the prod domain).
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
      // clipboard API blocked (HTTP) — fallback with execCommand
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
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Link2 size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-brand-800">Tu link público para reservar turnos</p>
          <p className="truncate text-sm font-mono text-gray-700">{url}</p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={copy}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            copied
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50',
          )}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ExternalLink size={13} />
          Abrir
        </a>
      </div>
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

  const { confirm, element: confirmDialog } = useConfirm()
  const agenda = useAgenda(tenantId, confirm)
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
      {confirmDialog}
      {/* Public booking URL — only for tenant users (not super-admins without tenant) */}
      {user?.tenantSlug && <PublicUrlCard slug={user.tenantSlug} />}

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

          {/* Day / Week / Month toggle */}
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
            <button
              onClick={() => setView('month')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'month'
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <CalendarMonthIcon size={13} />
              Mes
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
          ? <DayView   agenda={agenda} timezone={timezone} />
          : view === 'week'
          ? <WeekView  agenda={agenda} timezone={timezone} />
          : <MonthView agenda={agenda} timezone={timezone} />
        }
      </div>
    </div>
  )
}
