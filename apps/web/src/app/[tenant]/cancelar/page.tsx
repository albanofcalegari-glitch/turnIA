import type { Metadata } from 'next'
import { CancelFlow } from '@/features/cancel/CancelFlow'

interface Props {
  params: { tenant: string }
}

export function generateMetadata({ params }: Props): Metadata {
  const name = params.tenant.replace(/-/g, ' ')
  return {
    title: `Cancelar turno — ${name}`,
  }
}

export default function CancelPage({ params }: Props) {
  return <CancelFlow tenantSlug={params.tenant} />
}
