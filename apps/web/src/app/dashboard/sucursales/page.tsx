'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Building2, Plus, Trash2, RotateCcw, X, Star, Users, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError, type AdminBranch } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/Dialog'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import type { Professional } from '@/features/booking/booking.types'

// ─────────────────────────────────────────────────────────────────────────────
// Input classes (mirrors /dashboard/servicios so the look stays consistent)
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SucursalesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [branches, setBranches] = useState<AdminBranch[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [savingProfessionalId, setSavingProfessionalId] = useState<string | null>(null)
  const { confirm, element: confirmDialog } = useConfirm()

  // ── Fetch branches ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    Promise.all([
      apiClient.getAllBranches(tenantId),
      apiClient.getProfessionals(tenantId),
    ])
      .then(([brs, pros]) => {
        setBranches(brs)
        setProfessionals(pros)
      })
      .catch(() => setError('No se pudieron cargar las sucursales.'))
      .finally(() => setLoading(false))
  }, [tenantId])

  async function handleToggleProfessional(pro: Professional, branchId: string, checked: boolean) {
    const current = pro.branches?.map(b => b.branchId) ?? []
    const next = checked
      ? [...new Set([...current, branchId])]
      : current.filter(id => id !== branchId)

    if (next.length === 0) {
      setError('Cada profesional debe atender en al menos una sucursal.')
      return
    }

    setSavingProfessionalId(pro.id)
    setError(null)
    try {
      const updated = await apiClient.updateProfessionalBranches(tenantId, pro.id, next)
      setProfessionals(prev => prev.map(p => p.id === pro.id ? updated : p))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la asignación.')
    } finally {
      setSavingProfessionalId(null)
    }
  }

  // ── Delete (soft) ───────────────────────────────────────────────────────

  async function handleDelete(b: AdminBranch) {
    if (b.isDefault) {
      setError('No podés desactivar la sucursal principal.')
      return
    }
    const ok = await confirm({
      title:       'Desactivar sucursal',
      message: (
        <>
          ¿Desactivar la sucursal <strong>{b.name}</strong>? Los turnos existentes seguirán visibles,
          pero ya no se podrán crear nuevos en esta sucursal.
        </>
      ),
      confirmText: 'Desactivar',
      variant:     'danger',
    })
    if (!ok) return
    try {
      const updated = await apiClient.deleteBranch(tenantId, b.id)
      setBranches(prev => prev.map(x => x.id === b.id ? updated : x))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al desactivar la sucursal.')
    }
  }

  async function handleActivate(b: AdminBranch) {
    try {
      const updated = await apiClient.updateBranch(tenantId, b.id, { isActive: true })
      setBranches(prev => prev.map(x => x.id === b.id ? updated : x))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al activar la sucursal.')
    }
  }

  return (
    <div>
      {confirmDialog}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Sucursales</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestioná las sucursales donde tu negocio atiende.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="self-start sm:self-auto">
          <Plus size={16} />
          Nueva sucursal
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
        <CreateBranchModal
          tenantId={tenantId}
          onCreated={(br) => {
            setBranches(prev => [...prev, br])
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

      {/* Empty (shouldn't happen — there's always a default) */}
      {!loading && branches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Building2 size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay sucursales configuradas</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            Crear sucursal
          </Button>
        </div>
      )}

      {/* List */}
      {!loading && branches.length > 0 && (
        <div className="space-y-3">
          {branches.map(br => (
            <div
              key={br.id}
              className={cn(
                'flex flex-col gap-3 rounded-xl border bg-white p-4',
                !br.isActive && 'opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{br.name}</p>
                      {br.isDefault && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          <Star size={10} />
                          Principal
                        </span>
                      )}
                      {!br.isActive && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          Inactiva
                        </span>
                      )}
                    </div>
                    {br.address && <p className="text-sm text-gray-500 truncate">{br.address}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {br.phone && <span className="text-sm text-gray-500">{br.phone}</span>}
                  {!br.isDefault && br.isActive && (
                    <ActionsMenu
                      label={`Acciones para ${br.name}`}
                      items={[
                        {
                          label:   'Desactivar',
                          icon:    <Trash2 size={14} />,
                          onClick: () => handleDelete(br),
                          danger:  true,
                        },
                      ]}
                    />
                  )}
                  {!br.isDefault && !br.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleActivate(br)}
                    >
                      <RotateCcw size={14} />
                      Activar
                    </Button>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <Users size={13} />
                  Profesionales
                </div>
                {professionals.length === 0 ? (
                  <p className="text-sm text-gray-500">Todavía no hay profesionales cargados.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {professionals.map(pro => {
                      const assigned = pro.branches?.some(pb => pb.branchId === br.id) ?? false
                      const assignedCount = pro.branches?.length ?? 0
                      const disabled = savingProfessionalId === pro.id || (assigned && assignedCount <= 1)
                      return (
                        <button
                          key={pro.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleToggleProfessional(pro, br.id, !assigned)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                            assigned
                              ? 'border-brand-200 bg-brand-50 text-brand-700'
                              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                            disabled && 'cursor-not-allowed opacity-60',
                          )}
                          title={assigned && assignedCount <= 1 ? 'El profesional debe quedar asignado al menos a una sucursal' : undefined}
                        >
                          {assigned && <Check size={12} />}
                          {pro.displayName}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        Los horarios se configuran por profesional y sucursal desde la sección Horarios.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateBranchModal({
  tenantId,
  onCreated,
  onClose,
}: {
  tenantId:  string
  onCreated: (br: AdminBranch) => void
  onClose:   () => void
}) {
  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [phone,   setPhone]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const isValid = name.trim().length >= 2

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      const br = await apiClient.createBranch(tenantId, {
        name:    name.trim(),
        address: address.trim() || undefined,
        phone:   phone.trim()   || undefined,
      })
      onCreated(br)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al crear la sucursal. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nueva sucursal</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Sucursal Centro"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Dirección</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Av. Corrientes 1234"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
              placeholder="+54 9 11 1234-5678"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!isValid || saving}>
              {saving ? <><Spinner size="sm" className="text-white" /> Guardando…</> : 'Crear sucursal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
