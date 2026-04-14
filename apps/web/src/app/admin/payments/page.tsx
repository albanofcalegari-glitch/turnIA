'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Users, TrendingUp, AlertTriangle, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { apiClient, type AdminPayment, type PaymentMetrics } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = [
  { value: '',          label: 'Todos' },
  { value: 'approved',  label: 'Aprobados' },
  { value: 'rejected',  label: 'Rechazados' },
  { value: 'refunded',  label: 'Reembolsados' },
  { value: 'pending',   label: 'Pendientes' },
]

export default function AdminPaymentsPage() {
  const [metrics, setMetrics]   = useState<PaymentMetrics | null>(null)
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [m, p] = await Promise.all([
        apiClient.adminGetPaymentMetrics(),
        apiClient.adminGetPayments({
          status: filterStatus || undefined,
          from:   filterFrom   || undefined,
          to:     filterTo     || undefined,
        }),
      ])
      setMetrics(m)
      setPayments(p)
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar pagos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus, filterFrom, filterTo])

  if (loading && !metrics) {
    return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">Pagos &amp; suscripciones</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {metrics && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          <MetricCard icon={TrendingUp}    label="MRR"              value={`$${metrics.mrr.toLocaleString('es-AR')}`}                     color="text-brand-600" />
          <MetricCard icon={Users}         label="Suscripciones"    value={metrics.activeSubscriptions}                                   color="text-green-600" />
          <MetricCard icon={DollarSign}    label="Cobrado (mes)"    value={`$${metrics.collectedThisMonth.toLocaleString('es-AR')}`}      color="text-gray-900" />
          <MetricCard icon={Calendar}      label="Pagos (mes)"      value={metrics.paymentsThisMonth}                                     color="text-gray-900" />
          <MetricCard icon={AlertTriangle} label="Fallidos (30d)"   value={metrics.failedLast30d}                                         color="text-red-600"   />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Estado</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Desde</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Hasta</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        {(filterStatus || filterFrom || filterTo) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterFrom(''); setFilterTo('') }}
            className="self-end rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <DollarSign size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay pagos registrados</p>
          <p className="text-xs text-gray-400">Los pagos aparecen acá cuando Mercado Pago nos los notifica por webhook.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Negocio</th>
                <th className="px-4 py-3 text-left font-medium">Monto</th>
                <th className="px-4 py-3 text-left font-medium">Método</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">MP ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.tenant.name}</div>
                    <div className="text-xs text-gray-400">/{p.tenant.slug}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${Number(p.amount).toLocaleString('es-AR')} {p.currency}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">
                    {p.paymentMethod ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} detail={p.statusDetail} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.mpPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color?: string
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={color ?? 'text-gray-400'} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={cn('mt-1 text-xl font-bold sm:text-2xl', color ?? 'text-gray-900')}>{value}</p>
    </div>
  )
}

function StatusBadge({ status, detail }: { status: string; detail: string | null }) {
  const map: Record<string, { label: string; icon: any; cls: string }> = {
    approved: { label: 'Aprobado',     icon: CheckCircle2, cls: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rechazado',    icon: XCircle,      cls: 'bg-red-50 text-red-700' },
    refunded: { label: 'Reembolsado',  icon: XCircle,      cls: 'bg-gray-100 text-gray-700' },
    pending:  { label: 'Pendiente',    icon: Clock,        cls: 'bg-amber-50 text-amber-700' },
    cancelled:{ label: 'Cancelado',    icon: XCircle,      cls: 'bg-gray-100 text-gray-700' },
  }
  const entry = map[status] ?? { label: status, icon: Clock, cls: 'bg-gray-100 text-gray-700' }
  const Icon  = entry.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', entry.cls)} title={detail ?? undefined}>
      <Icon size={12} />
      {entry.label}
    </span>
  )
}
