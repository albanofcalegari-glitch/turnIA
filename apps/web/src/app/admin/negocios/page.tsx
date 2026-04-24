'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, Calendar, Scissors, AlertTriangle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient, type AdminTenant } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial', standard: 'Estándar', free: 'Free', starter: 'Starter', pro: 'Pro',
}
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  standard: 'bg-green-500/20 text-green-600 dark:text-green-400',
  pro: 'bg-brand-500/20 text-brand-700 dark:text-brand-400',
  free: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  starter: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
}
const TYPE_LABELS: Record<string, string> = {
  peluqueria: 'Peluquería', barberia: 'Barbería', spa: 'Spa', estetica: 'Estética', masajes: 'Masajes', custom: 'Otro',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(date: string | null) {
  return date ? new Date(date) < new Date() : false
}

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const diff = new Date(date).getTime() - Date.now()
  return diff > 0 && diff < 7 * 86400000
}

function daysLeft(date: string | null) {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

export default function AdminNegociosPage() {
  const [tenants, setTenants]     = useState<AdminTenant[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [filterPlan, setFilterPlan]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    apiClient.getAllTenants()
      .then(setTenants)
      .catch(() => setError('Error al cargar negocios'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleActive(tenant: AdminTenant) {
    try {
      const updated = await apiClient.updateTenant(tenant.id, { isActive: !tenant.isActive })
      setTenants(prev => prev.map(t => t.id === tenant.id ? { ...t, ...updated } : t))
    } catch { setError('Error al actualizar') }
  }

  async function updateMembership(id: string, date: string | null, plan: string) {
    try {
      const updated = await apiClient.updateTenant(id, { membershipExpiresAt: date, plan })
      setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
      setEditingId(null)
    } catch { setError('Error al actualizar membresía') }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>

  const filtered = tenants.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.slug.toLowerCase().includes(search.toLowerCase())) return false
    if (filterPlan && t.plan !== filterPlan) return false
    if (filterStatus === 'active' && !t.isActive) return false
    if (filterStatus === 'inactive' && t.isActive) return false
    if (filterStatus === 'expiring' && !isExpiringSoon(t.membershipExpiresAt)) return false
    if (filterStatus === 'expired' && !isExpired(t.membershipExpiresAt)) return false
    return true
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Negocios registrados</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{tenants.length} total</span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <option value="">Todos los planes</option>
          <option value="trial">Trial</option>
          <option value="standard">Estándar</option>
          <option value="pro">Pro</option>
          <option value="free">Free</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="expiring">Por vencer</option>
          <option value="expired">Vencidos</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(tenant => (
          <TenantRow
            key={tenant.id}
            tenant={tenant}
            isEditing={editingId === tenant.id}
            onToggleEdit={() => setEditingId(editingId === tenant.id ? null : tenant.id)}
            onToggleActive={() => toggleActive(tenant)}
            onSaveMembership={(date, plan) => updateMembership(tenant.id, date, plan)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <Building2 size={28} className="mx-auto text-gray-400 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-500">No hay negocios que coincidan</p>
          </div>
        )}
      </div>
    </div>
  )
}

function TenantRow({ tenant, isEditing, onToggleEdit, onToggleActive, onSaveMembership }: {
  tenant: AdminTenant; isEditing: boolean; onToggleEdit: () => void; onToggleActive: () => void
  onSaveMembership: (date: string | null, plan: string) => void
}) {
  const [expDate, setExpDate] = useState(tenant.membershipExpiresAt?.slice(0, 10) ?? '')
  const [plan, setPlan]       = useState(tenant.plan)
  const expired  = isExpired(tenant.membershipExpiresAt)
  const expiring = isExpiringSoon(tenant.membershipExpiresAt)
  const days     = daysLeft(tenant.membershipExpiresAt)

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900', !tenant.isActive && 'opacity-50')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('h-3 w-3 flex-shrink-0 rounded-full', tenant.isActive ? 'bg-green-500' : 'bg-red-400')} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-white">{tenant.name}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', PLAN_COLORS[tenant.plan] ?? PLAN_COLORS.free)}>
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </span>
              {expired && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/20 dark:text-red-400">Vencido</span>}
              {expiring && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Vence en {days}d</span>}
            </div>
            <p className="text-xs text-gray-500">
              /{tenant.slug} · {TYPE_LABELS[tenant.type] ?? tenant.type} · Creado {formatDate(tenant.createdAt)}
              {tenant.membershipExpiresAt && <> · Vence {formatDate(tenant.membershipExpiresAt)}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1" title="Servicios"><Scissors size={12} /> {tenant._count.services}</span>
            <span className="flex items-center gap-1" title="Profesionales"><Users size={12} /> {tenant._count.professionals}</span>
            <span className="flex items-center gap-1" title="Turnos"><Calendar size={12} /> {tenant._count.appointments}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onToggleEdit} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            {isEditing ? 'Cerrar' : 'Editar'}
          </Button>
          <Button size="sm" variant={tenant.isActive ? 'danger' : 'primary'} onClick={onToggleActive}>
            {tenant.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-800 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <option value="trial">Trial</option>
              <option value="standard">Estándar</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Vigencia hasta</label>
            <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSaveMembership(expDate || null, plan)}>Guardar</Button>
            {expDate && <Button size="sm" variant="ghost" className="text-gray-500 dark:text-gray-400" onClick={() => { setExpDate(''); onSaveMembership(null, plan) }}>Sin vencimiento</Button>}
          </div>
        </div>
      )}
    </div>
  )
}
