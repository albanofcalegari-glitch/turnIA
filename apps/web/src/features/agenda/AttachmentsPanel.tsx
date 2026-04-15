'use client'

import { useEffect, useRef, useState } from 'react'
import { Paperclip, Trash2, Upload, FileText, Loader2 } from 'lucide-react'
import { apiClient, type Attachment } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/ui/Dialog'

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1')
  .replace(/\/api\/v1\/?$/, '')

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'

interface Props {
  tenantId:      string
  appointmentId: string
}

export function AttachmentsPanel({ tenantId, appointmentId }: Props) {
  const [open,        setOpen]       = useState(false)
  const [items,       setItems]      = useState<Attachment[]>([])
  const [loading,     setLoading]    = useState(false)
  const [uploading,   setUploading]  = useState(false)
  const [error,       setError]      = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { confirm, element: confirmDialog } = useConfirm()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    apiClient.listAttachments(tenantId, appointmentId)
      .then(data => { if (!cancelled) setItems(data) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar adjuntos') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, tenantId, appointmentId])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const created = await apiClient.uploadAttachment(tenantId, appointmentId, file)
      setItems(prev => [created, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(att: Attachment) {
    const ok = await confirm({
      title:       'Eliminar adjunto',
      message:     <>¿Eliminar <strong>{att.filename}</strong>? Esta acción no se puede deshacer.</>,
      confirmText: 'Eliminar',
      variant:     'danger',
    })
    if (!ok) return
    try {
      await apiClient.deleteAttachment(tenantId, appointmentId, att.id)
      setItems(prev => prev.filter(x => x.id !== att.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Adjuntos {items.length > 0 && <span className="text-gray-400">({items.length})</span>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileSelected}
              disabled={uploading}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload    className="h-3.5 w-3.5" />}
              {uploading ? 'Subiendo…' : 'Subir archivo'}
            </button>
            <span className="text-[11px] text-gray-400">Imagen o PDF · máx 10 MB</span>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {loading && <p className="text-xs text-gray-500">Cargando…</p>}

          {!loading && items.length === 0 && (
            <p className="text-xs text-gray-400">Sin adjuntos.</p>
          )}

          {items.length > 0 && (
            <ul className="space-y-1.5">
              {items.map(att => (
                <AttachmentRow
                  key={att.id}
                  att={att}
                  onDelete={() => handleDelete(att)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {confirmDialog}
    </div>
  )
}

function AttachmentRow({ att, onDelete }: { att: Attachment; onDelete: () => void }) {
  const isImage = att.mimeType.startsWith('image/')
  const href    = `${API_ORIGIN}${att.url}`
  return (
    <li className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100',
          isImage && 'hover:ring-2 hover:ring-brand-200',
        )}
      >
        {isImage
          ? <img src={href} alt={att.filename} className="h-full w-full object-cover" />
          : <FileText className="h-5 w-5 text-gray-500" />}
      </a>
      <div className="flex-1 min-w-0">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs font-medium text-gray-700 hover:text-brand-700"
          title={att.filename}
        >
          {att.filename}
        </a>
        <p className="text-[11px] text-gray-400">{formatBytes(att.sizeBytes)}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        aria-label="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function formatBytes(n: number): string {
  if (n < 1024)        return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
