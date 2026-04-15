'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Upload, Download, Trash2, FileText, Loader2, FolderOpen, User, Bot as BotIcon,
} from 'lucide-react'

interface BotFile {
  id: string
  filename: string
  content_type: string | null
  size_bytes: number
  uploaded_by: string
  uploaded_via: 'owner' | 'self' | 'rental' | 'sponsorship'
  rental_id: string | null
  agreement_id: string | null
  created_at: string
  uploader: {
    id: string
    username: string
    display_name: string
    user_type: string
    avatar_url: string | null
  } | null
}

interface BotFilesPanelProps {
  botId: string
  botUsername: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

const VIA_LABEL: Record<BotFile['uploaded_via'], string> = {
  owner: 'Owner',
  self: 'Bot',
  rental: 'Renter',
  sponsorship: 'Sponsor',
}

export function BotFilesPanel({ botId, botUsername }: BotFilesPanelProps) {
  const [files, setFiles] = useState<BotFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch(`/api/bots/${botId}/files`)
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to load files')
      setLoading(false)
      return
    }
    setFiles((json.data?.files ?? json.files ?? []) as BotFile[])
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  async function uploadFile(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50 MB limit')
      return
    }
    setUploading(true)
    setError(null)
    setProgress(`Uploading ${file.name}…`)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/bots/${botId}/files`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
      } else {
        const newFile = (json.data?.file ?? json.file) as BotFile
        setFiles((prev) => [newFile, ...prev])
      }
    } finally {
      setUploading(false)
      setProgress('')
    }
  }

  async function handleUploadInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  async function downloadFile(f: BotFile) {
    setError(null)
    const res = await fetch(`/api/bots/${botId}/files/${f.id}`)
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to generate download link')
      return
    }
    const url = (json.data?.url ?? json.url) as string
    // Open in a new tab; Supabase signed URLs set content-disposition=attachment
    // via the download option, so the browser will save rather than display.
    window.open(url, '_blank', 'noopener')
  }

  async function deleteFile(f: BotFile) {
    if (!confirm(`Delete ${f.filename}? This cannot be undone.`)) return
    setDeleting(f.id)
    const res = await fetch(`/api/bots/${botId}/files/${f.id}`, { method: 'DELETE' })
    if (res.ok) {
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } else {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Delete failed')
    }
    setDeleting(null)
  }

  const totalBytes = files.reduce((s, f) => s + f.size_bytes, 0)

  return (
    <div className="space-y-3">
      {/* Dropzone / upload */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-gray-200 bg-gray-50 hover:border-indigo-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleUploadInput}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            {uploading
              ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              : <Upload className="w-5 h-5 text-indigo-600" />}
          </div>
          {uploading ? (
            <p className="text-xs font-medium text-indigo-700">{progress}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800">
                Drag a file here or{' '}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  pick one
                </button>
              </p>
              <p className="text-[11px] text-gray-400">
                Up to 50 MB · private to @{botUsername}, its owner, and active renters / sponsors
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* File list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-50 animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center text-gray-400 py-10 border border-dashed border-gray-200 rounded-xl">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No files yet</p>
          <p className="text-xs mt-0.5">Upload something above to share it with the bot.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
            <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
            <span>{formatBytes(totalBytes)} used</span>
          </div>
          <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
            {files.map((f) => {
              const isBot = f.uploader?.user_type === 'agent'
              return (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.filename}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      <span>{formatBytes(f.size_bytes)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        {isBot
                          ? <BotIcon className="w-2.5 h-2.5 text-violet-500" />
                          : <User className="w-2.5 h-2.5 text-gray-400" />}
                        {f.uploader?.username ?? 'unknown'}
                      </span>
                      <span>·</span>
                      <span>{VIA_LABEL[f.uploaded_via]}</span>
                      <span>·</span>
                      <span>{formatDate(f.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadFile(f)}
                      className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFile(f)}
                      disabled={deleting === f.id}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-40"
                      title="Delete"
                    >
                      {deleting === f.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={load}>
            Refresh
          </Button>
        </>
      )}
    </div>
  )
}
