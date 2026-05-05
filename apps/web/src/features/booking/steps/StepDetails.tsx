'use client'

import { useState, useRef, useEffect } from 'react'
import { Award } from 'lucide-react'
import { cn, formatDateLong, formatTime } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LoyaltyCardView } from '@/features/loyalty/LoyaltyCardView'
import { apiClient } from '@/lib/api'
import type { useBooking } from '../useBooking'

type BookingHook = ReturnType<typeof useBooking>

interface Props {
  booking: BookingHook
}

function Field({
  label,
  required,
  children,
}: {
  label:    string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = cn(
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900',
  'placeholder:text-gray-400',
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
  'dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUSPICIOUS_RE = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b|--|;|'|"|1\s*=\s*1|OR\s+1)/i

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim()) && !SUSPICIOUS_RE.test(v)
}

type Phase = 'email' | 'otp' | 'form'

export function StepDetails({ booking }: Props) {
  const {
    tenant,
    selectedServices,
    selectedProfessional,
    selectedDate,
    selectedSlot,
    guestInfo,
    updateGuestInfo,
    submit,
    submitting,
    submitError,
    timezone,
    requiresMultiTurno,
    serviceBookings,
    loyaltyProgram,
    loyaltyCard,
  } = booking

  // ── OTP state ─────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>('email')
  const [otpSending, setOtpSending] = useState(false)
  const [otpError, setOtpError]   = useState<string | null>(null)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [cooldown, setCooldown]   = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const tenantId = tenant?.id ?? ''

  // ── Phase 1: Request OTP ──────────────────────────────────────────────────
  async function handleRequestOtp() {
    const email = guestInfo.email.trim()
    if (!email) { setEmailError('Ingresá tu email.'); return }
    if (!isValidEmail(email)) {
      setEmailError('Ingresá un email válido.')
      return
    }
    setEmailError(null)
    setOtpError(null)
    setOtpSending(true)
    try {
      const res = await apiClient.requestOtp(tenantId, email)
      if (res.sent) {
        setPhase('otp')
        setCooldown(60)
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        setPhase('form')
      }
    } catch (err: any) {
      setOtpError(err?.message ?? 'No se pudo enviar el código. Intentá de nuevo.')
    } finally {
      setOtpSending(false)
    }
  }

  // ── Phase 2: Verify OTP ───────────────────────────────────────────────────
  function handleDigitChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...otpDigits]
    next[index] = value
    setOtpDigits(next)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    // Auto-verify when all 6 digits filled
    if (value && next.every(d => d !== '')) {
      verifyCode(next.join(''))
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const digits = pasted.split('')
      setOtpDigits(digits)
      inputRefs.current[5]?.focus()
      verifyCode(pasted)
    }
  }

  async function verifyCode(code: string) {
    setOtpError(null)
    setVerifying(true)
    try {
      const res = await apiClient.verifyOtp(tenantId, guestInfo.email.trim(), code)
      if (res.valid) {
        if (res.token) {
          try { localStorage.setItem('turnit_guest_token', res.token) } catch {}
        }
        setPhase('form')
      }
    } catch (err: any) {
      setOtpError(err?.message ?? 'Código inválido.')
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } finally {
      setVerifying(false)
    }
  }

  async function handleResendOtp() {
    if (cooldown > 0) return
    setOtpError(null)
    setOtpSending(true)
    try {
      await apiClient.requestOtp(tenantId, guestInfo.email.trim())
      setCooldown(60)
      setOtpDigits(['', '', '', '', '', ''])
    } catch (err: any) {
      setOtpError(err?.message ?? 'No se pudo reenviar el código.')
    } finally {
      setOtpSending(false)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const isValid = guestInfo.name.trim().length > 0

  const totalPrice = requiresMultiTurno
    ? serviceBookings.reduce(
        (acc, b) => acc + (typeof b.service.price === 'string' ? parseFloat(b.service.price) : b.service.price),
        0,
      )
    : selectedServices.reduce(
        (acc, s) => acc + (typeof s.price === 'string' ? parseFloat(s.price) : s.price),
        0,
      )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Confirmá tu reserva</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {phase === 'email'
            ? 'Ingresá tu email para verificar tu identidad.'
            : phase === 'otp'
            ? 'Ingresá el código de 6 dígitos que te enviamos por email.'
            : requiresMultiTurno
            ? `Vas a reservar ${serviceBookings.length} turnos. Completá tus datos para confirmar.`
            : 'Completá tus datos para confirmar el turno.'}
        </p>
      </div>

      {/* Booking summary */}
      {requiresMultiTurno ? (
        <div className="mb-6 space-y-3">
          {serviceBookings.map((b, idx) => (
            <div key={idx} className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:divide-gray-700">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{b.service.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">con {b.professional.displayName}</p>
                </div>
                {(typeof b.service.price === 'string' ? parseFloat(b.service.price) : b.service.price) > 0 && (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
                      typeof b.service.price === 'string' ? parseFloat(b.service.price) : b.service.price,
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm">📅</span>
                <p className="text-sm text-gray-700 capitalize dark:text-gray-300">
                  {formatDateLong(b.date)} — {formatTime(b.slot.startAt, timezone)}
                </p>
              </div>
            </div>
          ))}
          {totalPrice > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total ({serviceBookings.length} turnos)</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPrice)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:divide-gray-700">
          {selectedProfessional && (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">👤</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Profesional</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProfessional.displayName}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-lg">✂️</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Servicio{selectedServices.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedServices.map(s => s.name).join(' + ')}
              </p>
            </div>
          </div>
          {selectedDate && selectedSlot && (
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-lg">📅</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Fecha y hora</p>
                <p className="text-sm font-medium text-gray-900 capitalize dark:text-white">
                  {formatDateLong(selectedDate)} — {formatTime(selectedSlot.startAt, timezone)}
                </p>
              </div>
            </div>
          )}
          {totalPrice > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">💰</span>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Total</p>
              </div>
              <p className="text-base font-bold text-gray-900 dark:text-white">
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPrice)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Phase 1: Email input ─────────────────────────────────────────── */}
      {phase === 'email' && (
        <div className="space-y-4">
          <Field label="Email" required>
            <input
              type="email"
              className={cn(inputCls, emailError && 'border-red-400')}
              placeholder="juan@ejemplo.com"
              value={guestInfo.email}
              onChange={e => {
                updateGuestInfo('email', e.target.value)
                setEmailError(null)
              }}
              onKeyDown={e => e.key === 'Enter' && handleRequestOtp()}
              autoComplete="email"
              autoFocus
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-600">{emailError}</p>
            )}
          </Field>

          {otpError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {otpError}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={!guestInfo.email.trim() || otpSending}
            onClick={handleRequestOtp}
          >
            {otpSending ? (
              <><Spinner size="sm" className="text-white" /> Enviando código…</>
            ) : (
              'Enviar código de verificación'
            )}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Te enviaremos un código de 6 dígitos a tu email para verificar tu identidad.
          </p>
        </div>
      )}

      {/* ── Phase 2: OTP input ───────────────────────────────────────────── */}
      {phase === 'otp' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            Enviamos un código a <strong>{guestInfo.email}</strong>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            ¿No lo encontrás? Revisá tu carpeta de <strong>spam</strong> o <strong>correo no deseado</strong>.
          </div>

          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleDigitKeyDown(i, e)}
                className={cn(
                  'h-12 w-10 rounded-lg border-2 text-center text-lg font-bold text-gray-900 dark:text-white dark:bg-gray-800',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                  otpError ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600',
                )}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Spinner size="sm" /> Verificando…
            </div>
          )}

          {otpError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {otpError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => { setPhase('email'); setOtpError(null); setOtpDigits(['','','','','','']) }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cambiar email
            </button>
            <button
              onClick={handleResendOtp}
              disabled={cooldown > 0 || otpSending}
              className={cn(
                'text-sm font-medium',
                cooldown > 0 ? 'text-gray-400' : 'text-brand-600 hover:text-brand-700',
              )}
            >
              {otpSending ? 'Reenviando…' : cooldown > 0 ? `Reenviar (${cooldown}s)` : 'Reenviar código'}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 3: Guest info form (post-verification) ─────────────────── */}
      {phase === 'form' && (
        <>
          <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            Email verificado: <strong>{guestInfo.email}</strong>
          </div>

          <div className="space-y-4">
            <Field label="Nombre completo" required>
              <input
                type="text"
                className={inputCls}
                placeholder="Juan García"
                value={guestInfo.name}
                onChange={e => updateGuestInfo('name', e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </Field>

            <Field label="Teléfono">
              <input
                type="tel"
                inputMode="tel"
                className={inputCls}
                placeholder="+54 9 11 1234-5678"
                value={guestInfo.phone}
                onChange={e => updateGuestInfo('phone', e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                autoComplete="tel"
              />
            </Field>

            <Field label="Notas para el profesional">
              <textarea
                className={cn(inputCls, 'resize-none')}
                rows={3}
                placeholder="Ej: cabello teñido, alergias, preferencias…"
                value={guestInfo.notes}
                onChange={e => updateGuestInfo('notes', e.target.value)}
              />
            </Field>
          </div>

          {/* Loyalty card */}
          {loyaltyProgram && tenant && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <Award size={16} />
                {loyaltyProgram.cardTitle}
              </div>
              <LoyaltyCardView
                program={loyaltyProgram}
                stampsCount={loyaltyCard?.stampsCount ?? 0}
                rewardsAvailable={loyaltyCard?.rewardsAvailable}
                clientName={loyaltyCard?.clientName}
                tenantName={tenant.name}
              />
              {!loyaltyCard && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Al confirmar tu turno se creará tu tarjeta de fidelidad automáticamente.
                </p>
              )}
            </div>
          )}

          {submitError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={!isValid || submitting}
            onClick={submit}
          >
            {submitting ? (
              <><Spinner size="sm" className="text-white" /> Confirmando…</>
            ) : requiresMultiTurno ? (
              `Confirmar ${serviceBookings.length} turnos`
            ) : (
              'Confirmar turno'
            )}
          </Button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Anotá la fecha y hora del turno. Si necesitás cancelarlo, podés hacerlo desde la sección "Cancelar turno".
          </p>
        </>
      )}
    </div>
  )
}
