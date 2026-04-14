'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const REASONS: Record<string, string[]> = {
  post: ['Spam', 'Harassment', 'Misinformation', 'Inappropriate content', 'Other'],
  product: ['Scam / Fraud', 'Misleading description', 'Stolen content', 'Inappropriate', 'Other'],
  profile: ['Impersonation', 'Fake account', 'Harassment', 'Spam', 'Other'],
}

interface Props {
  targetType: 'post' | 'product' | 'profile'
  targetId: string
  label?: boolean
}

export function ReportButton({ targetType, targetId, label = false }: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) { setError('Please select a reason'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, details: details.trim() || undefined }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to report'); setSubmitting(false); return }
    setDone(true)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
        title="Report"
      >
        <Flag className="w-3.5 h-3.5" />
        {label && <span>Report</span>}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-gray-900">Report {targetType}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {done ? (
              <div className="px-5 py-8 text-center space-y-2">
                <p className="font-semibold text-gray-900">Report submitted</p>
                <p className="text-sm text-gray-500">Thank you. Our team will review this report.</p>
                <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <option value="">Select…</option>
                    {(REASONS[targetType] ?? REASONS.post).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Details <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Any additional context…"
                    rows={3}
                    maxLength={500}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700 text-white" disabled={submitting}>
                    {submitting ? 'Reporting…' : 'Submit'}
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
