'use client'

import { useState, useEffect } from 'react'
import { Settings, Clock, Calendar, Users, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TenantConfig {
  id:       string
  name:     string
  slug:     string
  type:     string
  timezone: string
  phone:    string | null
  address:  string | null
  scheduleRules: {
    slotDurationMinutes: number
    bookingWindowDays:   number
    minAdvanceMinutes:   number
    cancelHoursMin:      number
    rescheduleHoursMin:  number
    allowGuestBooking:   boolean
    autoConfirm:         boolean
  } | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BUSINESS_TYPES: Record<string, string> = {
  peluqueria: 'Peluquería',
  barberia:   'Barbería',
  spa:        'Spa',
  estetica:   'Centro de estética',
  masajes:    'Masajes',
  custom:     'Otro',
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <span className="text-sm text-gray-500">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <span className="text-sm font-medium text-gray-900 sm:text-right sm:flex-shrink-0">{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const tenantSlug = user?.tenantSlug ?? ''

  const [config,  setConfig]  = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!tenantSlug) return
    setLoading(true)
    apiClient.getTenantBySlug(tenantSlug)
      .then(data => setConfig(data as unknown as TenantConfig))
      .catch(() => setError('No se pudo cargar la configuración.'))
      .finally(() => setLoading(false))
  }, [tenantSlug])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !config) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>
        <div className="rounded-xl border bg-white p-6 text-center">
          <p className="text-sm text-red-600">{error ?? 'No se encontró la configuración.'}</p>
        </div>
      </div>
    )
  }

  const rules = config.scheduleRules

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>

      <div className="space-y-6">
        {/* Business info */}
        <section className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Datos del negocio</h2>
          </div>
          <div className="px-1">
            <InfoRow label="Nombre" value={config.name} />
            <InfoRow label="Identificador (URL)" value={config.slug} />
            <InfoRow label="Tipo" value={BUSINESS_TYPES[config.type] ?? config.type} />
            <InfoRow label="Zona horaria" value={config.timezone} />
            <InfoRow label="Teléfono" value={config.phone ?? 'No configurado'} />
            <InfoRow label="Dirección" value={config.address ?? 'No configurada'} />
          </div>
        </section>

        {/* Schedule rules */}
        {rules && (
          <section className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Reglas de agenda</h2>
            </div>
            <div className="px-1">
              <InfoRow label="Grilla de la agenda" value={`cada ${rules.slotDurationMinutes} min`} hint="Frecuencia con la que se ofrecen horarios (ej: 9:00, 9:15, 9:30...). La duración real del turno la define cada servicio." />
              <InfoRow label="Ventana de reserva" value={`${rules.bookingWindowDays} días`} />
              <InfoRow label="Anticipación mínima" value={`${rules.minAdvanceMinutes} minutos`} />
              <InfoRow label="Cancelación mínima" value={`${rules.cancelHoursMin} horas antes`} />
              <InfoRow label="Reprogramación mínima" value={`${rules.rescheduleHoursMin} horas antes`} />
            </div>
          </section>
        )}

        {/* Booking policies */}
        {rules && (
          <section className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Políticas de reserva</h2>
            </div>
            <div className="px-1">
              <InfoRow label="Reservas de invitados" value={rules.allowGuestBooking ? 'Permitidas' : 'Solo usuarios registrados'} />
              <InfoRow label="Confirmación automática" value={rules.autoConfirm ? 'Sí — turnos se confirman al reservar' : 'No — requiere confirmación manual'} />
            </div>
          </section>
        )}

        {/* Coming soon banner */}
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-600">
            La edición de configuración estará disponible próximamente.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Por ahora podés ver los valores actuales de tu negocio.
          </p>
        </div>
      </div>
    </div>
  )
}
