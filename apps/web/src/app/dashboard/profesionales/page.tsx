'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Users, Plus, X, Link2, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProfessionalItem {
  id:                   string
  displayName:          string
  color:                string | null
  avatarUrl:            string | null
  acceptsOnlineBooking: boolean
  user:                 { id: string; firstName: string; lastName: string; email: string } | null
  services:             Array<{
    serviceId: string
    service:   { id: string; name: string }
  }>
}

interface ServiceOption {
  id:   string
  name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Input classes
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfesionalesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([])
  const [allServices,   setAllServices]   = useState<ServiceOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [showForm,      setShowForm]      = useState(false)


  // ── Fetch data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    Promise.all([
      apiClient.getProfessionals(tenantId),
      apiClient.getServices(tenantId),
    ])
      .then(([pros, svcs]) => {
        setProfessionals(pros as ProfessionalItem[])
        setAllServices(svcs.map(s => ({ id: s.id, name: s.name })))
      })
      .catch(() => setError('No se pudieron cargar los profesionales.'))
      .finally(() => setLoading(false))
  }, [tenantId])

  // ── Link / unlink service ───────────────────────────────────────────────

  async function handleLinkService(proId: string, serviceId: string) {
    try {
      await apiClient.addServiceToProfessional(tenantId, proId, serviceId)
      // Refresh professional's services
      const svc = allServices.find(s => s.id === serviceId)
      if (svc) {
        setProfessionals(prev =>
          prev.map(p =>
            p.id === proId
              ? { ...p, services: [...p.services, { serviceId, service: svc }] }
              : p,
          ),
        )
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al vincular servicio.'
      setError(msg)
    }
  }

  async function handleUnlinkService(proId: string, serviceId: string) {
    try {
      await apiClient.removeServiceFromProfessional(tenantId, proId, serviceId)
      setProfessionals(prev =>
        prev.map(p =>
          p.id === proId
            ? { ...p, services: p.services.filter(s => s.serviceId !== serviceId) }
            : p,
        ),
      )
    } catch {
      setError('Error al desvincular servicio.')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} />
          Agregar profesional
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <CreateProfessionalModal
          tenantId={tenantId}
          onCreated={(pro) => {
            setProfessionals(prev => [...prev, pro])
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty */}
      {!loading && professionals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Users size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay profesionales configurados</p>
          <p className="mt-1 text-sm text-gray-400">
            Agregá un profesional para que los clientes puedan reservar turnos.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Agregar profesional
          </Button>
        </div>
      )}

      {/* List */}
      {!loading && professionals.length > 0 && (
        <div className="space-y-4">
          {professionals.map(pro => (
            <ProfessionalCard
              key={pro.id}
              professional={pro}
              allServices={allServices}
              onLinkService={(svcId) => handleLinkService(pro.id, svcId)}
              onUnlinkService={(svcId) => handleUnlinkService(pro.id, svcId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Professional card
// ─────────────────────────────────────────────────────────────────────────────

function ProfessionalCard({
  professional,
  allServices,
  onLinkService,
  onUnlinkService,
}: {
  professional:    ProfessionalItem
  allServices:     ServiceOption[]
  onLinkService:   (serviceId: string) => void
  onUnlinkService: (serviceId: string) => void
}) {
  const linkedIds = new Set(professional.services.map(s => s.serviceId))
  const unlinkedServices = allServices.filter(s => !linkedIds.has(s.id))

  const initials = professional.displayName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: professional.color ?? '#6b7280' }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{professional.displayName}</p>
          {professional.user && (
            <p className="text-xs text-gray-400">{professional.user.email}</p>
          )}
        </div>
        {!professional.acceptsOnlineBooking && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-500">
            Sin reservas online
          </span>
        )}
      </div>

      {/* Linked services */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Servicios vinculados
        </p>
        {professional.services.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ningún servicio vinculado aún.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {professional.services.map(ps => (
              <span
                key={ps.serviceId}
                className="group inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {ps.service.name}
                <button
                  onClick={() => onUnlinkService(ps.serviceId)}
                  title="Desvincular servicio"
                  className="rounded-full p-0.5 text-brand-400 hover:bg-brand-200 hover:text-brand-700 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add service dropdown */}
        {unlinkedServices.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Link2 size={14} className="text-gray-400" />
            <select
              defaultValue=""
              onChange={e => {
                if (e.target.value) {
                  onLinkService(e.target.value)
                  e.target.value = ''
                }
              }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="" disabled>Vincular servicio…</option>
              {unlinkedServices.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateProfessionalModal({
  tenantId,
  onCreated,
  onClose,
}: {
  tenantId:  string
  onCreated: (pro: ProfessionalItem) => void
  onClose:   () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [color,       setColor]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const pro = await apiClient.createProfessional(tenantId, {
        displayName: displayName.trim(),
        color:       color || undefined,
      })
      onCreated({ ...pro, services: [] } as unknown as ProfessionalItem)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al crear el profesional. Intentá de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Agregar profesional</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nombre profesional <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ej: Ana García"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-400">
              Este nombre se muestra en la página de reservas.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Color (opcional)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color || '#6b7280'} onChange={e => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border p-0.5" />
              <span className="text-xs text-gray-400">Color para la agenda</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!displayName.trim() || saving}>
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando…</> : 'Crear profesional'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
