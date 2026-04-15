'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock } from 'lucide-react'
import { apiClient } from '@/lib/api'

/**
 * Landing page MP redirects to after the admin authorises the subscription.
 * MP doesn't send the authoritative "paid" signal here — that comes through
 * the webhook a few seconds later. We poll /subscriptions/me briefly so the
 * user sees their status flip from "pending" to "authorized" without a
 * manual refresh.
 */
export default function SubscriptionCallbackPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'waiting' | 'authorized' | 'timeout'>('waiting')

  // MP appends ?preapproval_id=... and ?status=... to the back_url.
  // We don't really trust them (they're user-manipulable) — the webhook is
  // the source of truth — but we can use them to show the right copy.
  const mpStatus = searchParams.get('status') ?? 'pending'

  useEffect(() => {
    let cancelled = false
    let tries = 0

    async function poll() {
      if (cancelled) return
      try {
        const sub = await apiClient.getMySubscription()
        if (sub?.status === 'authorized') {
          setStatus('authorized')
          return
        }
      } catch { /* ignore */ }
      tries++
      if (tries < 10) {
        setTimeout(poll, 1500)
      } else {
        setStatus('timeout')
      }
    }
    poll()

    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm sm:p-8">
        {status === 'authorized' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="text-green-600" size={28} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">¡Suscripción activa!</h1>
            <p className="mt-2 text-sm text-gray-600">
              Recibimos tu pago y tu cuenta ya está al día. Recibirás un email de Mercado Pago con el comprobante.
            </p>
          </>
        ) : status === 'timeout' ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <Clock className="text-amber-600" size={28} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Procesando...</h1>
            <p className="mt-2 text-sm text-gray-600">
              Mercado Pago todavía no nos confirmó el pago. Revisá el estado en unos minutos — si se confirma, tu cuenta se activa sola.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
              <Clock className="text-brand-600 animate-pulse" size={28} />
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">Confirmando pago...</h1>
            <p className="mt-2 text-sm text-gray-600">
              Esperando la confirmación de Mercado Pago. Esto puede tardar unos segundos.
            </p>
          </>
        )}

        <button
          onClick={() => router.push('/dashboard/suscripcion' as any)}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Ir a mi suscripción
        </button>

        {mpStatus && (
          <p className="mt-4 text-[10px] uppercase tracking-wider text-gray-400">
            estado mp: {mpStatus}
          </p>
        )}
      </div>
    </div>
  )
}
