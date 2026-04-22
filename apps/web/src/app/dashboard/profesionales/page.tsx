'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, X, Link2, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Dialog'
import { ActionsMenu } from '@/components/ui/ActionsMenu'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
)

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
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfesionalesPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [professionals, setProfessionals] = useState<ProfessionalItem[]>([])
  const [allServices,   setAllServices]   = useState<ServiceOption[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [query,         setQuery]         = useState('')
  const [page,          setPage]          = useState(1)
  const { confirm, element: confirmDialog } = useConfirm()


  // ── Fetch data ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    Promise.all([
      apiClient.getProfessionals(tenantId),
      apiClient.getServices(tenantId),
    ])
      .then(([pros, svcs]) => {
        setProfessionals(pros as unknown as ProfessionalItem[])
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

  // ── Delete professional (soft delete on the backend) ────────────────────

  async function handleDeleteProfessional(pro: ProfessionalItem) {
    const ok = await confirm({
      title:       'Eliminar profesional',
      message: (
        <>
          ¿Eliminar a <strong>{pro.displayName}</strong>? No se podrá reservar más con
          este profesional. Los turnos pasados se conservan en el historial.
        </>
      ),
      confirmText: 'Eliminar',
      variant:     'danger',
    })
    if (!ok) return

    try {
      await apiClient.deleteProfessional(tenantId, pro.id)
      setProfessionals(prev => prev.filter(p => p.id !== pro.id))
    } catch (err) {
      // The backend returns 409 with a clear message when there are future
      // pending/confirmed appointments — surface it verbatim so the user knows
      // what to do.
      const msg = err instanceof ApiError ? err.message : 'No se pudo eliminar el profesional.'
      setError(msg)
    }
  }

  return (
    <div>
      {confirmDialog}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Profesionales</h1>
        <Link
          href="/dashboard/profesionales/nuevo"
          className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:self-auto"
        >
          <Plus size={16} />
          Agregar profesional
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
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
          <Link
            href="/dashboard/profesionales/nuevo"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus size={16} />
            Agregar profesional
          </Link>
        </div>
      )}

      {/* Search */}
      {!loading && professionals.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Buscar profesionales por nombre…"
            className={cn(inputCls, 'max-w-sm')}
          />
        </div>
      )}

      {/* List */}
      {!loading && professionals.length > 0 && (() => {
        const filtered = query.trim()
          ? professionals.filter(p => p.displayName.toLowerCase().includes(query.trim().toLowerCase()))
          : professionals

        if (filtered.length === 0) {
          return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center text-sm text-gray-500">
              No se encontraron profesionales con ese nombre.
            </div>
          )
        }

        const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const safePage  = Math.min(page, pageCount)
        const paged     = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

        return (
          <>
            <div className="space-y-4">
              {paged.map(pro => (
                <ProfessionalCard
                  key={pro.id}
                  professional={pro}
                  allServices={allServices}
                  onLinkService={(svcId) => handleLinkService(pro.id, svcId)}
                  onUnlinkService={(svcId) => handleUnlinkService(pro.id, svcId)}
                  onDelete={() => handleDeleteProfessional(pro)}
                />
              ))}
            </div>
            <Pagination page={safePage} pageCount={pageCount} onChange={setPage} />
          </>
        )
      })()}
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
  onDelete,
}: {
  professional:    ProfessionalItem
  allServices:     ServiceOption[]
  onLinkService:   (serviceId: string) => void
  onUnlinkService: (serviceId: string) => void
  onDelete:        () => void
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
        <ActionsMenu
          className="ml-2"
          label={`Acciones para ${professional.displayName}`}
          items={[
            {
              label:   'Eliminar',
              icon:    <Trash2 size={14} />,
              onClick: onDelete,
              danger:  true,
            },
          ]}
        />
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

