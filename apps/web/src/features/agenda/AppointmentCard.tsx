'use client'

import { useState } from 'react'
import { Gift, CreditCard, Banknote, ArrowRightLeft, Wallet } from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { apiClient } from '@/lib/api'
import { StatusBadge } from './StatusBadge'
import { AttachmentsPanel } from './AttachmentsPanel'
import { ALLOWED_ACTIONS, type Appointment, type AppointmentAction } from './agenda.types'

// ── Action button config ───────────────────────────────────────────────────

const ACTION_CONFIG: Record<AppointmentAction, { label: string; cls: string }> = {
  confirm:  { label: 'Confirmar',  cls: 'text-brand-700 bg-brand-50 hover:bg-brand-100 border-brand-200' },
  complete: { label: 'Completar',  cls: 'text-gray-700  bg-gray-50  hover:bg-gray-100  border-gray-200'  },
  no_show:  { label: 'No vino',    cls: 'text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200' },
  cancel:   { label: 'Cancelar',   cls: 'text-red-700   bg-red-50   hover:bg-red-100   border-red-200'   },
  reopen:   { label: 'Reabrir',    cls: 'text-brand-700 bg-white     hover:bg-brand-50  border-brand-200' },
}

const PAYMENT_METHODS = [
  { value: 'CASH',         label: 'Efectivo',          icon: Banknote },
  { value: 'DEBIT_CARD',   label: 'Tarjeta débito',    icon: CreditCard },
  { value: 'CREDIT_CARD',  label: 'Tarjeta crédito',   icon: CreditCard },
  { value: 'TRANSFER',     label: 'Transferencia',     icon: ArrowRightLeft },
  { value: 'MERCADOPAGO',  label: 'MercadoPago',       icon: Wallet },
]

const PAYMENT_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map(p => [p.value, p.label]))

interface Props {
  appointment:  Appointment
  timezone:     string
  isLoading:    boolean
  onAction:     (action: AppointmentAction, payload?: { reason?: string; paymentMethod?: string }) => void
  onLoyaltyRedeemed?: () => void
}

export function AppointmentCard({ appointment, timezone, isLoading, onAction, onLoyaltyRedeemed }: Props) {
  const confirm = useConfirm()
  const [showCancel,    setShowCancel]    = useState(false)
  const [showComplete,  setShowComplete]  = useState(false)
  const [reason,        setReason]        = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [redeeming,     setRedeeming]     = useState(false)

  const {
    status, startAt, endAt, totalMinutes, items, professional, client,
    guestName, guestEmail, notes,
  } = appointment

  const clientName = guestName
    || (client ? `${client.firstName} ${client.lastName}` : 'Invitado')

  const sortedItems = [...items].sort((a, b) => a.order - b.order)

  const loyaltyCard = client?.loyaltyCard ?? null
  const hasReward   = (loyaltyCard?.rewardsAvailable ?? 0) > 0

  const allowedActions = ALLOWED_ACTIONS[status] ?? []
  const isTerminal = status === 'COMPLETED' || status === 'NO_SHOW' || status === 'CANCELLED'

  async function handleRedeem() {
    if (!loyaltyCard) return
    const ok = await confirm({
      title:       'Canjear reward',
      message:     `¿Canjear 1 reward para ${clientName}? Le quedan ${loyaltyCard.rewardsAvailable} disponible(s).`,
      confirmText: 'Canjear',
    })
    if (!ok) return
    setRedeeming(true)
    try {
      await apiClient.redeemLoyaltyReward(loyaltyCard.id, appointment.id)
      onLoyaltyRedeemed?.()
    } catch { /* silently fail — backend validates */ }
    finally { setRedeeming(false) }
  }

  function handleCancel() {
    onAction('cancel', { reason: reason.trim() || undefined })
    setShowCancel(false)
    setReason('')
  }

  function handleComplete() {
    onAction('complete', { paymentMethod })
    setShowComplete(false)
    setPaymentMethod('CASH')
  }

  return (
    <div className={cn(
      'group relative rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm',
      isTerminal && 'opacity-60',
    )}>
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
          <Spinner size="md" />
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold tabular-nums text-gray-900">
            {formatTime(startAt, timezone)}
          </span>
          <span className="text-xs text-gray-400">
            → {formatTime(endAt, timezone)} · {totalMinutes} min
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Client + service */}
      <div className="mt-2">
        <p className="font-semibold text-gray-900">{clientName}</p>
        {(guestEmail || client?.email) && (
          <p className="text-xs text-gray-400">{guestEmail ?? client?.email}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {sortedItems.map(item => {
            const color = item.service?.color ?? '#6b7280'
            return (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-gray-700"
                style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}
              >
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {item.serviceName}
              </span>
            )
          })}
        </div>
      </div>

      {/* Professional */}
      <div className="mt-2 flex items-center gap-1.5">
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{ backgroundColor: professional.color ?? '#6b7280' }}
        >
          {professional.displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="text-xs text-gray-500">{professional.displayName}</span>
      </div>

      {/* Payment method badge (completed appointments) */}
      {status === 'COMPLETED' && appointment.paymentMethod && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
            <CreditCard size={10} />
            {PAYMENT_LABELS[appointment.paymentMethod] ?? appointment.paymentMethod}
          </span>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600 italic">
          "{notes}"
        </p>
      )}

      {/* Loyalty reward chip */}
      {hasReward && !isTerminal && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
            <Gift size={13} />
            {loyaltyCard!.rewardsAvailable} reward{loyaltyCard!.rewardsAvailable > 1 ? 's' : ''} disponible{loyaltyCard!.rewardsAvailable > 1 ? 's' : ''}
          </span>
          <button
            disabled={redeeming || isLoading}
            onClick={handleRedeem}
            className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {redeeming ? 'Canjeando…' : 'Canjear'}
          </button>
        </div>
      )}

      {/* Action buttons */}
      {allowedActions.length > 0 && !showCancel && !showComplete && (
        <div className="mt-3 flex flex-wrap gap-2">
          {allowedActions.filter(a => a !== 'cancel' && a !== 'complete').map(action => (
            <button
              key={action}
              disabled={isLoading}
              onClick={() => onAction(action)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                ACTION_CONFIG[action].cls,
              )}
            >
              {ACTION_CONFIG[action].label}
            </button>
          ))}
          {allowedActions.includes('complete') && (
            <button
              disabled={isLoading}
              onClick={() => setShowComplete(true)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                ACTION_CONFIG.complete.cls,
              )}
            >
              {ACTION_CONFIG.complete.label}
            </button>
          )}
          {allowedActions.includes('cancel') && (
            <button
              disabled={isLoading}
              onClick={() => setShowCancel(true)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                ACTION_CONFIG.cancel.cls,
              )}
            >
              {ACTION_CONFIG.cancel.label}
            </button>
          )}
        </div>
      )}

      {/* Attachments */}
      <AttachmentsPanel tenantId={appointment.tenantId} appointmentId={appointment.id} />

      {/* Complete with payment method */}
      {showComplete && (
        <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-800">Medio de pago</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PAYMENT_METHODS.map(pm => {
              const selected = paymentMethod === pm.value
              return (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => setPaymentMethod(pm.value)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
                    selected
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  <pm.icon size={13} className={selected ? 'text-brand-600' : 'text-gray-400'} />
                  {pm.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleComplete}
              className="flex-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Completar turno
            </button>
            <button
              onClick={() => { setShowComplete(false); setPaymentMethod('CASH') }}
              className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation inline */}
      {showCancel && (
        <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-800">¿Confirmar cancelación?</p>
          <input
            type="text"
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-md border border-red-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Sí, cancelar
            </button>
            <button
              onClick={() => { setShowCancel(false); setReason('') }}
              className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              No, volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
