'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { BrandLogo } from '@/components/ui/BrandLogo'

const BUSINESS_TYPES = [
  { value: 'peluqueria', label: 'Peluquería' },
  { value: 'barberia',   label: 'Barbería' },
  { value: 'spa',        label: 'Spa' },
  { value: 'estetica',   label: 'Centro de estética' },
  { value: 'masajes',    label: 'Masajes' },
  { value: 'custom',     label: 'Otro' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

export default function RegisterPage() {
  const { login } = useAuth()

  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [businessName, setBusinessName] = useState('')
  const [slug,         setSlug]         = useState('')
  const [slugManual,   setSlugManual]   = useState(false)
  const [type,         setType]         = useState('peluqueria')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  // Stage 1 (branches): the owner declares whether the business has multiple
  // sucursales. If they say yes, they can also name the first branch.
  // Single-location tenants leave both at default and never see branch UI.
  const [hasMultipleBranches, setHasMultipleBranches] = useState(false)
  const [defaultBranchName,   setDefaultBranchName]   = useState('')
  const [confirmPwd,   setConfirmPwd]   = useState('')
  const [showPwd,      setShowPwd]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function handleBusinessNameChange(value: string) {
    setBusinessName(value)
    if (!slugManual) setSlug(slugify(value))
  }

  function handleSlugChange(value: string) {
    setSlugManual(true)
    setSlug(slugify(value))
  }

  const isValid =
    firstName.trim() &&
    lastName.trim() &&
    businessName.trim() &&
    slug.length >= 3 &&
    email.trim() &&
    password.length >= 6 &&
    password === confirmPwd

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loading || !isValid) return
    setError(null)
    setLoading(true)

    try {
      // 1. Register tenant + admin user
      await apiClient.registerTenant({
        name:           businessName.trim(),
        slug,
        type,
        adminEmail:     email.trim(),
        adminPassword:  password,
        adminFirstName: firstName.trim(),
        adminLastName:  lastName.trim(),
        hasMultipleBranches,
        // Only send the custom branch name when the owner declared multi-branch
        // AND actually typed something. Otherwise let the backend default to
        // "Sucursal principal".
        defaultBranchName: hasMultipleBranches && defaultBranchName.trim()
          ? defaultBranchName.trim()
          : undefined,
      })

      // 2. Auto-login with the new credentials
      await login(email.trim(), password)
      // login() redirects to /dashboard on success
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.message) // backend ya responde en español
      } else if (err instanceof ApiError && err.status === 400) {
        setError(err.message)
      } else {
        setError('Error al crear la cuenta. Verificá los datos e intentá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/"><BrandLogo size="lg" /></Link>
          <p className="mt-1 text-sm text-gray-500">Creá tu cuenta y empezá a recibir turnos</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card sm:p-8">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Registrar tu negocio</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Juan"
                  autoComplete="given-name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Apellido</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="García"
                  autoComplete="family-name"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Business name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre del negocio</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={e => handleBusinessNameChange(e.target.value)}
                placeholder="Mi negocio"
                className={inputCls}
              />
            </div>

            {/* Slug */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Identificador (URL)
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-400">turnit.com/</span>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="mi-negocio"
                  className={inputCls}
                />
              </div>
              {slug && slug.length < 3 && (
                <p className="mt-1 text-xs text-red-500">Mínimo 3 caracteres</p>
              )}
            </div>

            {/* Business type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo de negocio</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className={inputCls}
              >
                {BUSINESS_TYPES.map(bt => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </div>

            {/* ── Multi-branch question ──────────────────────────────────── */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                ¿Tu negocio tiene varias sucursales?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHasMultipleBranches(false)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    !hasMultipleBranches
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  No, una sola
                </button>
                <button
                  type="button"
                  onClick={() => setHasMultipleBranches(true)}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                    hasMultipleBranches
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50',
                  )}
                >
                  Sí, varias
                </button>
              </div>
              {hasMultipleBranches && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nombre de la sucursal principal
                  </label>
                  <input
                    type="text"
                    value={defaultBranchName}
                    onChange={e => setDefaultBranchName(e.target.value)}
                    placeholder="Ej: Sucursal Centro"
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Después podés agregar más sucursales desde el panel.
                  </p>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@negocio.com"
                autoComplete="email"
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  className={cn(inputCls, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirmar contraseña</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  className={cn(inputCls, 'pr-10', confirmPwd && password !== confirmPwd && 'border-red-400')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPwd && password !== confirmPwd && (
                <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading || !isValid}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Creando cuenta…
                </>
              ) : (
                'Crear cuenta'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
