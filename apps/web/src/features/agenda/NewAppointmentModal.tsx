'use client'

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { X, Search, User, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient, ApiError, type ClientSearchResult } from '@/lib/api'
import type { Service, Professional } from '@/features/booking/booking.types'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

interface Props {
  tenantId: string
  onCreated: () => void
  onClose: () => void
}

export function NewAppointmentModal({ tenantId, onCreated, onClose }: Props) {
  // Data
  const [services,      setServices]      = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [slots,         setSlots]         = useState<{ startAt: string; endAt: string }[]>([])

  // Selection state
  const [selectedServiceId,  setSelectedServiceId]  = useState('')
  const [selectedProfId,     setSelectedProfId]     = useState('')
  const [selectedDate,       setSelectedDate]       = useState('')
  const [selectedSlot,       setSelectedSlot]       = useState('')
  const [notes,              setNotes]              = useState('')

  // Client resolution
  const [clientMode,    setClientMode]    = useState<'existing' | 'new'>('existing')
  const [clientSearch,  setClientSearch]  = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null)
  const [searching,     setSearching]     = useState(false)
  const [showDropdown,  setShowDropdown]  = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // New client fields
  const [newName,  setNewName]  = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')

  // UI state
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // ── Load services + professionals ─────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return
    apiClient.getServices(tenantId).then(s => setServices(s as unknown as Service[])).catch(() => {})
    apiClient.getProfessionals(tenantId).then(setProfessionals).catch(() => {})
  }, [tenantId])

  // ── Filter professionals by selected service ─────────────────────────
  const filteredPros = selectedServiceId
    ? professionals.filter(p => p.services.some(s => s.serviceId === selectedServiceId))
    : professionals

  // ── Load slots when service + professional + date are set ─────────────
  useEffect(() => {
    if (!selectedServiceId || !selectedProfId || !selectedDate) {
      setSlots([])
      return
    }
    setLoadingSlots(true)
    setSelectedSlot('')
    apiClient.getSlots(tenantId, selectedProfId, selectedDate, [selectedServiceId])
      .then(res => setSlots(res.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [tenantId, selectedServiceId, selectedProfId, selectedDate])

  // ── Client search debounce ────────────────────────────────────────────
  useEffect(() => {
    if (clientMode !== 'existing' || clientSearch.trim().length < 2) {
      setClientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await apiClient.searchClients(tenantId, clientSearch)
        setClientResults(results)
        setShowDropdown(true)
      } catch {
        setClientResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [tenantId, clientSearch, clientMode])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Validation ────────────────────────────────────────────────────────
  const hasClient = clientMode === 'existing'
    ? !!selectedClient
    : newName.trim().length > 0 && newEmail.trim().length > 0

  const isValid = selectedServiceId && selectedProfId && selectedDate && selectedSlot && hasClient

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return

    setSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        professionalId: selectedProfId,
        startAt:        selectedSlot,
        items:          [{ serviceId: selectedServiceId }],
        notes:          notes.trim() || undefined,
      }

      if (clientMode === 'existing' && selectedClient) {
        body.clientId = selectedClient.id
        body.guestName  = `${selectedClient.firstName} ${selectedClient.lastName}`
        body.guestEmail = selectedClient.email
        body.guestPhone = selectedClient.phone
      } else {
        body.guestName  = newName.trim()
        body.guestEmail = newEmail.trim() || undefined
        body.guestPhone = newPhone.trim() || undefined
      }

      await apiClient.adminCreateAppointment(tenantId, body)
      onCreated()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al crear el turno.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Format time for display ───────────────────────────────────────────
  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo turno</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Client ────────────────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Cliente</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => { setClientMode('existing'); setSelectedClient(null) }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  clientMode === 'existing' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                Buscar existente
              </button>
              <button
                type="button"
                onClick={() => { setClientMode('new'); setSelectedClient(null) }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  clientMode === 'new' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                Nuevo cliente
              </button>
            </div>

            {clientMode === 'existing' ? (
              <div ref={searchRef} className="relative">
                {selectedClient ? (
                  <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-brand-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {selectedClient.firstName} {selectedClient.lastName}
                      </span>
                      {selectedClient.email && (
                        <span className="text-xs text-gray-500">{selectedClient.email}</span>
                      )}
                    </div>
                    <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                        placeholder="Buscar por nombre, email o teléfono…"
                        className={cn(inputCls, 'pl-9')}
                        autoFocus
                      />
                      {searching && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                    {showDropdown && clientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                        {clientResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedClient(c); setShowDropdown(false); setClientSearch('') }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                              {c.firstName[0]}{c.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                              <p className="text-xs text-gray-500">
                                {[c.email, c.phone].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showDropdown && clientSearch.trim().length >= 2 && clientResults.length === 0 && !searching && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white px-3 py-3 text-center text-sm text-gray-500 shadow-lg">
                        No se encontraron clientes. Probá con &quot;Nuevo cliente&quot;.
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre del cliente *" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email *" className={inputCls} required />
                  <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Teléfono (opcional)" className={inputCls} />
                </div>
              </div>
            )}
          </div>

          {/* ── Service ───────────────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Servicio <span className="text-red-500">*</span></label>
            <select
              value={selectedServiceId}
              onChange={e => { setSelectedServiceId(e.target.value); setSelectedProfId(''); setSelectedSlot('') }}
              className={inputCls}
            >
              <option value="">Seleccionar servicio</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.durationMinutes} min{(typeof s.price === 'string' ? parseFloat(s.price) : s.price) > 0 ? ` — $${typeof s.price === 'string' ? parseFloat(s.price) : s.price}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* ── Professional ──────────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Profesional <span className="text-red-500">*</span></label>
            <select
              value={selectedProfId}
              onChange={e => { setSelectedProfId(e.target.value); setSelectedSlot('') }}
              className={inputCls}
              disabled={!selectedServiceId}
            >
              <option value="">Seleccionar profesional</option>
              {filteredPros.map(p => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </div>

          {/* ── Date ──────────────────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setSelectedSlot('') }}
              className={inputCls}
              disabled={!selectedProfId}
            />
          </div>

          {/* ── Time slot ─────────────────────────────────────────────── */}
          {selectedDate && selectedProfId && selectedServiceId && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Horario <span className="text-red-500">*</span>
              </label>
              {loadingSlots ? (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-gray-500">Cargando horarios…</span>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-gray-500">No hay horarios disponibles para esta fecha.</p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {slots.map(s => (
                    <button
                      key={s.startAt}
                      type="button"
                      onClick={() => setSelectedSlot(s.startAt)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                        selectedSlot === s.startAt
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50',
                      )}
                    >
                      {fmtTime(s.startAt)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas internas (opcional)" className={inputCls} />
          </div>

          {/* ── Error ─────────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* ── Buttons ───────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!isValid || saving}>
              {saving ? <><Spinner size="sm" className="text-white" /> Creando…</> : 'Crear turno'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
