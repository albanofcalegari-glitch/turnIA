'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Building2, Clock, Save, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError, type WorkScheduleItem } from '@/lib/api'
import type { Branch } from '@/features/booking/booking.types'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProfessionalOption {
  id:          string
  displayName: string
  color:       string | null
  branches?:   Array<{ branchId: string }>
}

/** Local state for each day row — may or may not have a backend id yet. */
interface DayRow {
  id:        string | null   // null = not yet saved
  enabled:   boolean
  startTime: string
  endTime:   string
  dirty:     boolean         // changed since last save
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DEFAULT_START = '09:00'
const DEFAULT_END   = '18:00'

function emptyWeek(): DayRow[] {
  return DAY_LABELS.map(() => ({
    id: null, enabled: false, startTime: DEFAULT_START, endTime: DEFAULT_END, dirty: false,
  }))
}

const inputCls = cn(
  'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
  'disabled:bg-gray-50 disabled:text-gray-400',
)

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HorariosPage() {
  const { user } = useAuth()
  const tenantId = user?.tenantId ?? ''

  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [branches, setBranches]           = useState<Branch[]>([])
  const [selectedProId, setSelectedProId] = useState<string>('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [week, setWeek]                   = useState<DayRow[]>(emptyWeek())
  const [loadingPros, setLoadingPros]     = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // ── Load professionals ─────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) return
    setLoadingPros(true)
    Promise.all([
      apiClient.getProfessionals(tenantId),
      user?.tenantHasMultipleBranches ? apiClient.getBranches(tenantId) : Promise.resolve([] as Branch[]),
    ])
      .then(([data, brs]) => {
        const pros = (data as ProfessionalOption[]).map(p => ({
          id: p.id, displayName: p.displayName, color: p.color, branches: p.branches,
        }))
        setProfessionals(pros)
        if (pros.length > 0) setSelectedProId(pros[0].id)
        setBranches(brs)
        if (brs.length > 0) setSelectedBranchId(brs[0].id)
      })
      .catch(() => setError('No se pudieron cargar los datos de horarios.'))
      .finally(() => setLoadingPros(false))
  }, [tenantId, user?.tenantHasMultipleBranches])

  // ── Load schedule when professional changes ────────────────────────────

  const loadSchedule = useCallback(async (proId: string, branchId?: string) => {
    if (!tenantId || !proId) return
    setLoadingSchedule(true)
    setError(null)
    setSaved(false)
    try {
      const items = await apiClient.getWorkSchedule(tenantId, proId, branchId || undefined)
      const newWeek = emptyWeek()
      for (const item of items) {
        newWeek[item.dayOfWeek] = {
          id:        item.id,
          enabled:   item.isActive,
          startTime: item.startTime,
          endTime:   item.endTime,
          dirty:     false,
        }
      }
      setWeek(newWeek)
    } catch {
      setError('No se pudo cargar el horario.')
    } finally {
      setLoadingSchedule(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (selectedProId) loadSchedule(selectedProId, selectedBranchId)
  }, [selectedProId, selectedBranchId, loadSchedule])

  const visibleProfessionals = useMemo(() => (
    selectedBranchId
      ? professionals.filter(p => !p.branches || p.branches.length === 0 || p.branches.some(b => b.branchId === selectedBranchId))
      : professionals
  ), [professionals, selectedBranchId])

  useEffect(() => {
    if (visibleProfessionals.length === 0) {
      setSelectedProId('')
      setWeek(emptyWeek())
      return
    }
    if (!visibleProfessionals.some(p => p.id === selectedProId)) {
      setSelectedProId(visibleProfessionals[0].id)
    }
  }, [visibleProfessionals, selectedProId])

  // ── Day row handlers ───────────────────────────────────────────────────

  function updateDay(dayIndex: number, patch: Partial<DayRow>) {
    setWeek(prev => prev.map((row, i) =>
      i === dayIndex ? { ...row, ...patch, dirty: true } : row,
    ))
    setSaved(false)
  }

  // ── Save ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!tenantId || !selectedProId || saving) return
    setSaving(true)
    setError(null)

    try {
      const newWeek = [...week]

      for (let day = 0; day < 7; day++) {
        const row = newWeek[day]
        if (!row.dirty) continue

        if (row.enabled) {
          if (row.id) {
            // Update existing
            const updated = await apiClient.updateWorkSchedule(tenantId, selectedProId, row.id, {
              startTime: row.startTime,
              endTime:   row.endTime,
              isActive:  true,
            })
            newWeek[day] = { ...row, id: updated.id, dirty: false }
          } else {
            // Create new
            const created = await apiClient.createWorkSchedule(tenantId, selectedProId, {
              dayOfWeek: day,
              startTime: row.startTime,
              endTime:   row.endTime,
              branchId:  selectedBranchId || undefined,
            })
            newWeek[day] = { ...row, id: created.id, dirty: false }
          }
        } else {
          if (row.id) {
            // Delete existing
            await apiClient.deleteWorkSchedule(tenantId, selectedProId, row.id)
            newWeek[day] = { id: null, enabled: false, startTime: DEFAULT_START, endTime: DEFAULT_END, dirty: false }
          } else {
            newWeek[day] = { ...row, dirty: false }
          }
        }
      }

      setWeek(newWeek)
      setSaved(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al guardar el horario.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const hasDirty = week.some(r => r.dirty)

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Loading professionals */}
      {loadingPros && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* No professionals */}
      {!loadingPros && professionals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Clock size={32} className="mx-auto text-gray-300" />
          <p className="mt-3 font-medium text-gray-700">No hay profesionales configurados</p>
          <p className="mt-1 text-sm text-gray-400">
            Primero creá un profesional desde la sección Profesionales.
          </p>
        </div>
      )}

      {/* Main content */}
      {!loadingPros && professionals.length > 0 && (
        <div className="space-y-6">
          {/* Professional selector */}
          <div className="space-y-3">
            {branches.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                      selectedBranchId === branch.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <Building2 size={14} />
                    {branch.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {visibleProfessionals.map(pro => (
                <button
                  key={pro.id}
                  onClick={() => setSelectedProId(pro.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    selectedProId === pro.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: pro.color ?? '#6b7280' }}
                  />
                  {pro.displayName}
                </button>
              ))}
            </div>

            {visibleProfessionals.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No hay profesionales asignados a esta sucursal.
              </div>
            )}
          </div>

          {/* Schedule grid */}
          {loadingSchedule ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200/80 bg-white shadow-card">
              {/* Header — hidden on mobile */}
              <div className="hidden sm:grid grid-cols-[160px_60px_1fr_1fr] items-center gap-4 border-b bg-gray-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                <span>Día</span>
                <span className="text-center">Activo</span>
                <span>Entrada</span>
                <span>Salida</span>
              </div>

              {/* Rows */}
              {DAY_LABELS.map((label, dayIndex) => {
                const row = week[dayIndex]
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[160px_60px_1fr_1fr] sm:items-center sm:gap-4 sm:px-5',
                      dayIndex < 6 && 'border-b',
                      row.enabled ? 'bg-white' : 'bg-gray-50/50',
                    )}
                  >
                    <div className="flex items-center justify-between sm:contents">
                      <span className={cn('text-sm font-medium', row.enabled ? 'text-gray-900' : 'text-gray-400')}>
                        {label}
                      </span>

                      {/* Toggle */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => updateDay(dayIndex, { enabled: !row.enabled })}
                          className={cn(
                            'relative h-6 w-11 rounded-full transition-colors',
                            row.enabled ? 'bg-brand-600' : 'bg-gray-300',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                              row.enabled && 'translate-x-5',
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Time inputs — side by side on mobile */}
                    {row.enabled && (
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={e => updateDay(dayIndex, { startTime: e.target.value })}
                          className={inputCls}
                        />
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={e => updateDay(dayIndex, { endTime: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    )}
                    {!row.enabled && (
                      <div className="hidden sm:contents">
                        <input type="time" value={row.startTime} disabled className={inputCls} />
                        <input type="time" value={row.endTime} disabled className={inputCls} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={!hasDirty || saving}>
              {saving ? (
                <><Spinner size="sm" className="text-white" /> Guardando...</>
              ) : (
                <><Save size={16} /> Guardar horarios</>
              )}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check size={16} /> Guardado
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
