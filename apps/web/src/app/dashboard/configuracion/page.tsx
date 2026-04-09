'use client'

import { useState, useEffect } from 'react'
import { Settings, Clock, Calendar, Users, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
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

// Allowed slot grid values, matching the typical UX of booking systems.
// Backend validates 5..120 but realistically only these make sense.
const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60] as const

export default function ConfiguracionPage() {
  const { user } = useAuth()
  const tenantSlug = user?.tenantSlug ?? ''

  const [config,  setConfig]  = useState<TenantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Inline edit state for the slot grid. We don't open a modal — the grid
  // selector lives next to the value and saves on change.
  const [editingSlot, setEditingSlot] = useState(false)
  const [savingSlot,  setSavingSlot]  = useState(false)
  const [slotError,   setSlotError]   = useState<string | null>(null)

  useEffect(() => {
    if (!tenantSlug) return
    setLoading(true)
    apiClient.getTenantBySlug(tenantSlug)
      .then(data => setConfig(data as unknown as TenantConfig))
      .catch(() => setError('No se pudo cargar la configuración.'))
      .finally(() => setLoading(false))
  }, [tenantSlug])

  async function handleSlotChange(newValue: number) {
    if (!config?.scheduleRules || newValue === config.scheduleRules.slotDurationMinutes) {
      setEditingSlot(false)
      return
    }
    setSavingSlot(true)
    setSlotError(null)
    try {
      await apiClient.updateMyScheduleRules({ slotDurationMinutes: newValue })
      setConfig({
        ...config,
        scheduleRules: { ...config.scheduleRules, slotDurationMinutes: newValue },
      })
      setEditingSlot(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo guardar el cambio.'
      setSlotError(msg)
    } finally {
      setSavingSlot(false)
    }
  }

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
              {/* Editable: slot grid */}
              <div className="flex flex-col gap-2 py-3 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <span className="text-sm text-gray-500">Grilla de la agenda</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Frecuencia con la que se ofrecen horarios (ej: 9:00, 9:15, 9:30...). La duración real del turno la define cada servicio.
                  </p>
                </div>
                <div className="sm:flex-shrink-0">
                  {editingSlot ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        defaultValue={rules.slotDurationMinutes}
                        disabled={savingSlot}
                        onChange={e => handleSlotChange(Number(e.target.value))}
                      >
                        {SLOT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>cada {opt} min</option>
                        ))}
                      </select>
                      {savingSlot && <Spinner size="sm" />}
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:text-gray-800"
                        onClick={() => { setEditingSlot(false); setSlotError(null) }}
                        disabled={savingSlot}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">cada {rules.slotDurationMinutes} min</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                        onClick={() => setEditingSlot(true)}
                      >
                        Cambiar
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {slotError && (
                <p className="px-1 pb-2 text-xs text-red-600">{slotError}</p>
              )}

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
            Más opciones de edición estarán disponibles próximamente.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Por ahora podés cambiar la grilla de la agenda. El resto se podrá editar pronto.
          </p>
        </div>
      </div>
    </div>
  )
}
