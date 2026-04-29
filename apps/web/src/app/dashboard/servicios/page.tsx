'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Scissors, Plus, Trash2, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { ColorSwatch } from '@/components/ui/ColorSwatch'
import { useConfirm } from '@/components/ui/Dialog'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { ViewToggle, type ViewMode } from '@/components/ui/ViewToggle'
import { Pagination } from '@/components/ui/Pagination'

const PAGE_SIZE = 10

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceItem {
  id:                  string
  name:                string
  description:         string | null
  durationMinutes:     number
  price:               number | string
  currency:            string
  color:               string | null
  isPublic:            boolean
  isActive:            boolean
  maxParallelBookings: number
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
  const tenantId = user?.tenantId ?? ''

  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editTarget,  setEditTarget]  = useState<ServiceItem | null>(null)
  const [viewMode,    setViewMode]    = useState<ViewMode>('list')
  const [query,    setQuery]    = useState('')
  const [page,     setPage]     = useState(1)
  const { confirm, element: confirmDialog } = useConfirm()

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
      message:     <>¿Seguro que querés eliminar <strong>{name}</strong>? Esta acción no se puede deshacer.</>,
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
    if (!num) return ''
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 0,
    }).format(num)
  }

  return (
    <div>
      {confirmDialog}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Servicios</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Nuevo servicio
          </Button>
        </div>
      </div>

      {/* Search bar (filter by name) */}
      {services.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Buscar servicios por nombre…"
            className={cn(inputCls, 'max-w-sm')}
          />
        </div>
      )}

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

      {editTarget && (
        <EditServiceModal
          tenantId={tenantId}
          service={editTarget}
          onUpdated={(updated) => {
            setServices(prev => prev.map(s => s.id === updated.id ? updated : s))
            setEditTarget(null)
          }}
          onClose={() => setEditTarget(null)}
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

      {/* List / grid */}
      {!loading && services.length > 0 && (() => {
        const filtered = query.trim()
          ? services.filter(s => s.name.toLowerCase().includes(query.trim().toLowerCase()))
          : services

        if (filtered.length === 0) {
          return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
              No se encontraron servicios con ese nombre.
            </div>
          )
        }

        const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const safePage  = Math.min(page, pageCount)
        const paged     = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

        const pager = (
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
        )

        if (viewMode === 'grid') {
          return (
            <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paged.map(svc => (
                <div
                  key={svc.id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {svc.color && (
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: svc.color }}
                        />
                      )}
                      <p className="font-semibold text-gray-900 truncate">{svc.name}</p>
                    </div>
                    <ActionsMenu
                      items={[
                        {
                          label:   'Editar',
                          icon:    <Pencil size={14} />,
                          onClick: () => setEditTarget(svc),
                        },
                        {
                          label:   'Eliminar',
                          icon:    <Trash2 size={14} />,
                          onClick: () => handleDelete(svc.id, svc.name),
                          danger:  true,
                        },
                      ]}
                    />
                  </div>
                  {svc.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{svc.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs">
                    <span className="text-gray-500">{svc.durationMinutes} min</span>
                    <span className="font-semibold text-gray-900">
                      {formatPrice(svc.price, svc.currency)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {svc.maxParallelBookings > 1 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {svc.maxParallelBookings} cupos
                      </span>
                    )}
                    {!svc.isPublic && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        Oculto
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {pager}
            </>
          )
        }

        return (
          <>
          <div className="space-y-3">
            {paged.map(svc => (
              <div key={svc.id} className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between">
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
                  {svc.maxParallelBookings > 1 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {svc.maxParallelBookings} cupos
                    </span>
                  )}
                  {!svc.isPublic && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Oculto</span>
                  )}
                  <ActionsMenu
                    items={[
                      {
                        label:   'Editar',
                        icon:    <Pencil size={14} />,
                        onClick: () => setEditTarget(svc),
                      },
                      {
                        label:   'Eliminar',
                        icon:    <Trash2 size={14} />,
                        onClick: () => handleDelete(svc.id, svc.name),
                        danger:  true,
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
          {pager}
          </>
        )
      })()}
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
  const [capacity,    setCapacity]    = useState('1')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const isValid = name.trim() && parseInt(duration) >= 5 && (price === '' || parseFloat(price) >= 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const svc = await apiClient.createService(tenantId, {
        name:                name.trim(),
        description:         description.trim() || undefined,
        durationMinutes:     parseInt(duration),
        ...(price.trim() ? { price: parseFloat(price) } : {}),
        color:               color || undefined,
        ...(parseInt(capacity) > 1 ? { maxParallelBookings: parseInt(capacity) } : {}),
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
      <div className="w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-xl">
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio</label>
              <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0 (gratis)" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Cupos por turno</label>
              <input type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(e.target.value)} className={inputCls} />
              {parseInt(capacity) > 1 && (
                <p className="mt-1 text-xs text-blue-600">Grupal: {capacity} personas por turno</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
              <ColorSwatch value={color} onChange={setColor} />
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

// ─────────────────────────────────────────────────────────────────────────────
// Edit modal
// ─────────────────────────────────────────────────────────────────────────────

function EditServiceModal({
  tenantId,
  service,
  onUpdated,
  onClose,
}: {
  tenantId:  string
  service:   ServiceItem
  onUpdated: (svc: ServiceItem) => void
  onClose:   () => void
}) {
  const priceNum = typeof service.price === 'string' ? parseFloat(service.price) : service.price
  const [name,        setName]        = useState(service.name)
  const [description, setDescription] = useState(service.description ?? '')
  const [duration,    setDuration]    = useState(String(service.durationMinutes))
  const [price,       setPrice]       = useState(priceNum > 0 ? String(priceNum) : '')
  const [color,       setColor]       = useState(service.color ?? '')
  const [capacity,    setCapacity]    = useState(String(service.maxParallelBookings))
  const [isPublic,    setIsPublic]    = useState(service.isPublic)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const isValid = name.trim() && parseInt(duration) >= 5 && (price === '' || parseFloat(price) >= 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const data: Record<string, unknown> = {
        name:            name.trim(),
        description:     description.trim() || null,
        durationMinutes: parseInt(duration),
        color:           color || null,
        isPublic,
        maxParallelBookings: parseInt(capacity) || 1,
      }
      if (price.trim()) {
        data.price = parseFloat(price)
      } else {
        data.price = 0
      }
      const updated = await apiClient.updateService(tenantId, service.id, data)
      onUpdated(updated as unknown as ServiceItem)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Error al actualizar el servicio.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md animate-slide-up rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Editar servicio</h2>
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio</label>
              <input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0 (sin precio)" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Cupos por turno</label>
              <input type="number" min={1} max={100} value={capacity} onChange={e => setCapacity(e.target.value)} className={inputCls} />
              {parseInt(capacity) > 1 && (
                <p className="mt-1 text-xs text-blue-600">Grupal: {capacity} personas por turno</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Color</label>
              <ColorSwatch value={color} onChange={setColor} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-is-public"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="edit-is-public" className="text-sm text-gray-700">Visible en booking público</label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!isValid || saving}>
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando…</> : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
