'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { PRODUCT_CATEGORIES, USD_PER_CREDIT } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { X, ShoppingBag, Upload, Palette, FileText, Info } from 'lucide-react'

const STARTER_AA_INFO =
  'Starter AA credits cannot be cashed out directly. The founder plans to buy them back at minimum 1.25:1, aiming for 2:1 based on ecosystem activity. Accepting Starter AA increases your potential buyer pool.'

interface CreateListingModalProps {
  onClose: () => void
  onCreated: (product: { id: string; title: string; price_credits: number; category: string; is_active: boolean; purchase_count: number; file_url: string | null; is_digital_art: boolean }) => void
}

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CreateListingModal({ onClose, onCreated }: CreateListingModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceCredits, setPriceCredits] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [isDigitalArt, setIsDigitalArt] = useState(false)
  const [acceptStarterAA, setAcceptStarterAA] = useState(true)
  const [showStarterInfo, setShowStarterInfo] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const priceNum = parseInt(priceCredits) || 0
  const usdPreview = priceNum > 0 ? `$${(priceNum * USD_PER_CREDIT).toFixed(2)}` : null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > MAX_FILE_BYTES) {
      setError('File must be under 50 MB')
      e.target.value = ''
      return
    }
    setFile(f)
    setError(null)
  }

  async function uploadFile(userId: string): Promise<{ url: string; name: string; size: number } | null> {
    if (!file) return null
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('product-files')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data } = supabase.storage.from('product-files').getPublicUrl(path)
    return { url: data.publicUrl, name: file.name, size: file.size }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !priceNum || !category) return
    setError(null)
    setLoading(true)
    try {
      // Get current user id for file path
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }

      let fileData: { url: string; name: string; size: number } | null = null
      if (file) {
        fileData = await uploadFile(user.id)
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price_credits: priceNum,
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          is_digital_art: isDigitalArt,
          accept_starter_aa: acceptStarterAA,
          file_url: fileData?.url ?? null,
          file_name: fileData?.name ?? null,
          file_size_bytes: fileData?.size ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create listing')
        return
      }
      onCreated(data)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">List a Product</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. SEO blog post — 1,000 words"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Describe what the buyer gets…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (AA Credits)</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min={1}
                  value={priceCredits}
                  onChange={(e) => setPriceCredits(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                  placeholder="50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">AA</span>
              </div>
              {usdPreview && <p className="text-xs text-gray-400 mt-1">≈ {usdPreview}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Select…</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="seo, content, writing"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attach file <span className="text-gray-400 font-normal">(PDF, ZIP, image, etc. — max 50 MB)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.zip,.png,.jpg,.jpeg,.gif,.mp4,.mp3,.svg,.ai,.psd,.sketch,.fig,.csv,.json,.txt,.docx,.xlsx"
            />
            {file ? (
              <div className="flex items-center gap-3 border border-indigo-200 bg-indigo-50 rounded-lg px-3 py-2.5">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-indigo-800 truncate">{file.name}</p>
                  <p className="text-xs text-indigo-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-indigo-400 hover:text-indigo-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Click to attach a file
              </button>
            )}
          </div>

          {/* Digital art toggle */}
          <div
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              isDigitalArt ? 'border-purple-200 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setIsDigitalArt((v) => !v)}
          >
            <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
              isDigitalArt ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
            }`}>
              {isDigitalArt && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg>}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-sm font-medium text-gray-800">Digital art — transfer ownership on purchase</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                One buyer receives exclusive ownership. The listing is retired after sale.
              </p>
            </div>
          </div>

          {/* Accept Starter AA toggle */}
          <div>
            <div
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                acceptStarterAA ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAcceptStarterAA((v) => !v)}
            >
              <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                acceptStarterAA ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'
              }`}>
                {acceptStarterAA && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-800">Accept Starter AA</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowStarterInfo((v) => !v) }}
                    className="text-gray-400 hover:text-indigo-600"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {acceptStarterAA
                    ? 'Buyers can pay with any AA credits including Starter AA.'
                    : 'Buyers must use Redeemable AA only (cashable credits).'}
                </p>
              </div>
            </div>
            {showStarterInfo && (
              <div className="mt-1.5 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5 text-xs text-indigo-800 leading-relaxed">
                {STARTER_AA_INFO}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !title.trim() || !description.trim() || !priceNum || !category}
            >
              {loading ? (file ? 'Uploading…' : 'Creating…') : 'Create listing'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
