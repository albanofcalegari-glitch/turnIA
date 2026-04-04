import type { Metadata } from 'next'
import { BookingFlow } from '@/features/booking/BookingFlow'

interface Props {
  params: { tenant: string }
}

/**
 * Dynamic metadata — the page title uses the tenant slug while the real
 * tenant name is loaded client-side. For full SSR metadata, a server-side
 * fetch can be added here once the environment is stable.
 */
export function generateMetadata({ params }: Props): Metadata {
  const name = params.tenant.replace(/-/g, ' ')
  return {
    title: `Reservar turno — ${name}`,
    description: `Reservá tu turno en ${name} de forma rápida y sencilla.`,
  }
}

/**
 * Public booking page for a tenant.
 *
 * URL patterns supported:
 *   turnia.com/mi-peluqueria         → params.tenant = "mi-peluqueria"
 *   mi-peluqueria.turnia.com         → (subdomain routing, same slug via middleware)
 *
 * This is a Server Component — it passes the slug to the BookingFlow Client
 * Component which handles all data fetching and interactive state.
 */
export default function TenantBookingPage({ params }: Props) {
  return <BookingFlow tenantSlug={params.tenant} />
}
