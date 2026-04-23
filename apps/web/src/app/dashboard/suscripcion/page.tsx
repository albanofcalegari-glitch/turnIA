'use client'

import { useEffect, useState } from 'react'
import { CreditCard, CheckCircle2, AlertTriangle, XCircle, Clock, Users, Zap } from 'lucide-react'
import { apiClient, type MySubscription } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/components/ui/Dialog'
import { PLANS } from '@turnia/shared'

type Tier = 'standard' | 'pro'

export default function SuscripcionPage() {
  const { user } = useAuth()
  const [sub, setSub]           = useState<MySubscription | null>(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmit] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [profCount, setProfCount] = useState(0)
  const [requiredTier, setRequiredTier] = useState<Tier>('standard')
  const { confirm, element: confirmDialog } = useConfirm()

  useEffect(() => {
    Promise.all([
      apiClient.getMySubscription(),
      apiClient.getPlanRequirement(),
    ])
      .then(([s, req]) => {
        setSub(s)
        setProfCount(req.profCount)
        setRequiredTier(req.requiredTier)
      })
      .catch(err => setError(err?.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  const expiresAt = user?.tenantMembershipExpiresAt ? new Date(user.tenantMembershipExpiresAt) : null
  const now       = new Date()
  const daysLeft  = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
  const isTrial   = !sub || sub.status === 'cancelled' || sub.status === 'pending'
  const currentPlan = user?.tenantPlan ?? 'trial'

  async function handleSubscribe(tier: Tier) {
    setSubmit(true); setError(null)
    try {
      const res = await apiClient.subscribe(tier)
      window.location.href = res.initPoint
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo iniciar la suscripción')
      setSubmit(false)
    }
  }

  async function handleCancel() {
    const ok = await confirm({
      title:       'Cancelar suscripción',
      message:     'No te vamos a cobrar más, pero el servicio sigue activo hasta el próximo vencimiento.',
      confirmText: 'Cancelar suscripción',
      cancelText:  'Volver',
      variant:     'danger',
    })
    if (!ok) return
    setSubmit(true); setError(null)
    try {
      await apiClient.cancelSubscription()
      const fresh = await apiClient.getMySubscription()
      setSub(fresh)
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo cancelar')
    } finally {
      setSubmit(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  return (
    <div className="max-w-4xl space-y-6">
      {confirmDialog}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Suscripción</h1>
        <p className="mt-1 text-sm text-gray-500">Gestión de tu plan y pagos</p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Estado actual */}
      <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plan actual</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              {sub && sub.status === 'authorized'
                ? (currentPlan === 'pro' ? PLANS.pro.label : PLANS.standard.label)
                : 'Prueba gratuita'}
            </h2>
            {sub && sub.status === 'authorized' ? (
              <p className="mt-1 text-sm text-gray-600">
                ${Number(sub.amount).toLocaleString('es-AR')} ARS / mes · Cobro automático
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                {daysLeft !== null && daysLeft > 0
                  ? <>Te quedan <strong className="text-brand-700">{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</strong> de prueba</>
                  : 'Tu prueba finalizó'}
              </p>
            )}
          </div>
          <StatusPill status={sub?.status ?? 'trial'} />
        </div>

        {expiresAt && (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Clock size={14} />
            Vencimiento: <strong>{expiresAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          </div>
        )}

        {sub?.status === 'authorized' && user?.role === 'ADMIN' && (
          <div className="mt-5 border-t pt-5">
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Cancelar suscripción
            </button>
          </div>
        )}

        {sub?.status === 'pending' && (
          <div className="mt-5 border-t pt-5 flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle size={16} />
            Esperando confirmación de pago de Mercado Pago...
            {sub.initPoint && (
              <a href={sub.initPoint} className="ml-2 inline-flex items-center rounded-md border border-brand-300 bg-white px-3 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50">
                Reanudar pago →
              </a>
            )}
          </div>
        )}
      </section>

      {/* Plan cards */}
      {isTrial && user?.role === 'ADMIN' && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Elegí tu plan</h2>
          {requiredTier === 'pro' && (
            <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              Tenés <strong>{profCount} profesionales</strong> activos. Necesitás el plan <strong>Pro</strong> para mantenerlos.
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanCard
              tier="standard"
              icon={<Users size={20} />}
              features={[
                '1 profesional',
                'Turnos ilimitados',
                'Programa de fidelidad',
                'Reportes',
              ]}
              onSubscribe={() => handleSubscribe('standard')}
              submitting={submitting}
              disabled={requiredTier === 'pro'}
              disabledReason={`Tenés ${profCount} profesionales — necesitás Pro`}
            />
            <PlanCard
              tier="pro"
              icon={<Zap size={20} />}
              features={[
                'Profesionales ilimitados',
                'Servicios ilimitados',
                'Turnos ilimitados',
                'Programa de fidelidad',
                'Reportes y métricas',
              ]}
              recommended={requiredTier === 'pro'}
              onSubscribe={() => handleSubscribe('pro')}
              submitting={submitting}
            />
          </div>
        </section>
      )}

      {isTrial && user?.role !== 'ADMIN' && (
        <p className="text-xs text-gray-500">Solo el administrador del negocio puede contratar la suscripción.</p>
      )}

      {/* Historial de pagos */}
      {sub && sub.payments.length > 0 && (
        <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">Historial de pagos</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium">Fecha</th>
                  <th className="py-2 pr-4 text-left font-medium">Monto</th>
                  <th className="py-2 pr-4 text-left font-medium">Método</th>
                  <th className="py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sub.payments.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 text-gray-700">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      ${Number(p.amount).toLocaleString('es-AR')} {p.currency}
                    </td>
                    <td className="py-3 pr-4 capitalize text-gray-600">
                      {p.paymentMethod ?? '—'}
                    </td>
                    <td className="py-3">
                      <PaymentStatus status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function PlanCard({ tier, icon, features, recommended, onSubscribe, submitting, disabled, disabledReason }: {
  tier:            Tier
  icon:            React.ReactNode
  features:        string[]
  recommended?:    boolean
  onSubscribe:     () => void
  submitting:      boolean
  disabled?:       boolean
  disabledReason?: string
}) {
  const plan = PLANS[tier]
  return (
    <div className={`relative flex flex-col rounded-xl border p-6 shadow-card transition-all duration-200 hover:shadow-card-hover ${recommended ? 'border-brand-400 ring-2 ring-brand-100 bg-gradient-to-b from-brand-50/40 to-white' : 'border-gray-200 bg-white'} ${disabled ? 'opacity-60' : ''}`}>
      {recommended && (
        <span className="absolute -top-3 left-4 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
          Recomendado
        </span>
      )}
      <div className="flex items-center gap-2.5 text-gray-900">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${recommended ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-600'}`}>
          {icon}
        </div>
        <h3 className="text-lg font-bold">{plan.label}</h3>
      </div>
      <p className="mt-4 text-3xl font-extrabold tabular-nums text-gray-900">
        ${plan.amount.toLocaleString('es-AR')}
        <span className="text-sm font-normal text-gray-400"> / mes</span>
      </p>
      <div className="my-5 h-px bg-gray-100" />
      <ul className="flex-1 space-y-2.5">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
            <CheckCircle2 size={15} className="shrink-0 text-brand-500" />
            {f}
          </li>
        ))}
      </ul>
      {disabled && disabledReason ? (
        <p className="mt-6 text-center text-xs text-gray-500">{disabledReason}</p>
      ) : (
        <button
          onClick={onSubscribe}
          disabled={submitting}
          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
            recommended
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-sm hover:from-brand-700 hover:to-brand-600'
              : 'border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50'
          }`}
        >
          <CreditCard size={16} />
          {submitting ? 'Redirigiendo...' : 'Suscribirme'}
        </button>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    authorized: { label: 'Activa',     cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
    pending:    { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    paused:     { label: 'Pausada',    cls: 'bg-gray-50 text-gray-700 border-gray-200',     dot: 'bg-gray-400' },
    cancelled:  { label: 'Cancelada',  cls: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500' },
    trial:      { label: 'Prueba',     cls: 'bg-brand-50 text-brand-700 border-brand-200',   dot: 'bg-brand-500' },
  }
  const { label, cls, dot } = map[status] ?? map.trial
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

function PaymentStatus({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} />Aprobado</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-red-700"><XCircle size={14} />Rechazado</span>
  if (status === 'refunded') return <span className="inline-flex items-center gap-1 text-gray-600"><XCircle size={14} />Reembolsado</span>
  return <span className="inline-flex items-center gap-1 text-amber-700"><Clock size={14} />{status}</span>
}
