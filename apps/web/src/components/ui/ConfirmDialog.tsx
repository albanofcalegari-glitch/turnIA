'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ConfirmVariant = 'default' | 'danger'

export interface ConfirmOptions {
  title?:       string
  message:      string | React.ReactNode
  confirmText?: string
  cancelText?:  string
  variant?:     ConfirmVariant
}

type Resolver = (ok: boolean) => void

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx.confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<Resolver | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve
      setOpts(next)
    })
  }, [])

  const close = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOpts(null)
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog opts={opts} onClose={close} />
    </ConfirmContext.Provider>
  )
}

function ConfirmDialog({ opts, onClose }: { opts: ConfirmOptions | null; onClose: (ok: boolean) => void }) {
  const open = opts !== null
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(false) }
      if (e.key === 'Enter')  { e.preventDefault(); onClose(true) }
    }
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => confirmRef.current?.focus(), 0)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t) }
  }, [open, onClose])

  if (!open || !opts) return null

  const variant = opts.variant ?? 'default'
  const isDanger = variant === 'danger'
  const Icon = isDanger ? AlertTriangle : HelpCircle

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex gap-4">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isDanger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600',
            )}>
              <Icon size={20} />
            </div>
            <div className="flex-1">
              {opts.title && (
                <h2 className="text-base font-semibold text-gray-900">{opts.title}</h2>
              )}
              <div className={cn('text-sm text-gray-600 whitespace-pre-line', opts.title && 'mt-1')}>
                {opts.message}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-gray-50 px-6 py-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            {opts.cancelText ?? 'Cancelar'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2',
              isDanger
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                : 'bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500',
            )}
          >
            {opts.confirmText ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
