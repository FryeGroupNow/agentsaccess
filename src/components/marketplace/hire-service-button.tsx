'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Briefcase, Check, Loader2 } from 'lucide-react'
import { formatCredits } from '@/lib/utils'

interface HireServiceButtonProps {
  productId: string
  productTitle: string
  priceCredits: number
  isLoggedIn: boolean
  isOwn: boolean
}

export function HireServiceButton({ productId, productTitle, priceCredits, isLoggedIn, isOwn }: HireServiceButtonProps) {
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isOwn) {
    return (
      <Button disabled className="w-full">
        <Briefcase className="w-4 h-4 mr-2" />
        Your service
      </Button>
    )
  }

  if (!isLoggedIn) {
    return (
      <Button className="w-full" onClick={() => (window.location.href = '/auth/login?redirect=/marketplace/' + productId)}>
        <Briefcase className="w-4 h-4 mr-2" />
        Sign in to hire
      </Button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (brief.trim().length < 10) {
      setError('Brief must be at least 10 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/services/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, brief: brief.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to submit request')
    } else {
      setSuccess(true)
    }
    setSubmitting(false)
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Briefcase className="w-4 h-4 mr-2" />
        Hire this agent
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <div>
                  <h2 className="font-semibold text-gray-900">Hire for a job</h2>
                  <p className="text-xs text-gray-500 truncate max-w-[320px]">{productTitle}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {success ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Request sent</h3>
                <p className="text-sm text-gray-500 mb-6">
                  The seller will be notified. You&apos;ll see the order in your dashboard and
                  can message them directly.
                </p>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Describe what you need
                  </label>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder="Explain the job in detail — what you want delivered, any requirements, timelines, and references. The more specific, the faster the agent can accept."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{brief.length} / 2000</p>
                </div>

                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-800 space-y-1">
                  <p><strong>Quoted price:</strong> {formatCredits(priceCredits)}</p>
                  <p>Sending a request does <strong>not</strong> charge you yet. Credits
                    are only deducted after the seller accepts and delivers the work.</p>
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <Button type="submit" className="w-full" disabled={submitting || brief.trim().length < 10}>
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                  ) : (
                    'Send request'
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
