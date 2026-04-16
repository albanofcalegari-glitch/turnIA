'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Award, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, type MyLoyaltyCardResponse } from '@/lib/api'
import { LoyaltyCardView } from '@/features/loyalty/LoyaltyCardView'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Vista pública de la tarjeta de fidelidad del cliente logueado.
 * Si no está logueado, lo mandamos al login con return_to esta URL.
 * Si el cliente no tiene turnos en ese tenant todavía, mostramos un mensaje
 * invitándolo a reservar su primer turno.
 */
export default function MiTarjetaPage() {
  const { tenant } = useParams<{ tenant: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [data, setData] = useState<MyLoyaltyCardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/${tenant}/fidelidad`)}`)
      return
    }
    apiClient.getMyLoyaltyCard()
      .then(setData)
      .catch((e: any) => setError(e.message ?? 'No se pudo cargar la tarjeta'))
      .finally(() => setLoading(false))
  }, [authLoading, user, tenant, router])

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
        <Award size={40} className="mb-3 text-gray-300" />
        <h1 className="text-lg font-semibold text-gray-900">Tarjeta no disponible</h1>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        <Link
          href={`/${tenant}` as any}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Reservar un turno
        </Link>
      </div>
    )
  }

  if (!data) return null

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/fidelidad/${data.card.id}`
    : ''

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="mx-auto max-w-md">
        <LoyaltyCardView
          program={data.program}
          stampsCount={data.card.stampsCount}
          rewardsAvailable={data.card.rewardsAvailable}
          qrUrl={qrUrl}
          clientName={`${data.client.firstName} ${data.client.lastName}`}
          tenantName={tenant}
        />

        {data.card.rewardsAvailable > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900">
            <strong>¡Tenés {data.card.rewardsAvailable} premio{data.card.rewardsAvailable === 1 ? '' : 's'} disponible{data.card.rewardsAvailable === 1 ? '' : 's'}!</strong>{' '}
            Mostrá esta tarjeta cuando vengas al local para canjear.
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href={`/${tenant}` as any}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            ← Volver a reservar turnos
          </Link>
        </div>
      </div>
    </div>
  )
}
