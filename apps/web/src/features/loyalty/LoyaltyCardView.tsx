'use client'

import { Check, Gift, Star } from 'lucide-react'

interface RewardView {
  position:       number
  stampsRequired: number
  rewardLabel:    string
}

interface LoyaltyProgramView {
  stampsRequired:  number
  rewardLabel:     string
  cardTitle:       string
  cardSubtitle?:   string | null
  cardColor:       string
  cardAccentColor?: string | null
  rewards?:        RewardView[]
}

interface Props {
  program: LoyaltyProgramView
  stampsCount: number
  rewardsAvailable?: number
  qrUrl?: string
  clientName?: string
  tenantName?: string
}

export function LoyaltyCardView({
  program,
  stampsCount,
  rewardsAvailable = 0,
  qrUrl,
  clientName,
  tenantName,
}: Props) {
  const rewards = (program.rewards ?? []).sort((a, b) => a.stampsRequired - b.stampsRequired)
  const cycleTotal = rewards.length > 0
    ? Math.max(...rewards.map(r => r.stampsRequired))
    : program.stampsRequired
  const milestonePositions = new Set(rewards.map(r => r.stampsRequired))
  const milestoneLabelMap = new Map(rewards.map(r => [r.stampsRequired, r.rewardLabel]))

  const stamps = Array.from({ length: cycleTotal }, (_, i) => i < stampsCount)

  const bg     = program.cardColor
  const accent = program.cardAccentColor ?? lighten(bg, 0.25)

  return (
    <div
      className="relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl text-white shadow-xl"
      style={{ backgroundColor: bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
          {tenantName ?? 'Club'}
        </div>
        <div className="text-sm font-semibold">{program.cardTitle}</div>
      </div>

      {/* Stamp grid */}
      <div
        className="relative mt-4 px-5 py-6"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${accent} 0 16px, ${bg} 16px 32px)`,
        }}
      >
        <div className="flex flex-wrap justify-center gap-2">
          {stamps.map((filled, i) => {
            const stampNum = i + 1
            const isMilestone = milestonePositions.has(stampNum)

            return (
              <div key={i} className="relative">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm transition-all sm:h-11 sm:w-11 ${
                    isMilestone ? 'border-amber-300' : 'border-white/90'
                  }`}
                  style={{ backgroundColor: filled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)' }}
                  title={isMilestone ? milestoneLabelMap.get(stampNum) : undefined}
                >
                  {filled ? (
                    isMilestone
                      ? <Star size={18} style={{ color: '#f59e0b' }} strokeWidth={3} fill="#f59e0b" />
                      : <Check size={18} style={{ color: bg }} strokeWidth={3} />
                  ) : (
                    isMilestone
                      ? <Gift size={14} className="text-amber-300" />
                      : <span className="text-xs font-bold text-white/70">{stampNum}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rewards summary */}
      <div className="px-5 py-4 text-xs">
        {rewards.length > 1 ? (
          <div className="space-y-1">
            {rewards.map(r => (
              <div key={r.position} className="flex items-center justify-between">
                <span className="opacity-70">Sello {r.stampsRequired}:</span>
                <span className="font-semibold">{r.rewardLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold uppercase tracking-wider opacity-70">Oferta</div>
              <div className="mt-0.5 text-sm font-semibold leading-tight">
                {program.cardSubtitle ?? program.rewardLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold uppercase tracking-wider opacity-70">Sellos</div>
              <div className="mt-0.5 text-sm font-semibold">
                {stampsCount}/{cycleTotal}
              </div>
            </div>
          </div>
        )}

        {rewardsAvailable > 0 && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold" style={{ color: bg }}>
              <Gift size={12} /> {rewardsAvailable} reward{rewardsAvailable === 1 ? '' : 's'} disponible{rewardsAvailable === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* QR */}
      {qrUrl && (
        <div className="flex flex-col items-center gap-1 bg-white px-5 py-4">
          <QrCode value={qrUrl} size={128} />
          {clientName && <div className="text-[11px] font-medium text-gray-500">{clientName}</div>}
        </div>
      )}
    </div>
  )
}

function QrCode({ value, size = 128 }: { value: string; size?: number }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`
  return (
    <img
      src={src}
      alt="QR de la tarjeta"
      width={size}
      height={size}
      className="rounded-md"
    />
  )
}

function lighten(hex: string, factor: number) {
  const parsed = hex.replace('#', '')
  if (parsed.length !== 6) return hex
  const r = parseInt(parsed.slice(0, 2), 16)
  const g = parseInt(parsed.slice(2, 4), 16)
  const b = parseInt(parsed.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * factor)
  const toHex = (c: number) => c.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}
