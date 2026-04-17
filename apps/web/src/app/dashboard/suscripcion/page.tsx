'use client'

import { useEffect, useState } from 'react'
import { CreditCard, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { apiClient, type MySubscription } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const PLAN_AMOUNT = 60_000
const PLAN_DISPLAY = PLAN_AMOUNT.toLocaleString('es-AR')
const PLAN_LABEL  = 'Estándar'

export default function SuscripcionPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [sub, setSub]           = useState<MySubscription | null>(null)
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmit] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    apiClient.getMySubscription()
      .then(setSub)
      .catch(err => setError(err?.message ?? 'Error'))
      .finally(() => setLoading(false))
  }, [])

  const expiresAt = user?.tenantMembershipExpiresAt ? new Date(user.tenantMembershipExpiresAt) : null
  const now       = new Date()
  const daysLeft  = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
  const isTrial   = !sub || sub.status === 'cancelled'

  async function handleSubscribe() {
    setSubmit(true); setError(null)
    try {
      const res = await apiClient.subscribe()
      // MP takes the user to their hosted checkout. On success they come back
      // to /dashboard/suscripcion/callback.
      window.location.href = res.initPoint
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo iniciar la suscripción')
      setSubmit(false)
    }
  }

  async function handleCancel() {
    const ok = await confirm({
      title:       'Cancelar suscripción',
      message:     '¿Cancelar la suscripción? No te vamos a cobrar más, pero el servicio sigue activo hasta el próximo vencimiento.',
      confirmText: 'Cancelar suscripción',
      cancelText:  'Volver',
      variant:     'danger',
    })
    if (!ok) return
    setSubmit(true); setError(null)
    try {
      const updated = await apiClient.cancelSubscription() as any
      // Response shape: single subscription row; refetch to include payments
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
    <div className="max-w-3xl space-y-6">
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
      <section className="rounded-xl border bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plan actual</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              {sub && sub.status === 'authorized' ? PLAN_LABEL : 'Prueba gratuita'}
            </h2>
            {sub && sub.status === 'authorized' ? (
              <p className="mt-1 text-sm text-gray-600">
                ${PLAN_DISPLAY} ARS / mes · Cobro automático
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

        {/* CTA principal */}
        <div className="mt-5 border-t pt-5">
          {isTrial && user?.role === 'ADMIN' && (
            <button
              onClick={handleSubscribe}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={16} />
              {submitting ? 'Redirigiendo a Mercado Pago...' : `Suscribirme por $${PLAN_DISPLAY}/mes`}
            </button>
          )}
          {isTrial && user?.role !== 'ADMIN' && (
            <p className="text-xs text-gray-500">Solo el administrador del negocio puede contratar la suscripción.</p>
          )}
          {sub?.status === 'authorized' && user?.role === 'ADMIN' && (
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Cancelar suscripción
            </button>
          )}
          {sub?.status === 'pending' && (
            <div className="flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle size={16} />
              Esperando confirmación de pago de Mercado Pago...
              {sub.initPoint && (
                <a href={sub.initPoint} className="ml-2 font-medium text-brand-600 hover:underline">
                  Reanudar pago →
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Historial de pagos */}
      {sub && sub.payments.length > 0 && (
        <section className="rounded-xl border bg-white p-5 sm:p-6">
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    authorized: { label: 'Activa',     cls: 'bg-green-50 text-green-700' },
    pending:    { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700' },
    paused:     { label: 'Pausada',    cls: 'bg-gray-100 text-gray-700' },
    cancelled:  { label: 'Cancelada',  cls: 'bg-red-50 text-red-700' },
    trial:      { label: 'Prueba',     cls: 'bg-brand-50 text-brand-700' },
  }
  const { label, cls } = map[status] ?? map.trial
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>
}

function PaymentStatus({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={14} />Aprobado</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-red-700"><XCircle size={14} />Rechazado</span>
  if (status === 'refunded') return <span className="inline-flex items-center gap-1 text-gray-600"><XCircle size={14} />Reembolsado</span>
  return <span className="inline-flex items-center gap-1 text-amber-700"><Clock size={14} />{status}</span>
}
