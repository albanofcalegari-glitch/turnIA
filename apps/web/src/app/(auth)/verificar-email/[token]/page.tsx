'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

type State = 'loading' | 'ok' | 'error'

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    apiClient.verifyEmail(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-3xl font-bold text-brand-600">turnIT</span>
        </div>

        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          {state === 'loading' && (
            <>
              <div className="flex justify-center py-4"><Spinner /></div>
              <p className="text-sm text-gray-500">Verificando tu email…</p>
            </>
          )}
          {state === 'ok' && (
            <>
              <h1 className="mb-2 text-xl font-bold text-gray-900">¡Email verificado!</h1>
              <p className="mb-6 text-sm text-gray-500">
                Gracias por confirmar tu dirección.
              </p>
              <Link
                href="/dashboard"
                className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Ir al panel
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="mb-2 text-xl font-bold text-gray-900">Link inválido</h1>
              <p className="mb-6 text-sm text-gray-500">
                El link ya fue usado o no es válido. Podés seguir usando la app normalmente.
              </p>
              <Link
                href="/dashboard"
                className="inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Ir al panel
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
