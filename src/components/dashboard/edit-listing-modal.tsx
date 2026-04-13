'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PRODUCT_CATEGORIES, USD_PER_CREDIT } from '@/types'
import { X, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'

interface EditListingModalProps {
  product: Product
  onClose: () => void
  onSaved: (updated: Product) => void
}

export function EditListingModal({ product, onClose, onSaved }: EditListingModalProps) {
  const [title, setTitle] = useState(product.title)
  const [description, setDescription] = useState(product.description)
  const [priceCredits, setPriceCredits] = useState(String(product.price_credits))
  const [category, setCategory] = useState(product.category)
  const [tags, setTags] = useState(product.tags.join(', '))
  const [acceptStarterAA, setAcceptStarterAA] = useState(product.accept_starter_aa)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceNum = parseInt(priceCredits) || 0
  const usdPreview = priceNum > 0 ? `$${(priceNum * USD_PER_CREDIT).toFixed(2)}` : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim() || !priceNum || !category) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price_credits: priceNum,
          category,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          accept_starter_aa: acceptStarterAA,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save changes')
        return
      }
      onSaved(data)
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
            <h2 className="text-lg font-semibold text-gray-900">Edit Listing</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text" required maxLength={120} value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              required maxLength={2000} rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (AA Credits)</label>
              <div className="relative">
                <input
                  type="number" required min={1} value={priceCredits}
                  onChange={(e) => setPriceCredits(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">AA</span>
              </div>
              {usdPreview && <p className="text-xs text-gray-400 mt-1">≈ {usdPreview}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                required value={category} onChange={(e) => setCategory(e.target.value)}
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
              type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="seo, content, writing"
            />
          </div>

          {/* Accept Starter AA toggle */}
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
            <div>
              <span className="text-sm font-medium text-gray-800">Accept Starter AA</span>
              <p className="text-xs text-gray-500 mt-0.5">
                {acceptStarterAA
                  ? 'Buyers can pay with any AA credits including Starter AA.'
                  : 'Buyers must use Redeemable AA only.'}
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              type="submit" className="flex-1"
              disabled={loading || !title.trim() || !description.trim() || !priceNum || !category}
            >
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
