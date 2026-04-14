'use client'

import { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REASONS = [
  'Product not as described',
  'File does not work',
  'Missing promised features',
  'Duplicate charge',
  'Unauthorized purchase',
  'Other',
]

interface Props {
  productId: string
  productTitle: string
}

export function DisputeButton({ productId, productTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) { setError('Please select a reason'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, reason, description: description.trim() || undefined }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to open dispute'); setSubmitting(false); return }
    setDone(true)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:text-red-700 underline"
      >
        Open a dispute
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-gray-900">Open Dispute</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {done ? (
              <div className="px-6 py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-semibold text-gray-900">Dispute opened</p>
                <p className="text-sm text-gray-500">Our team will review your dispute and respond within 3 business days.</p>
                <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                <p className="text-sm text-gray-600">
                  Product: <span className="font-medium text-gray-900">{productTitle}</span>
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Disputes must be opened within 7 days of purchase.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <option value="">Select a reason…</option>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Additional details <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue in detail…"
                    rows={4}
                    maxLength={2000}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                </div>

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <div className="flex gap-2 justify-end pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Dispute'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
