'use client'

import { useEffect, useState } from 'react'
import {
  Calendar, TrendingUp, TrendingDown, Minus, Users, Scissors,
  DollarSign, Trophy, Banknote, CreditCard, ArrowRightLeft, Wallet, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, type DashboardStats } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Dialog } from '@/components/ui/Dialog'
import type { Professional } from '@/features/booking/booking.types'

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DAY_LABELS  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const COLORS = {
  brand: '#22c55e',
  blue:  '#3b82f6',
  amber: '#f59e0b',
  red:   '#ef4444',
  gray:  '#9ca3af',
}

const STATUS_COLORS: Record<string, string> = {
  Completados: COLORS.brand,
  Confirmados: COLORS.blue,
  Pendientes:  COLORS.amber,
  Cancelados:  COLORS.red,
  'No-Show':   COLORS.gray,
}

const PERIODS = [
  { value: 'current_month', label: 'Este mes' },
  { value: 'last_month',    label: 'Mes anterior' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [period, setPeriod]   = useState('current_month')
  const [proFilter, setProFilter]       = useState('')
  const [showRevenue, setShowRevenue]   = useState(false)
  const [professionals, setProfessionals] = useState<Professional[]>([])

  useEffect(() => {
    if (!tenantId) return
    apiClient.getProfessionals(tenantId).then(setProfessionals).catch(() => {})
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    apiClient
      .getDashboardStats(tenantId, { period, professionalId: proFilter || undefined })
      .then(setStats)
      .catch(e => setError(e?.message ?? 'Error al cargar estadísticas'))
      .finally(() => setLoading(false))
  }, [tenantId, period, proFilter])

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!stats) return null

  const { kpis, rates, topProfessionals, topServices, monthlyEvolution } = stats
  const employeeOfMonth = topProfessionals[0] ?? null

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {stats.period.from === stats.period.to
              ? fmtDate(stats.period.from)
              : `${fmtDate(stats.period.from)} — ${fmtDate(stats.period.to)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {professionals.length > 0 && (
            <select
              value={proFilter}
              onChange={e => setProFilter(e.target.value)}
              className="rounded-lg border bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todos los profesionales</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          )}
          <div className="flex rounded-lg border bg-white p-0.5">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  period === p.value ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-gray-900',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<Calendar size={18} />}    label="Total Turnos"    value={kpis.totalAppointments} delta={kpis.appointmentsDelta} />
        <KpiCard icon={<Scissors size={18} />}     label="Servicios"       value={kpis.totalServices}      delta={kpis.servicesDelta} highlight />
        <KpiCard icon={<DollarSign size={18} />}   label="Ingresos"        value={kpis.revenue}            delta={kpis.revenueDelta} format="currency" onClick={() => setShowRevenue(true)} />
        <KpiCard icon={<Users size={18} />}        label="Clientes Únicos" value={kpis.uniqueClients}      delta={kpis.clientsDelta} />
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <RateCard label="Completados"    rate={rates.completion}   count={kpis.completedAppointments} color="green" />
        <RateCard label="Cancelaciones"  rate={rates.cancellation} count={kpis.cancelledAppointments} color="red" />
        <RateCard label="No-Show"        rate={rates.noShow}       count={kpis.noShowAppointments}    color="gray" />
        <RateCard
          label="Promedio diario"
          rate={null}
          count={kpis.totalAppointments > 0
            ? Math.round(kpis.totalAppointments / Math.max(1, daysBetween(stats.period.from, stats.period.to)))
            : 0}
          color="brand"
          suffix="turnos/día"
        />
      </div>

      {/* Evolution + Status Donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Evolución mensual" className="lg:col-span-2">
          {monthlyEvolution.some(m => m.appointments > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyEvolution.map(m => ({ ...m, label: fmtMonth(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="appointments" name="Turnos"     stroke={COLORS.brand} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.brand }} />
                <Line type="monotone" dataKey="services"     name="Servicios"  stroke={COLORS.blue}  strokeWidth={2}   dot={{ r: 3, fill: COLORS.blue }} />
                <Line type="monotone" dataKey="cancelled"    name="Cancelados" stroke={COLORS.red}   strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: COLORS.red }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text="Sin datos para el período" />}
        </Card>
        <Card title="Distribución por estado">
          {kpis.totalAppointments > 0 ? <StatusDonut kpis={kpis} /> : <Empty text="Sin turnos" />}
        </Card>
      </div>

      {/* Employee of Month + Top Pros + Top Services */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="" className="flex flex-col items-center justify-center text-center">
          {employeeOfMonth ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-md">
                <Trophy size={28} className="text-white" />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Empleado del mes</p>
              <div
                className="mt-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: employeeOfMonth.color ?? COLORS.brand }}
              >
                {ini(employeeOfMonth.displayName)}
              </div>
              <p className="mt-2 text-base font-bold text-gray-900">{employeeOfMonth.displayName}</p>
              <p className="text-sm text-gray-500">{employeeOfMonth.completedCount} completados de {employeeOfMonth.totalCount}</p>
              {employeeOfMonth.totalCount > 0 && (
                <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400" style={{ width: `${Math.round((employeeOfMonth.completedCount / employeeOfMonth.totalCount) * 100)}%` }} />
                </div>
              )}
            </>
          ) : <Empty text="Sin datos" />}
        </Card>

        <Card title="Top Profesionales">
          {topProfessionals.length > 0 ? (
            <div className="space-y-3">
              {topProfessionals.slice(0, 5).map((pro, i) => (
                <div key={pro.id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">{i + 1}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: pro.color ?? COLORS.brand }}>
                    {ini(pro.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{pro.displayName}</p>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${topProfessionals[0].completedCount > 0 ? Math.round((pro.completedCount / topProfessionals[0].completedCount) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-gray-700">{pro.completedCount}</span>
                </div>
              ))}
            </div>
          ) : <Empty text="Sin datos" />}
        </Card>

        <Card title="Servicios más solicitados">
          {topServices.length > 0 ? (
            <ResponsiveContainer width="100%" height={topServices.slice(0, 7).length * 36 + 8}>
              <BarChart data={topServices.slice(0, 7)} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="serviceName" width={110} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Cantidad" fill={COLORS.brand} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Sin datos" />}
        </Card>
      </div>

      {/* Peak Hours + Peak Days */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Horarios pico">
          <PeakHoursChart data={stats.appointmentsByHour} />
        </Card>
        <Card title="Días pico">
          <PeakDaysChart data={stats.appointmentsByDayOfWeek} />
        </Card>
      </div>

      {/* Revenue Detail Modal */}
      <Dialog open={showRevenue} onClose={() => setShowRevenue(false)} title="Detalle de ingresos" className="max-w-2xl">
        <RevenueDetail stats={stats} />
      </Dialog>

      {/* Clients */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Clientes nuevos vs recurrentes">
          <ClientsDonut clients={stats.clients} />
        </Card>
        <Card title="Ingresos por mes">
          {monthlyEvolution.some(m => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyEvolution.map(m => ({ ...m, label: fmtMonth(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip currency />} />
                <Bar dataKey="revenue" name="Ingresos" fill={COLORS.brand} radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text="Sin ingresos registrados" />}
        </Card>
      </div>
    </div>
  )
}

// ── Revenue Detail ──────────────────────────────────────────────────────────

const PM_CONFIG: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  CASH:        { label: 'Efectivo',        icon: Banknote,       color: 'text-green-600' },
  DEBIT_CARD:  { label: 'Tarjeta débito',  icon: CreditCard,     color: 'text-blue-600' },
  CREDIT_CARD: { label: 'Tarjeta crédito', icon: CreditCard,     color: 'text-purple-600' },
  TRANSFER:    { label: 'Transferencia',   icon: ArrowRightLeft, color: 'text-cyan-600' },
  MERCADOPAGO: { label: 'MercadoPago',     icon: Wallet,         color: 'text-sky-600' },
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function RevenueDetail({ stats }: { stats: DashboardStats }) {
  const [showDays, setShowDays] = useState(false)
  const { revenueByPaymentMethod, revenueByDay } = stats
  const totalRevenue = stats.kpis.revenue

  if (totalRevenue === 0 && revenueByPaymentMethod.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">Sin ingresos en el período</p>
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-green-600" />
          <span className="text-sm font-semibold text-gray-700">Total</span>
        </div>
        <p className="text-xl font-extrabold tabular-nums text-green-700">{fmtARS(totalRevenue)}</p>
      </div>

      {revenueByPaymentMethod.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Por medio de pago</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {revenueByPaymentMethod.map(pm => {
              const cfg = PM_CONFIG[pm.method]
              const Icon = cfg?.icon ?? DollarSign
              const pct = totalRevenue > 0 ? Math.round((pm.total / totalRevenue) * 100) : 0
              return (
                <div key={pm.method} className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon size={15} className={cfg?.color ?? 'text-gray-400'} />
                    <span className="text-xs text-gray-500 truncate">{cfg?.label ?? pm.method}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold tabular-nums text-gray-900">{fmtARS(pm.total)}</p>
                  <p className="text-[10px] text-gray-400">{pm.count} turno{pm.count !== 1 ? 's' : ''} · {pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {revenueByDay.length > 0 && (
        <div>
          <button
            onClick={() => setShowDays(d => !d)}
            className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-600"
          >
            Detalle por día
            {showDays ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showDays && (
            <div className="max-h-80 overflow-y-auto rounded-lg border">
              {revenueByDay.map(d => (
                <div key={d.date} className="border-b last:border-0">
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400">{d.count} turno{d.count !== 1 ? 's' : ''}</span>
                      <span className="text-xs font-bold tabular-nums text-gray-900">{fmtARS(d.total)}</span>
                    </div>
                  </div>
                  {d.byMethod.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-1.5">
                      {d.byMethod.map(pm => {
                        const cfg = PM_CONFIG[pm.method]
                        const Icon = cfg?.icon ?? DollarSign
                        return (
                          <div key={pm.method} className="flex items-center gap-1.5 text-[11px]">
                            <Icon size={12} className={cfg?.color ?? 'text-gray-400'} />
                            <span className="text-gray-500">{cfg?.label ?? pm.method}</span>
                            <span className="font-semibold tabular-nums text-gray-700">{fmtARS(pm.total)}</span>
                            <span className="text-gray-400">({pm.count})</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, delta, format, highlight, onClick }: {
  icon: React.ReactNode; label: string; value: number; delta: number
  format?: 'currency'; highlight?: boolean; onClick?: () => void
}) {
  const fmt = format === 'currency' ? `$${value.toLocaleString('es-AR')}` : value.toLocaleString('es-AR')
  const dFmt = format === 'currency'
    ? `${delta >= 0 ? '+' : ''}$${Math.abs(delta).toLocaleString('es-AR')}`
    : `${delta >= 0 ? '+' : ''}${delta}`

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5',
        highlight && 'border-brand-100 bg-brand-50/30',
        onClick && 'cursor-pointer ring-brand-500/40 hover:ring-2',
      )}
    >
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('mt-2 text-2xl font-extrabold tabular-nums sm:text-3xl', highlight ? 'text-brand-700' : 'text-gray-900')}>{fmt}</p>
      <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400')}>
        {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
        {dFmt} vs período anterior
      </div>
    </div>
  )
}

// ── Rate Card ────────────────────────────────────────────────────────────────

function RateCard({ label, rate, count, color, suffix }: {
  label: string; rate: number | null; count: number
  color: 'green' | 'red' | 'gray' | 'brand'; suffix?: string
}) {
  const cls = { green: 'text-green-500', red: 'text-red-500', gray: 'text-gray-400', brand: 'text-brand-500' }[color]
  const bg  = { green: 'bg-green-500', red: 'bg-red-500', gray: 'bg-gray-400', brand: 'bg-brand-500' }[color]

  return (
    <div className="rounded-xl border bg-white p-4 shadow-card sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-extrabold tabular-nums text-gray-900">{count}</span>
        {rate !== null && <span className={cn('mb-0.5 text-sm font-semibold', cls)}>{rate}%</span>}
        {suffix && <span className="mb-0.5 text-xs text-gray-400">{suffix}</span>}
      </div>
      {rate !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className={cn('h-full rounded-full transition-all', bg)} style={{ width: `${Math.min(rate, 100)}%` }} />
        </div>
      )}
    </div>
  )
}

// ── Donuts ────────────────────────────────────────────────────────────────────

function StatusDonut({ kpis }: { kpis: DashboardStats['kpis'] }) {
  const data = [
    { name: 'Completados', value: kpis.completedAppointments },
    { name: 'Confirmados', value: kpis.confirmedAppointments },
    { name: 'Pendientes',  value: kpis.pendingAppointments },
    { name: 'Cancelados',  value: kpis.cancelledAppointments },
    { name: 'No-Show',     value: kpis.noShowAppointments },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
            {data.map(d => <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? COLORS.gray} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] }} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  )
}

function ClientsDonut({ clients }: { clients: DashboardStats['clients'] }) {
  const total = clients.newClients + clients.recurringClients
  if (total === 0) return <Empty text="Sin clientes en el período" />

  const data = [
    { name: 'Nuevos',      value: clients.newClients,       color: COLORS.brand },
    { name: 'Recurrentes', value: clients.recurringClients, color: COLORS.blue },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
            {data.map(d => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-6">
        {data.map(d => (
          <div key={d.name} className="text-center">
            <p className="text-2xl font-bold text-gray-900">{d.value}</p>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Peak Charts ──────────────────────────────────────────────────────────────

function PeakHoursChart({ data }: { data: Array<{ hour: number; count: number }> }) {
  const filtered = data.filter(d => d.hour >= 7 && d.hour <= 21)
  if (filtered.every(d => d.count === 0)) return <Empty text="Sin datos" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={filtered.map(d => ({ ...d, label: `${d.hour}:00` }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="Turnos" fill={COLORS.brand} radius={[3, 3, 0, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function PeakDaysChart({ data }: { data: Array<{ day: number; count: number }> }) {
  if (data.every(d => d.count === 0)) return <Empty text="Sin datos" />
  const mx = Math.max(...data.map(d => d.count))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data.map(d => ({ ...d, label: DAY_LABELS[d.day] }))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="Turnos" radius={[4, 4, 0, 0]} barSize={36}>
          {data.map((d, i) => <Cell key={i} fill={d.count === mx ? COLORS.brand : '#d1d5db'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200/80 bg-white p-5 shadow-card', className)}>
      {title && <h3 className="mb-4 text-sm font-semibold text-gray-700">{title}</h3>}
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center py-10"><p className="text-sm text-gray-400">{text}</p></div>
}

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-semibold text-gray-900">{label}</p>}
      {payload.map((e: any) => (
        <p key={e.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-gray-500">{e.name}:</span>
          <span className="font-medium text-gray-900">
            {currency ? `$${Number(e.value).toLocaleString('es-AR')}` : e.value}
          </span>
        </p>
      ))}
    </div>
  )
}

function fmtMonth(key: string) { const [, m] = key.split('-').map(Number); return MONTH_SHORT[m - 1] ?? key }
function fmtDate(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) }
function daysBetween(a: string, b: string) { return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1) }
function ini(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
