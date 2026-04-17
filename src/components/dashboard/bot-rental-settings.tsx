'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tag, X, Check } from 'lucide-react'
import { formatCredits } from '@/lib/utils'

interface RentalListingSummary {
  daily_rate_aa: number
  is_available: boolean
  description: string | null
  data_limit_mb: number | null
  data_limit_calls: number | null
}

interface BotRentalSettingsProps {
  botId: string
  currentListing: RentalListingSummary | null
  onUpdated: (listing: RentalListingSummary | null) => void
}

export function BotRentalSettings({ botId, currentListing, onUpdated }: BotRentalSettingsProps) {
  const [editing, setEditing] = useState(false)
  const [rate, setRate] = useState(currentListing?.daily_rate_aa ?? 50)
  const [desc, setDesc] = useState(currentListing?.description ?? '')
  const [mb, setMb]     = useState<string>(currentListing?.data_limit_mb?.toString()    ?? '')
  const [calls, setCalls] = useState<string>(currentListing?.data_limit_calls?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function save() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/listings/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_rate_aa: rate,
          description: desc || null,
          data_limit_mb: mb === '' ? null : Number(mb),
          data_limit_calls: calls === '' ? null : Number(calls),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onUpdated(data.listing)
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setEditing(false) }, 1500)
    } finally {
      setLoading(false)
    }
  }

  async function remove() {
    if (!confirm('Remove this bot from the rental marketplace?')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/listings/${botId}`, { method: 'DELETE' })
      if (res.ok) { onUpdated(null); setEditing(false) }
    } finally {
      setLoading(false)
    }
  }

  if (!editing && !currentListing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1.5"
      >
        <Tag className="w-3 h-3" />
        List for rent
      </button>
    )
  }

  if (!editing && currentListing) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <Tag className="w-3 h-3 text-emerald-500" />
        <span className="text-xs text-gray-600">
          For rent · {formatCredits(currentListing.daily_rate_aa)}/day
          {!currentListing.is_available && <span className="ml-1 text-amber-600">(rented)</span>}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-indigo-500 hover:underline">Edit</button>
        <button onClick={remove} disabled={loading} className="text-xs text-red-500 hover:underline">Remove</button>
      </div>
    )
  }

  return (
    <div className="mt-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700">Rental listing</span>
        <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Daily rate (AA Credits)</label>
          <input
            type="number" min={1} max={10000} value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Daily data (MB)</label>
            <input
              type="number" min={1} value={mb}
              onChange={(e) => setMb(e.target.value)}
              placeholder="No limit"
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Daily API calls</label>
            <input
              type="number" min={1} value={calls}
              onChange={(e) => setCalls(e.target.value)}
              placeholder="No limit"
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-1">
          Renters see these before booking. Bot auto-pauses for the rest of the UTC day once hit.
        </p>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Description (optional)</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            placeholder="What can renters do with this bot?"
            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button size="sm" onClick={save} disabled={loading || success} className="w-full">
          {success ? <><Check className="w-3 h-3 mr-1" />Saved</> : loading ? 'Saving…' : 'Save Listing'}
        </Button>
      </div>
    </div>
  )
}
