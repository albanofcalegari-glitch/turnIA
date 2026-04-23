'use client'

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface DialogProps {
  open:       boolean
  onClose:    () => void
  title?:     string
  children?:  ReactNode
  className?: string
  /** When true the backdrop does NOT dismiss on click. Defaults to false. */
  dismissOnBackdrop?: boolean
  /** Render at a higher z-index (for confirms on top of other dialogs). */
  overlay?: boolean
}

/**
 * Modal reusable. Bloquea scroll del body mientras está abierto y cierra con
 * Escape. No maneja foco (keep it simple — no Radix todavía).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  dismissOnBackdrop = true,
  overlay = false,
}: DialogProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={cn("fixed inset-0 flex items-center justify-center p-4 animate-fade-in", overlay ? "z-[80]" : "z-[70]")}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => dismissOnBackdrop && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        className={cn(
          'relative z-10 w-full max-w-md animate-slide-up rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xl',
          className,
        )}
      >
        {title && (
          <h2 id="dialog-title" className="mb-3 text-lg font-bold text-gray-900">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog — API imperativa con hook useConfirm. Reemplaza window.confirm
// con un dialog estilizado que puede variar título/texto/variant por cada
// invocación. El hook devuelve un `confirm()` que retorna Promise<boolean>.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title?:      string
  message:     ReactNode
  confirmText?: string
  cancelText?:  string
  /** "danger" pinta el botón de confirm en rojo (eliminar/cancelar turnos). */
  variant?:    'primary' | 'danger'
}

interface PendingState extends ConfirmOptions {
  open: boolean
}

export function useConfirm() {
  const [state, setState] = useState<PendingState>({ open: false, message: '' })
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setState({ ...opts, open: true })
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const handle = (value: boolean) => {
    setState((s) => ({ ...s, open: false }))
    resolverRef.current?.(value)
    resolverRef.current = null
  }

  const element = (
    <Dialog
      open={state.open}
      onClose={() => handle(false)}
      title={state.title ?? '¿Confirmar?'}
      dismissOnBackdrop
      overlay
    >
      <div className="text-sm text-gray-600">{state.message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={() => handle(false)}>
          {state.cancelText ?? 'Cancelar'}
        </Button>
        <Button
          variant={state.variant === 'danger' ? 'danger' : 'primary'}
          onClick={() => handle(true)}
        >
          {state.confirmText ?? 'Confirmar'}
        </Button>
      </div>
    </Dialog>
  )

  return { confirm, element }
}
