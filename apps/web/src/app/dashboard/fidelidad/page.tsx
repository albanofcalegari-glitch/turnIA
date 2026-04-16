'use client'

import { useEffect, useState } from 'react'
import { Award, Gift, Loader2, Save, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, type LoyaltyProgram, type LoyaltyRewardType, type LoyaltyCardWithClient } from '@/lib/api'
import { LoyaltyCardView } from '@/features/loyalty/LoyaltyCardView'
import { Spinner } from '@/components/ui/Spinner'

type Tab = 'config' | 'cards'

export default function FidelidadPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('config')

  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center gap-2">
        <Award className="text-brand-600" size={20} />
        <h1 className="text-xl font-semibold text-gray-900">Club de Fidelidad</h1>
      </div>

      <div className="mb-4 flex gap-1 border-b">
        <TabButton active={tab === 'config'} onClick={() => setTab('config')}>Configuración</TabButton>
        <TabButton active={tab === 'cards'}  onClick={() => setTab('cards')}>Tarjetas de clientes</TabButton>
      </div>

      {tab === 'config' ? <ProgramConfig isAdmin={user.role === 'ADMIN'} /> : <CardsList />}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

// ── Configuración del programa ──────────────────────────────────────────────

function ProgramConfig({ isAdmin }: { isAdmin: boolean }) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient.getLoyaltyProgram()
      .then(setProgram)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error)   return <ErrorBox message={error} />
  if (!program) return null

  function update<K extends keyof LoyaltyProgram>(key: K, value: LoyaltyProgram[K]) {
    setProgram(p => p ? { ...p, [key]: value } : p)
  }

  async function save() {
    if (!program) return
    setSaving(true)
    setError(null)
    try {
      const saved = await apiClient.updateLoyaltyProgram({
        isActive:           program.isActive,
        stampsRequired:     program.stampsRequired,
        rewardType:         program.rewardType,
        rewardValue:        program.rewardValue === null ? null : Number(program.rewardValue),
        rewardLabel:        program.rewardLabel,
        eligibleServiceIds: program.eligibleServiceIds,
        cardTitle:          program.cardTitle,
        cardSubtitle:       program.cardSubtitle,
        cardColor:          program.cardColor,
        cardAccentColor:    program.cardAccentColor,
        cardBgImageUrl:     program.cardBgImageUrl,
      })
      setProgram(saved)
      setSavedAt(new Date())
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Form */}
      <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
        <Field label="Programa activo" hint="Cuando está activo, los clientes registrados acumulan sellos al completar un turno.">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={program.isActive}
              onChange={e => update('isActive', e.target.checked)}
              disabled={!isAdmin}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm text-gray-700">{program.isActive ? 'Activo' : 'Inactivo'}</span>
          </label>
        </Field>

        <Field label="Sellos requeridos" hint="Cantidad de turnos completados para obtener el beneficio.">
          <input
            type="number"
            min={1}
            max={50}
            value={program.stampsRequired}
            onChange={e => update('stampsRequired', Number(e.target.value))}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </Field>

        <Field label="Tipo de beneficio">
          <select
            value={program.rewardType}
            onChange={e => update('rewardType', e.target.value as LoyaltyRewardType)}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="FREE_SERVICE">Servicio gratis</option>
            <option value="DISCOUNT_PERCENT">Descuento (%)</option>
            <option value="DISCOUNT_AMOUNT">Descuento (monto fijo)</option>
          </select>
        </Field>

        {program.rewardType !== 'FREE_SERVICE' && (
          <Field label={program.rewardType === 'DISCOUNT_PERCENT' ? 'Porcentaje de descuento' : 'Monto del descuento'}>
            <input
              type="number"
              min={0}
              step={program.rewardType === 'DISCOUNT_PERCENT' ? 1 : 100}
              value={program.rewardValue === null ? '' : String(program.rewardValue)}
              onChange={e => update('rewardValue', e.target.value === '' ? null : Number(e.target.value))}
              disabled={!isAdmin}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
        )}

        <Field label="Etiqueta del beneficio" hint='Texto que ve el cliente: "Corte gratis", "20% OFF", etc.'>
          <input
            type="text"
            maxLength={120}
            value={program.rewardLabel}
            onChange={e => update('rewardLabel', e.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>

        <div className="border-t pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Diseño de la tarjeta</div>
          <Field label="Título">
            <input
              type="text"
              maxLength={60}
              value={program.cardTitle}
              onChange={e => update('cardTitle', e.target.value)}
              disabled={!isAdmin}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Subtítulo">
            <input
              type="text"
              maxLength={120}
              value={program.cardSubtitle ?? ''}
              onChange={e => update('cardSubtitle', e.target.value || null)}
              disabled={!isAdmin}
              placeholder="Cada 5 cortes, uno GRATIS"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Color principal">
              <input
                type="color"
                value={program.cardColor}
                onChange={e => update('cardColor', e.target.value)}
                disabled={!isAdmin}
                className="h-10 w-full rounded-lg border border-gray-300"
              />
            </Field>
            <Field label="Color de acento">
              <input
                type="color"
                value={program.cardAccentColor ?? '#3b82f6'}
                onChange={e => update('cardAccentColor', e.target.value)}
                disabled={!isAdmin}
                className="h-10 w-full rounded-lg border border-gray-300"
              />
            </Field>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3 border-t pt-4">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
            {savedAt && (
              <span className="text-xs text-green-600">Guardado a las {savedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>
        )}

        {error && <ErrorBox message={error} />}
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Preview</div>
        <LoyaltyCardView
          program={program}
          stampsCount={Math.min(2, program.stampsRequired)}
        />
        <p className="text-center text-xs text-gray-500">
          Así la ve tu cliente. Con el QR, puede mostrarla cuando viene al local.
        </p>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{message}</div>
}

// ── Lista de tarjetas de clientes ───────────────────────────────────────────

function CardsList() {
  const [cards, setCards]     = useState<LoyaltyCardWithClient[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setCards(await apiClient.listLoyaltyCards())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function redeem(cardId: string) {
    setRedeeming(cardId)
    try {
      await apiClient.redeemLoyaltyReward(cardId)
      await load()
    } catch (e: any) {
      alert(e.message ?? 'Error al canjear')
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>
  if (error)   return <ErrorBox message={error} />
  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
        <Users className="mx-auto mb-2 text-gray-300" size={32} />
        Todavía no hay tarjetas. Apenas un cliente complete su primer turno, se le crea una automáticamente.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Sellos</th>
            <th className="px-4 py-3">Rewards</th>
            <th className="px-4 py-3">Último sello</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cards.map(card => (
            <tr key={card.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{card.client.firstName} {card.client.lastName}</div>
                <div className="text-xs text-gray-400">{card.client.email ?? card.client.phone ?? '—'}</div>
              </td>
              <td className="px-4 py-3 text-gray-700">{card.stampsCount}</td>
              <td className="px-4 py-3">
                {card.rewardsAvailable > 0
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><Gift size={12} /> {card.rewardsAvailable} disponible{card.rewardsAvailable === 1 ? '' : 's'}</span>
                  : <span className="text-xs text-gray-400">—</span>
                }
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {card.lastStampAt ? new Date(card.lastStampAt).toLocaleDateString('es-AR') : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                {card.rewardsAvailable > 0 && (
                  <button
                    onClick={() => redeem(card.id)}
                    disabled={redeeming === card.id}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {redeeming === card.id ? '…' : 'Canjear'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
