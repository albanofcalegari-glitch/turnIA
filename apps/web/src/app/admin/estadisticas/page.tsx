'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, Building2, CheckCircle2, XCircle, Clock, Users, TrendingUp,
  ArrowUpRight, ArrowDownRight, Scissors, AlertTriangle,
} from 'lucide-react'
import { apiClient, type AdminStats, type AdminTenant } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  standard: 'bg-green-500/20 text-green-600 dark:text-green-400',
  pro: 'bg-brand-500/20 text-brand-700 dark:text-brand-400',
  free: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  starter: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
}

export default function AdminEstadisticasPage() {
  const [stats, setStats]       = useState<AdminStats | null>(null)
  const [tenants, setTenants]   = useState<AdminTenant[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.adminGetStats(),
      apiClient.getAllTenants(),
    ]).then(([s, t]) => {
      setStats(s)
      setTenants(t)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
  if (!stats) return null

  const confirmed = stats.appointmentsByStatus['CONFIRMED'] ?? 0
  const completed = stats.appointmentsByStatus['COMPLETED'] ?? 0
  const cancelled = stats.appointmentsByStatus['CANCELLED'] ?? 0
  const pending   = stats.appointmentsByStatus['PENDING'] ?? 0
  const noShow    = stats.appointmentsByStatus['NO_SHOW'] ?? 0

  const completionRate = stats.totalAppointments > 0 ? ((completed / stats.totalAppointments) * 100).toFixed(1) : '0'
  const cancelRate     = stats.totalAppointments > 0 ? ((cancelled / stats.totalAppointments) * 100).toFixed(1) : '0'
  const noShowRate     = stats.totalAppointments > 0 ? ((noShow / stats.totalAppointments) * 100).toFixed(1) : '0'

  const planDistribution = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.plan] = (acc[t.plan] ?? 0) + 1
    return acc
  }, {})

  const typeDistribution = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.type] = (acc[t.type] ?? 0) + 1
    return acc
  }, {})

  const avgAppointments = stats.activeTenants > 0 ? Math.round(stats.totalAppointments / stats.activeTenants) : 0
  const avgServices = tenants.length > 0 ? Math.round(tenants.reduce((s, t) => s + t._count.services, 0) / tenants.length) : 0
  const avgProfessionals = tenants.length > 0 ? (tenants.reduce((s, t) => s + t._count.professionals, 0) / tenants.length).toFixed(1) : '0'

  const monthDelta = stats.appointmentsLastMonth > 0
    ? Math.round(((stats.appointmentsThisMonth - stats.appointmentsLastMonth) / stats.appointmentsLastMonth) * 100)
    : null

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Estadísticas</h1>

      {/* Key rates */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <RateCard label="Turnos totales" value={stats.totalAppointments.toLocaleString('es-AR')} color="text-brand-700 dark:text-brand-400" />
        <RateCard label="Este mes" value={stats.appointmentsThisMonth.toLocaleString('es-AR')} delta={monthDelta} color="text-green-600 dark:text-green-400" />
        <RateCard label="Tasa completados" value={`${completionRate}%`} color="text-brand-700 dark:text-brand-400" />
        <RateCard label="Tasa cancelación" value={`${cancelRate}%`} color="text-red-600 dark:text-red-400" />
        <RateCard label="Tasa no-show" value={`${noShowRate}%`} color="text-amber-600 dark:text-amber-400" />
        <RateCard label="Promedio por negocio" value={avgAppointments.toString()} color="text-blue-600 dark:text-blue-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Appointments status breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Desglose por estado</h2>
          <div className="space-y-4">
            <StatusRow icon={CheckCircle2} label="Completados" value={completed} total={stats.totalAppointments} color="text-brand-700 dark:text-brand-400" barColor="bg-brand-500" />
            <StatusRow icon={CheckCircle2} label="Confirmados" value={confirmed} total={stats.totalAppointments} color="text-green-600 dark:text-green-400" barColor="bg-green-500" />
            <StatusRow icon={Clock} label="Pendientes" value={pending} total={stats.totalAppointments} color="text-amber-600 dark:text-amber-400" barColor="bg-amber-500" />
            <StatusRow icon={XCircle} label="Cancelados" value={cancelled} total={stats.totalAppointments} color="text-red-600 dark:text-red-400" barColor="bg-red-500" />
            <StatusRow icon={AlertTriangle} label="No show" value={noShow} total={stats.totalAppointments} color="text-gray-500 dark:text-gray-400" barColor="bg-gray-500" />
          </div>
        </div>

        {/* Plan distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Distribución por plan</h2>
          <div className="space-y-3">
            {Object.entries(planDistribution).sort((a, b) => b[1] - a[1]).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-3">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium w-20 text-center', PLAN_COLORS[plan] ?? PLAN_COLORS.free)}>{plan}</span>
                <div className="flex-1">
                  <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-4 rounded-full bg-brand-200 dark:bg-brand-600/40" style={{ width: `${(count / tenants.length) * 100}%` }} />
                  </div>
                </div>
                <span className="w-8 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{count}</span>
                <span className="w-10 text-right text-[10px] text-gray-500">{((count / tenants.length) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Distribución por rubro</h2>
          <div className="space-y-3">
            {Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="w-24 text-xs text-gray-500 dark:text-gray-400 capitalize">{type}</span>
                <div className="flex-1">
                  <div className="h-4 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-4 rounded-full bg-blue-200 dark:bg-blue-600/40" style={{ width: `${(count / tenants.length) * 100}%` }} />
                  </div>
                </div>
                <span className="w-8 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Averages */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Promedios por negocio</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Calendar size={20} className="mx-auto text-brand-600 dark:text-brand-400" />
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{avgAppointments}</p>
              <p className="text-xs text-gray-500">Turnos</p>
            </div>
            <div className="text-center">
              <Scissors size={20} className="mx-auto text-green-600 dark:text-green-400" />
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{avgServices}</p>
              <p className="text-xs text-gray-500">Servicios</p>
            </div>
            <div className="text-center">
              <Users size={20} className="mx-auto text-blue-600 dark:text-blue-400" />
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{avgProfessionals}</p>
              <p className="text-xs text-gray-500">Profesionales</p>
            </div>
          </div>
        </div>

        {/* Evolution chart full width */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Evolución mensual</h2>
          <div className="grid grid-cols-6 gap-3">
            {stats.evolution.map(e => {
              const maxAppt = Math.max(...stats.evolution.map(x => x.appointments), 1)
              const height = Math.max((e.appointments / maxAppt) * 100, 5)
              return (
                <div key={e.month} className="flex flex-col items-center">
                  <div className="relative flex h-32 w-full items-end justify-center rounded-lg bg-gray-50 px-1 dark:bg-gray-800/50">
                    <div className="w-full rounded-t-md bg-brand-200 transition-all dark:bg-brand-600/60" style={{ height: `${height}%` }} />
                  </div>
                  <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{e.appointments}</p>
                  <p className="text-[10px] text-gray-500">turnos</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{e.tenants} neg.</p>
                  <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{e.month}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function RateCard({ label, value, delta, color }: { label: string; value: string; delta?: number | null; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', color)}>{value}</p>
      {delta !== undefined && delta !== null && (
        <div className={cn('mt-0.5 flex items-center gap-0.5 text-[10px] font-medium', delta >= 0 ? 'text-green-500' : 'text-red-500')}>
          {delta >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(delta)}%
        </div>
      )}
    </div>
  )
}

function StatusRow({ icon: Icon, label, value, total, color, barColor }: {
  icon: any; label: string; value: number; total: number; color: string; barColor: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} />
          <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', color)}>{value.toLocaleString('es-AR')}</span>
          <span className="text-[10px] text-gray-500">({pct.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={cn('h-2 rounded-full transition-all', barColor)} style={{ width: `${Math.max(pct, 0.5)}%` }} />
      </div>
    </div>
  )
}
