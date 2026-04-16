'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Scissors, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmDialog'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceItem {
  id:              string
  name:            string
  description:     string | null
  durationMinutes: number
  price:           number | string
  currency:        string
  color:           string | null
  isPublic:        boolean
  isActive:        boolean
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

export default function ServiciosPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const tenantId = user?.tenantId ?? ''

  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // ── Fetch services ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    apiClient.getServices(tenantId)
      .then(data => setServices(data as unknown as ServiceItem[]))
      .catch(() => setError('No se pudieron cargar los servicios.'))
      .finally(() => setLoading(false))
  }, [tenantId])

  // ── Delete ──────────────────────────────────────────────────────────────

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title:       'Eliminar servicio',
      message:     `¿Eliminar el servicio "${name}"?`,
      confirmText: 'Eliminar',
      variant:     'danger',
    })
    if (!ok) return
    try {
      await apiClient.deleteService(tenantId, id)
      setServices(prev => prev.filter(s => s.id !== id))
    } catch {
      setError('Error al eliminar el servicio.')
    }
  }

  // ── Format price ────────────────────────────────────────────────────────

  function formatPrice(price: number | string, currency: string) {
    const num = typeof price === 'string' ? parseFloat(price) : price
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 0,
    }).format(num)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Servicios</h1>
        <Button onClick={() => setShowForm(true)} className="self-start sm:self-auto">
          <Plus size={16} />
          Nuevo servicio
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
        <CreateServiceModal
          tenantId={tenantId}
          onCreated={(svc) => {
            setServices(prev => [...prev, svc])
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
      {!loading && services.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Scissors size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay servicios configurados</p>
          <p className="mt-1 text-sm text-gray-400">
            Creá tu primer servicio para que los clientes puedan reservar.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Crear servicio
          </Button>
        </div>
      )}

      {/* List */}
      {!loading && services.length > 0 && (
        <div className="space-y-3">
          {services.map(svc => (
            <div key={svc.id} className="flex flex-col gap-2 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {svc.color && (
                  <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: svc.color }} />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{svc.name}</p>
                  {svc.description && (
                    <p className="text-sm text-gray-500 truncate">{svc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 sm:ml-4">
                <span className="text-sm text-gray-500">{svc.durationMinutes} min</span>
                <span className="text-sm font-semibold text-gray-900">{formatPrice(svc.price, svc.currency)}</span>
                {!svc.isPublic && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Oculto</span>
                )}
                <button
                  onClick={() => handleDelete(svc.id, svc.name)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Eliminar servicio"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateServiceModal({
  tenantId,
  onCreated,
  onClose,
}: {
  tenantId:  string
  onCreated: (svc: ServiceItem) => void
  onClose:   () => void
}) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [duration,    setDuration]    = useState('30')
  const [price,       setPrice]       = useState('')
  const [color,       setColor]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const isValid = name.trim() && parseInt(duration) >= 5 && parseFloat(price) >= 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const svc = await apiClient.createService(tenantId, {
        name:            name.trim(),
        description:     description.trim() || undefined,
        durationMinutes: parseInt(duration),
        price:           parseFloat(price),
        color:           color || undefined,
      })
      onCreated(svc as unknown as ServiceItem)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al crear el servicio. Intentá de nuevo.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo servicio</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre <span className="text-red-500">*</span></label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Corte de pelo" className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descripción (opcional)" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Duración (min) <span className="text-red-500">*</span></label>
              <input type="number" required min={5} value={duration} onChange={e => setDuration(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio <span className="text-red-500">*</span></label>
              <input type="number" required min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Color (opcional)</label>
            <div className="flex items-center gap-2">
              <input type="color" value={color || '#22c55e'} onChange={e => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-lg border p-0.5" />
              <span className="text-xs text-gray-400">{color || 'Sin color'}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!isValid || saving}>
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando…</> : 'Crear servicio'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
