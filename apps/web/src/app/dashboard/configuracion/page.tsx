'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Clock, Calendar, Users, Shield, Award } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError, type LoyaltyProgram, type CalendarStatus } from '@/lib/api'
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

  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null)
  const [savingLoyalty,  setSavingLoyalty]   = useState(false)

  const [googleCal,  setGoogleCal]  = useState<CalendarStatus | null>(null)
  const [outlookCal, setOutlookCal] = useState<CalendarStatus | null>(null)
  const [calLoading, setCalLoading] = useState(false)
  const [calMsg,     setCalMsg]     = useState<string | null>(null)

  const handleCalendarCallback = useCallback(async () => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    if (!code || !state) return

    window.history.replaceState({}, '', window.location.pathname)
    setCalLoading(true)
    try {
      const isOutlook = params.get('session_state') !== null
      if (isOutlook) {
        const res = await apiClient.connectOutlookCalendar(code)
        setOutlookCal({ available: true, connected: true, email: res.email, enabled: true })
        setCalMsg(`Outlook Calendar conectado: ${res.email}`)
      } else {
        const res = await apiClient.connectGoogleCalendar(code)
        setGoogleCal({ available: true, connected: true, email: res.email, enabled: true })
        setCalMsg(`Google Calendar conectado: ${res.email}`)
      }
    } catch {
      setCalMsg('Error al conectar el calendario. Intentá de nuevo.')
    } finally {
      setCalLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!tenantSlug) return
    setLoading(true)
    Promise.all([
      apiClient.getTenantBySlug(tenantSlug),
      apiClient.getLoyaltyProgram().catch(() => null),
    ])
      .then(([data, lp]) => {
        setConfig(data as unknown as TenantConfig)
        setLoyaltyProgram(lp)
      })
      .catch(() => setError('No se pudo cargar la configuración.'))
      .finally(() => setLoading(false))

    Promise.all([
      apiClient.getGoogleCalendarStatus().catch(() => null),
      apiClient.getOutlookCalendarStatus().catch(() => null),
    ]).then(([g, o]) => {
      setGoogleCal(g)
      setOutlookCal(o)
    })

    handleCalendarCallback()
  }, [tenantSlug, handleCalendarCallback])

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

  function detectProvider(): 'google' | 'outlook' | null {
    const email = user?.email?.toLowerCase() ?? ''
    if (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com')) return 'google'
    if (email.endsWith('@hotmail.com') || email.endsWith('@outlook.com') || email.endsWith('@live.com') || email.endsWith('@msn.com')) return 'outlook'
    return null
  }

  const detectedProvider = detectProvider()
  const showGoogle  = (googleCal?.available && detectedProvider === 'google') || googleCal?.connected
  const showOutlook = (outlookCal?.available && detectedProvider === 'outlook') || outlookCal?.connected

  async function connectCalendar(provider: 'google' | 'outlook') {
    setCalLoading(true)
    try {
      const { url } = provider === 'google'
        ? await apiClient.getGoogleCalendarAuthUrl()
        : await apiClient.getOutlookCalendarAuthUrl()
      window.location.href = url
    } catch {
      setCalLoading(false)
    }
  }

  async function disconnectCalendar(provider: 'google' | 'outlook') {
    setCalLoading(true)
    try {
      if (provider === 'google') {
        await apiClient.disconnectGoogleCalendar()
        setGoogleCal(prev => ({ ...prev!, available: prev?.available ?? false, connected: false, email: null, enabled: false }))
      } else {
        await apiClient.disconnectOutlookCalendar()
        setOutlookCal(prev => ({ ...prev!, available: prev?.available ?? false, connected: false, email: null, enabled: false }))
      }
    } catch { /* fail silently */ }
    finally { setCalLoading(false) }
  }

  async function toggleLoyalty(field: 'isActive' | 'showOnBooking') {
    if (!loyaltyProgram || savingLoyalty) return
    setSavingLoyalty(true)
    try {
      const updated = await apiClient.updateLoyaltyProgram({ [field]: !loyaltyProgram[field] })
      setLoyaltyProgram(updated)
    } catch { /* fail silently */ }
    finally { setSavingLoyalty(false) }
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
        <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
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
          <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
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
          <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
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

        {/* Calendar integration — only shown if credentials are configured on the server */}
        {(showGoogle || showOutlook) && (
          <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Sincronización de calendario</h2>
            </div>

            {calMsg && (
              <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${calMsg.includes('Error') ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-green-200 bg-green-50 text-green-700'}`}>
                {calMsg}
              </div>
            )}

            <div className="px-1 space-y-3">
              {/* Google Calendar */}
              {showGoogle && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 font-medium">Google Calendar</span>
                    {googleCal?.connected
                      ? <p className="text-xs text-green-600 mt-0.5">Conectado: {googleCal.email}</p>
                      : <p className="text-xs text-gray-400 mt-0.5">Sincronizá los turnos con tu Google Calendar</p>
                    }
                  </div>
                  <div className="flex-shrink-0">
                    {googleCal?.connected ? (
                      <button
                        onClick={() => disconnectCalendar('google')}
                        disabled={calLoading}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => connectCalendar('google')}
                        disabled={calLoading}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {calLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Outlook Calendar */}
              {showOutlook && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700 font-medium">Outlook Calendar</span>
                    {outlookCal?.connected
                      ? <p className="text-xs text-green-600 mt-0.5">Conectado: {outlookCal.email}</p>
                      : <p className="text-xs text-gray-400 mt-0.5">Sincronizá los turnos con tu Outlook Calendar</p>
                    }
                  </div>
                  <div className="flex-shrink-0">
                    {outlookCal?.connected ? (
                      <button
                        onClick={() => disconnectCalendar('outlook')}
                        disabled={calLoading}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => connectCalendar('outlook')}
                        disabled={calLoading}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {calLoading ? 'Conectando...' : 'Conectar'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Loyalty program */}
        {loyaltyProgram && (
          <section className="rounded-xl border border-gray-200/80 bg-white p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Award size={16} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Club de Fidelidad</h2>
            </div>
            <div className="px-1">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <span className="text-sm text-gray-500">Programa activo</span>
                  <p className="text-xs text-gray-400 mt-0.5">Los clientes acumulan sellos al completar turnos</p>
                </div>
                <button
                  onClick={() => toggleLoyalty('isActive')}
                  disabled={savingLoyalty}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                    loyaltyProgram.isActive ? 'bg-brand-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    loyaltyProgram.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm text-gray-500">Mostrar tarjeta en reserva</span>
                  <p className="text-xs text-gray-400 mt-0.5">Se muestra la tarjeta de fidelidad en la página de reserva pública</p>
                </div>
                <button
                  onClick={() => toggleLoyalty('showOnBooking')}
                  disabled={savingLoyalty || !loyaltyProgram.isActive}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                    loyaltyProgram.showOnBooking && loyaltyProgram.isActive ? 'bg-brand-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    loyaltyProgram.showOnBooking && loyaltyProgram.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
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
