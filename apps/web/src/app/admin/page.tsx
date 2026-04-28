'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Calendar, Users, TrendingUp, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle, Clock, AlertTriangle, BarChart3, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient, type AdminStats, type PaymentMetrics } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  standard: 'bg-green-500/20 text-green-600 dark:text-green-400',
  pro: 'bg-brand-500/20 text-brand-700 dark:text-brand-400',
  free: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  starter: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
}

export default function AdminDashboard() {
  const [stats, setStats]     = useState<AdminStats | null>(null)
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.adminGetStats(),
      apiClient.adminGetPaymentMetrics().catch(() => null),
    ]).then(([s, m]) => {
      setStats(s)
      setMetrics(m)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
  if (!stats) return null

  const monthDelta = stats.appointmentsLastMonth > 0
    ? Math.round(((stats.appointmentsThisMonth - stats.appointmentsLastMonth) / stats.appointmentsLastMonth) * 100)
    : null

  const confirmed = stats.appointmentsByStatus['CONFIRMED'] ?? 0
  const completed = stats.appointmentsByStatus['COMPLETED'] ?? 0
  const cancelled = stats.appointmentsByStatus['CANCELLED'] ?? 0
  const pending   = stats.appointmentsByStatus['PENDING'] ?? 0
  const noShow    = stats.appointmentsByStatus['NO_SHOW'] ?? 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Dashboard</h1>
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <KpiCard icon={Building2} label="Negocios" value={stats.totalTenants} sub={`${stats.activeTenants} activos`} color="text-blue-600 dark:text-blue-400" />
        <KpiCard icon={Calendar} label="Turnos totales" value={stats.totalAppointments} color="text-brand-700 dark:text-brand-400" />
        <KpiCard
          icon={TrendingUp}
          label="Turnos (mes)"
          value={stats.appointmentsThisMonth}
          delta={monthDelta}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard icon={AlertTriangle} label="En trial" value={stats.trialTenants} color="text-amber-600 dark:text-amber-400" />
        {metrics && (
          <KpiCard icon={BarChart3} label="MRR" value={`$${metrics.mrr.toLocaleString('es-AR')}`} color="text-emerald-600 dark:text-emerald-400" />
        )}
        <KpiCard
          icon={Mail}
          label="Emails (mes)"
          value={stats.emailsSentThisMonth}
          sub={`de ${stats.emailMonthlyLimit.toLocaleString('es-AR')}`}
          color={stats.emailsSentThisMonth > stats.emailMonthlyLimit * 0.8
            ? 'text-red-600 dark:text-red-400'
            : 'text-purple-600 dark:text-purple-400'}
        />
      </div>

      {/* Email usage bar */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Uso de emails (Resend)</span>
          </div>
          <span className="text-xs text-gray-500">
            Renueva: {new Date(stats.emailResetsAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
          </span>
        </div>
        <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cn(
              'h-4 rounded-full transition-all',
              stats.emailsSentThisMonth > stats.emailMonthlyLimit * 0.8 ? 'bg-red-500' : 'bg-purple-500',
            )}
            style={{ width: `${Math.min((stats.emailsSentThisMonth / stats.emailMonthlyLimit) * 100, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {stats.emailsSentThisMonth.toLocaleString('es-AR')} / {stats.emailMonthlyLimit.toLocaleString('es-AR')} emails enviados este mes
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Appointments by status */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Turnos por estado</h2>
          <div className="space-y-3">
            <StatusBar label="Confirmados" value={confirmed} total={stats.totalAppointments} icon={CheckCircle2} color="bg-green-500" textColor="text-green-600 dark:text-green-400" />
            <StatusBar label="Completados" value={completed} total={stats.totalAppointments} icon={CheckCircle2} color="bg-brand-500" textColor="text-brand-700 dark:text-brand-400" />
            <StatusBar label="Pendientes" value={pending} total={stats.totalAppointments} icon={Clock} color="bg-amber-500" textColor="text-amber-600 dark:text-amber-400" />
            <StatusBar label="Cancelados" value={cancelled} total={stats.totalAppointments} icon={XCircle} color="bg-red-500" textColor="text-red-600 dark:text-red-400" />
            <StatusBar label="No show" value={noShow} total={stats.totalAppointments} icon={XCircle} color="bg-gray-500" textColor="text-gray-600 dark:text-gray-400" />
          </div>
        </div>

        {/* Evolution chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Evolución (6 meses)</h2>
          <div className="space-y-2">
            {stats.evolution.map(e => {
              const maxAppt = Math.max(...stats.evolution.map(x => x.appointments), 1)
              return (
                <div key={e.month} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-gray-500">{e.month}</span>
                  <div className="flex-1">
                    <div className="h-5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="flex h-5 items-center rounded-full bg-brand-100 px-2 text-[10px] font-medium text-brand-700 transition-all dark:bg-brand-600/40 dark:text-brand-300"
                        style={{ width: `${Math.max((e.appointments / maxAppt) * 100, 8)}%` }}
                      >
                        {e.appointments}
                      </div>
                    </div>
                  </div>
                  <span className="w-12 text-right text-xs text-gray-500">{e.tenants} neg.</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top tenants */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top negocios por turnos</h2>
            <Link href="/admin/negocios" className="text-xs text-brand-600 hover:underline dark:text-brand-400">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {stats.topTenants.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{t.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">/{t.slug}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', PLAN_COLORS[t.plan] ?? PLAN_COLORS.free)}>
                  {t.plan}
                </span>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t._count.appointments}</p>
                  <p className="text-[10px] text-gray-500">turnos</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent tenants */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Últimos registros</h2>
          <div className="space-y-2">
            {stats.recentTenants.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className={cn('h-2.5 w-2.5 rounded-full', t.isActive ? 'bg-green-500' : 'bg-red-400')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{t.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">/{t.slug}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', PLAN_COLORS[t.plan] ?? PLAN_COLORS.free)}>
                  {t.plan}
                </span>
                <span className="text-xs text-gray-500">{formatDate(t.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, delta, color }: {
  icon: any; label: string; value: string | number; sub?: string; delta?: number | null; color?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color ?? 'text-gray-500'} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={cn('mt-1 text-2xl font-bold', color ?? 'text-gray-900 dark:text-white')}>{typeof value === 'number' ? value.toLocaleString('es-AR') : value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      {delta !== undefined && delta !== null && (
        <div className={cn('mt-1 flex items-center gap-0.5 text-xs font-medium', delta >= 0 ? 'text-green-500' : 'text-red-500')}>
          {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta)}% vs mes ant.
        </div>
      )}
    </div>
  )
}

function StatusBar({ label, value, total, icon: Icon, color, textColor }: {
  label: string; value: number; total: number; icon: any; color: string; textColor: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className={textColor} />
      <span className="w-24 text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1">
        <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800">
          <div className={cn('h-4 rounded-full transition-all', color)} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
      </div>
      <span className={cn('w-12 text-right text-sm font-semibold', textColor)}>{value}</span>
      <span className="w-10 text-right text-[10px] text-gray-500">{pct.toFixed(0)}%</span>
    </div>
  )
}
