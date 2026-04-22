'use client'

import { useEffect, useState } from 'react'
import { Calendar, Scissors, Users, BarChart3, Lock, Zap } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

interface MonthlyMetrics {
  month:         string
  appointments:  number
  services:      number
  uniqueClients: number
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS_ES[m - 1]} ${String(y).slice(2)}`
}

export default function ReportesPage() {
  const { user }  = useAuth()
  const [data,    setData]    = useState<MonthlyMetrics[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const plan = user?.tenantPlan ?? 'trial'
  const needsPro = plan === 'standard'

  useEffect(() => {
    if (!user?.tenantId || needsPro) return
    setLoading(true)
    apiClient.getMonthlyReports(user.tenantId, 6)
      .then(setData)
      .catch(() => setError('No pudimos cargar los reportes.'))
      .finally(() => setLoading(false))
  }, [user?.tenantId, needsPro])

  if (needsPro) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <Lock size={28} className="text-brand-600" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Reportes es una función Pro</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Accedé a métricas detalladas de turnos, servicios y clientes actualizando tu plan a Pro.
        </p>
        <Link
          href="/dashboard/suscripcion"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Zap size={16} />
          Actualizar a Pro
        </Link>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  }
  if (!data || data.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no hay datos para mostrar.</p>
  }

  const current = data[data.length - 1]
  const previous = data.length > 1 ? data[data.length - 2] : null

  const totalAppointments = data.reduce((sum, m) => sum + m.appointments, 0)
  const totalServices     = data.reduce((sum, m) => sum + m.services,     0)

  const maxAppointments = Math.max(1, ...data.map(m => m.appointments))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BarChart3 size={24} /> Reportes
        </h1>
        <p className="mt-1 text-sm text-gray-500">Resumen de los últimos 6 meses.</p>
      </div>

      {/* KPIs del mes actual */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<Calendar size={18} />}
          label="Turnos este mes"
          value={current.appointments}
          delta={previous ? current.appointments - previous.appointments : null}
        />
        <KpiCard
          icon={<Scissors size={18} />}
          label="Servicios este mes"
          value={current.services}
          delta={previous ? current.services - previous.services : null}
        />
        <KpiCard
          icon={<Users size={18} />}
          label="Clientes únicos este mes"
          value={current.uniqueClients}
          delta={previous ? current.uniqueClients - previous.uniqueClients : null}
        />
      </div>

      {/* Bar chart simple (CSS-only) */}
      <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-gray-700">Turnos por mes</h2>
        <div className="flex items-end gap-3 sm:gap-6" style={{ height: 200 }}>
          {data.map((m) => {
            const h = (m.appointments / maxAppointments) * 100
            return (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-brand-500 transition-all"
                    style={{ height: `${h}%`, minHeight: m.appointments > 0 ? '4px' : 0 }}
                    title={`${m.appointments} turnos`}
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-800">{m.appointments}</div>
                  <div className="text-[10px] text-gray-500">{formatMonth(m.month)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tabla detallada */}
      <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Mes</th>
              <th className="px-4 py-3 text-right font-medium">Turnos</th>
              <th className="px-4 py-3 text-right font-medium">Servicios</th>
              <th className="px-4 py-3 text-right font-medium">Clientes únicos</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((m) => (
              <tr key={m.month} className="border-t">
                <td className="px-4 py-3 capitalize text-gray-700">{formatMonth(m.month)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{m.appointments}</td>
                <td className="px-4 py-3 text-right text-gray-700">{m.services}</td>
                <td className="px-4 py-3 text-right text-gray-700">{m.uniqueClients}</td>
              </tr>
            ))}
            <tr className="border-t bg-gray-50 font-medium">
              <td className="px-4 py-3 text-gray-700">Total 6 meses</td>
              <td className="px-4 py-3 text-right text-gray-900">{totalAppointments}</td>
              <td className="px-4 py-3 text-right text-gray-700">{totalServices}</td>
              <td className="px-4 py-3 text-right text-gray-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, delta }: {
  icon:  React.ReactNode
  label: string
  value: number
  delta: number | null
}) {
  const deltaColor = delta === null || delta === 0
    ? 'text-gray-400'
    : delta > 0 ? 'text-green-600' : 'text-red-600'
  const deltaPrefix = delta === null ? '' : delta > 0 ? '+' : ''

  return (
    <div className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-center gap-2 text-sm text-gray-500">{icon}{label}</div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-gray-900">{value}</p>
      {delta !== null && (
        <p className={`mt-1 text-xs ${deltaColor}`}>
          {deltaPrefix}{delta} vs mes anterior
        </p>
      )}
    </div>
  )
}
