'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, Users, Scissors, CreditCard, UserCheck,
  CheckCircle2, XCircle, Clock, AlertTriangle, Search, Eye,
  Building2, Globe, Star, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient, type AdminTenantDetail } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial', standard: 'Estándar', free: 'Free', starter: 'Starter', pro: 'Pro',
}
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  standard: 'bg-green-500/20 text-green-600 dark:text-green-400',
  pro: 'bg-brand-500/20 text-brand-700 dark:text-brand-400',
  free: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  starter: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
}
const TYPE_LABELS: Record<string, string> = {
  peluqueria: 'Peluquería', barberia: 'Barbería', spa: 'Spa', estetica: 'Estética', masajes: 'Masajes', custom: 'Otro',
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  CONFIRMED:   { label: 'Confirmado',   color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',  icon: CheckCircle2 },
  COMPLETED:   { label: 'Completado',   color: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400',  icon: CheckCircle2 },
  PENDING:     { label: 'Pendiente',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',  icon: Clock },
  CANCELLED:   { label: 'Cancelado',    color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',          icon: XCircle },
  NO_SHOW:     { label: 'No show',      color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-400',         icon: AlertTriangle },
  RESCHEDULED: { label: 'Reprogramado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',      icon: Calendar },
}

const PAY_STATUS_CFG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  approved: { label: 'Aprobado',    color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', icon: CheckCircle2 },
  rejected: { label: 'Rechazado',   color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',        icon: XCircle },
  refunded: { label: 'Reembolsado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400', icon: XCircle },
  pending:  { label: 'Pendiente',   color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-400',        icon: Clock },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',         icon: XCircle },
}

type Tab = 'turnos' | 'clientes' | 'pagos' | 'servicios' | 'profesionales'

const TABS: { key: Tab; label: string; icon: typeof Calendar }[] = [
  { key: 'turnos',        label: 'Turnos',        icon: Calendar },
  { key: 'clientes',      label: 'Clientes',      icon: Users },
  { key: 'pagos',         label: 'Pagos',         icon: CreditCard },
  { key: 'servicios',     label: 'Servicios',     icon: Scissors },
  { key: 'profesionales', label: 'Profesionales', icon: UserCheck },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtMoney(amount: string | number, currency = 'ARS') {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<AdminTenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('turnos')

  const [statusFilter, setStatusFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  useEffect(() => {
    apiClient.adminGetTenantDetail(params.id)
      .then(setData)
      .catch(() => setError('Error al cargar el negocio'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
  if (error || !data) return (
    <div className="py-16 text-center">
      <p className="text-red-500">{error ?? 'No encontrado'}</p>
      <Link href="/admin/negocios" className="mt-2 inline-block text-sm text-brand-600 hover:underline">Volver</Link>
    </div>
  )

  const { tenant, kpis } = data

  return (
    <div>
      {/* Back + Header */}
      <Link href="/admin/negocios" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
        <ArrowLeft size={16} /> Negocios
      </Link>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white text-lg font-bold',
              tenant.isActive ? 'bg-brand-600' : 'bg-gray-400')}>
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">{tenant.name}</h1>
                <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-medium', PLAN_COLORS[tenant.plan] ?? PLAN_COLORS.free)}>
                  {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                </span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                  tenant.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                )}>
                  {tenant.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                /{tenant.slug} · {TYPE_LABELS[tenant.type] ?? tenant.type} · Creado {fmtDate(tenant.createdAt)}
                {tenant.membershipExpiresAt && <> · Vence {fmtDate(tenant.membershipExpiresAt)}</>}
              </p>
            </div>
          </div>
          {tenant.subscription && (
            <div className="text-right text-xs text-gray-500 dark:text-gray-400">
              <p>Suscripción: <span className="font-medium text-gray-900 dark:text-white">{tenant.subscription.status}</span></p>
              <p>{fmtMoney(tenant.subscription.amount, tenant.subscription.currency)}/mes</p>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={Calendar} label="Turnos totales" value={kpis.totalAppointments} />
        <KpiCard icon={Calendar} label="Este mes" value={kpis.appointmentsThisMonth} accent />
        <KpiCard icon={Users} label="Clientes" value={kpis.totalClients} />
        <KpiCard icon={Scissors} label="Servicios activos" value={kpis.activeServices} />
        <KpiCard icon={UserCheck} label="Profesionales" value={kpis.activeProfessionals} />
        <KpiCard icon={Building2} label="Sucursales" value={tenant._count.branches} />
      </div>

      {/* Status breakdown */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = kpis.appointmentsByStatus[key] ?? 0
          return (
            <div key={key} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{count}</p>
              <p className="text-[10px] text-gray-500">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2',
              tab === t.key
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'turnos' && <TurnosTab appointments={data.appointments} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
      {tab === 'clientes' && <ClientesTab clients={data.clients} search={clientSearch} setSearch={setClientSearch} />}
      {tab === 'pagos' && <PagosTab payments={data.payments} />}
      {tab === 'servicios' && <ServiciosTab services={data.services} />}
      {tab === 'profesionales' && <ProfesionalesTab professionals={data.professionals} />}
    </div>
  )
}

/* ── KPI Card ────────────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, accent }: { icon: typeof Calendar; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={14} className={accent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'} />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold', accent ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-white')}>{value}</p>
    </div>
  )
}

/* ── Turnos Tab ──────────────────────────────────────────────────────────── */

function TurnosTab({ appointments, statusFilter, setStatusFilter }: {
  appointments: AdminTenantDetail['appointments']; statusFilter: string; setStatusFilter: (v: string) => void
}) {
  const filtered = useMemo(() =>
    statusFilter ? appointments.filter(a => a.status === statusFilter) : appointments,
    [appointments, statusFilter],
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{filtered.length} turnos</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Servicio(s)</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const cfg = STATUS_CFG[a.status]
              const clientName = a.client ? `${a.client.firstName} ${a.client.lastName}` : a.guestName ?? '-'
              return (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{fmtDateTime(a.startAt)}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{clientName}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{a.professional.displayName}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{a.items.map(i => i.serviceName).join(', ') || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{fmtMoney(a.totalPrice, a.currency)}</td>
                  <td className="px-4 py-3">
                    {cfg && (
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', cfg.color)}>
                        <cfg.icon size={12} /> {cfg.label}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Sin turnos</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Clientes Tab ────────────────────────────────────────────────────────── */

function ClientesTab({ clients, search, setSearch }: {
  clients: AdminTenantDetail['clients']; search: string; setSearch: (v: string) => void
}) {
  const filtered = useMemo(() => {
    if (!search) return clients
    const q = search.toLowerCase()
    return clients.filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    )
  }, [clients, search])

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} clientes</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3 text-center">Turnos</th>
              <th className="px-4 py-3">Última visita</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.email ?? '-'}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.phone ?? '-'}</td>
                <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{c._count.appointments}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.lastVisit ? fmtDate(c.lastVisit) : '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Sin clientes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Pagos Tab ───────────────────────────────────────────────────────────── */

function PagosTab({ payments }: { payments: AdminTenantDetail['payments'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Monto</th>
            <th className="px-4 py-3">Método</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">MP ID</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => {
            const cfg = PAY_STATUS_CFG[p.status]
            return (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{fmtMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.paymentMethod ?? '-'}</td>
                <td className="px-4 py-3">
                  {cfg && (
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', cfg.color)}>
                      <cfg.icon size={12} /> {cfg.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.mpPaymentId}</td>
              </tr>
            )
          })}
          {payments.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Sin pagos registrados</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Servicios Tab ───────────────────────────────────────────────────────── */

function ServiciosTab({ services }: { services: AdminTenantDetail['services'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Duración</th>
            <th className="px-4 py-3">Precio</th>
            <th className="px-4 py-3">Categoría</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {services.map(s => (
            <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.durationMinutes} min</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmtMoney(s.price, s.currency)}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.category?.name ?? '-'}</td>
              <td className="px-4 py-3">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium',
                  s.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                )}>
                  {s.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
          {services.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Sin servicios</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ── Profesionales Tab ───────────────────────────────────────────────────── */

function ProfesionalesTab({ professionals }: { professionals: AdminTenantDetail['professionals'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3 text-center">Servicios</th>
            <th className="px-4 py-3 text-center">Turnos</th>
            <th className="px-4 py-3">Booking online</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {professionals.map(p => (
            <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: p.color ?? '#7c3aed' }}>
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{p.displayName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{p._count.services}</td>
              <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{p._count.appointments}</td>
              <td className="px-4 py-3">
                <span className={cn('text-xs', p.acceptsOnlineBooking ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}>
                  {p.acceptsOnlineBooking ? 'Sí' : 'No'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium',
                  p.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                )}>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
          {professionals.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Sin profesionales</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
