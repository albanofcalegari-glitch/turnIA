'use client'

import { Check, Gift } from 'lucide-react'

interface LoyaltyProgramView {
  stampsRequired:  number
  rewardLabel:     string
  cardTitle:       string
  cardSubtitle?:   string | null
  cardColor:       string
  cardAccentColor?: string | null
}

interface Props {
  program: LoyaltyProgramView
  /**
   * stampsCount actual — puede venir de una card real o ser un número arbitrario
   * cuando la usamos para preview en la pantalla de configuración.
   */
  stampsCount: number
  rewardsAvailable?: number
  /** QR target URL. Si no se pasa, no se renderiza el QR (preview). */
  qrUrl?: string
  /** Nombre del cliente a mostrar en el header; si no se pasa queda oculto. */
  clientName?: string
  /** Nombre del tenant (logo textual). */
  tenantName?: string
}

/**
 * Tarjeta de fidelidad — diseño inspirado en stamp cards tipo rep.eat:
 * header con nombre del club, grilla de sellos, franja de oferta y QR.
 * Es 100% responsive y puede renderizarse en mobile standalone o dentro de un
 * card container en desktop. Todo el styling sale de program.cardColor /
 * cardAccentColor para que cada tenant tenga su look.
 */
export function LoyaltyCardView({
  program,
  stampsCount,
  rewardsAvailable = 0,
  qrUrl,
  clientName,
  tenantName,
}: Props) {
  const required = program.stampsRequired
  const stamps   = Array.from({ length: required }, (_, i) => i < stampsCount)

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

      {/* Stripes / accent band con sellos */}
      <div
        className="relative mt-4 px-5 py-6"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${accent} 0 16px, ${bg} 16px 32px)`,
        }}
      >
        <div className="flex justify-center gap-2">
          {stamps.map((filled, i) => (
            <div
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/90 shadow-sm transition-all sm:h-11 sm:w-11"
              style={{ backgroundColor: filled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)' }}
            >
              {filled
                ? <Check size={18} style={{ color: bg }} strokeWidth={3} />
                : <span className="text-xs font-bold text-white/70">{i + 1}</span>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Oferta / premios */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 text-xs">
        <div>
          <div className="font-bold uppercase tracking-wider opacity-70">Oferta</div>
          <div className="mt-0.5 text-sm font-semibold leading-tight">
            {program.cardSubtitle ?? program.rewardLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold uppercase tracking-wider opacity-70">Sellos</div>
          <div className="mt-0.5 text-sm font-semibold">
            {stampsCount}/{required}
            {rewardsAvailable > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold" style={{ color: bg }}>
                <Gift size={10} /> {rewardsAvailable}
              </span>
            )}
          </div>
        </div>
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

// ── Mini QR usando google charts (sin dep adicional — se carga como <img>) ─
// Para producción podríamos cambiarlo a qrcode.react, pero para v1 nos sirve
// perfecto y evita instalar una dependencia sólo para el MVP.
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

/** Aclara un color hex mezclándolo con blanco. Usado para generar el accent por default. */
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
