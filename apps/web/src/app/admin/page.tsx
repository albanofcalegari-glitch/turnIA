'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, Calendar, Scissors, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiClient, type AdminTenant } from '@/lib/api'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-brand-100 text-brand-700',
}

const TYPE_LABELS: Record<string, string> = {
  peluqueria: 'Peluqueria',
  barberia: 'Barberia',
  spa: 'Spa',
  estetica: 'Estetica',
  masajes: 'Masajes',
  custom: 'Otro',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function isExpired(date: string | null) {
  if (!date) return false
  return new Date(date) < new Date()
}

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const d = new Date(date)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000 // 7 days
}

export default function AdminPage() {
  const [tenants, setTenants] = useState<AdminTenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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
    } catch {
      setError('Error al actualizar')
    }
  }

  async function updateMembership(id: string, date: string | null, plan: string) {
    try {
      const updated = await apiClient.updateTenant(id, {
        membershipExpiresAt: date,
        plan,
      })
      setTenants(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
      setEditingId(null)
    } catch {
      setError('Error al actualizar membresia')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  const active = tenants.filter(t => t.isActive)
  const inactive = tenants.filter(t => !t.isActive)
  const expiringSoon = tenants.filter(t => t.isActive && isExpiringSoon(t.membershipExpiresAt))

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">Negocios registrados</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard icon={Building2} label="Total" value={tenants.length} />
        <StatCard icon={Calendar} label="Activos" value={active.length} color="text-green-600" />
        <StatCard icon={AlertTriangle} label="Por vencer" value={expiringSoon.length} color="text-amber-600" />
        <StatCard icon={Building2} label="Inactivos" value={inactive.length} color="text-red-500" />
      </div>

      {/* Tenant list */}
      {tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Building2 size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay negocios registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map(tenant => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              isEditing={editingId === tenant.id}
              onToggleEdit={() => setEditingId(editingId === tenant.id ? null : tenant.id)}
              onToggleActive={() => toggleActive(tenant)}
              onSaveMembership={(date, plan) => updateMembership(tenant.id, date, plan)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color?: string
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className={color ?? 'text-gray-400'} />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className={cn('mt-1 text-2xl font-bold', color ?? 'text-gray-900')}>{value}</p>
    </div>
  )
}

function TenantRow({ tenant, isEditing, onToggleEdit, onToggleActive, onSaveMembership }: {
  tenant: AdminTenant
  isEditing: boolean
  onToggleEdit: () => void
  onToggleActive: () => void
  onSaveMembership: (date: string | null, plan: string) => void
}) {
  const [expDate, setExpDate] = useState(tenant.membershipExpiresAt?.slice(0, 10) ?? '')
  const [plan, setPlan] = useState(tenant.plan)
  const expired = isExpired(tenant.membershipExpiresAt)
  const expiring = isExpiringSoon(tenant.membershipExpiresAt)

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4',
      !tenant.isActive && 'opacity-60',
    )}>
      {/* Main row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'h-3 w-3 flex-shrink-0 rounded-full',
            tenant.isActive ? 'bg-green-500' : 'bg-red-400',
          )} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{tenant.name}</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', PLAN_COLORS[tenant.plan] ?? PLAN_COLORS.free)}>
                {PLAN_LABELS[tenant.plan] ?? tenant.plan}
              </span>
              {expired && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                  Vencido
                </span>
              )}
              {expiring && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Por vencer
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              /{tenant.slug} · {TYPE_LABELS[tenant.type] ?? tenant.type} · Creado {formatDate(tenant.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-400" title="Servicios">
            <Scissors size={12} /> {tenant._count.services}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400" title="Profesionales">
            <Users size={12} /> {tenant._count.professionals}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400" title="Turnos">
            <Calendar size={12} /> {tenant._count.appointments}
          </span>

          {tenant.membershipExpiresAt && (
            <span className={cn(
              'text-xs',
              expired ? 'text-red-500 font-medium' : 'text-gray-400',
            )}>
              Vence: {formatDate(tenant.membershipExpiresAt)}
            </span>
          )}

          <Button size="sm" variant="ghost" onClick={onToggleEdit}>
            {isEditing ? 'Cerrar' : 'Editar'}
          </Button>
          <Button
            size="sm"
            variant={tenant.isActive ? 'danger' : 'primary'}
            onClick={onToggleActive}
          >
            {tenant.isActive ? 'Desactivar' : 'Activar'}
          </Button>
        </div>
      </div>

      {/* Edit panel */}
      {isEditing && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Plan</label>
            <select
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Vigencia hasta</label>
            <input
              type="date"
              value={expDate}
              onChange={e => setExpDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onSaveMembership(expDate || null, plan)}>
              Guardar
            </Button>
            {expDate && (
              <Button size="sm" variant="ghost" onClick={() => { setExpDate(''); onSaveMembership(null, plan) }}>
                Sin vencimiento
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
