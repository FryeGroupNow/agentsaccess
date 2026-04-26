'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tag, X, Check, AlertTriangle } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

type ModelTier = 'standard' | 'advanced' | 'premium'

interface RentalListingSummary {
  daily_rate_aa: number
  rate_per_15min_aa: number
  is_available: boolean
  description: string | null
  data_limit_mb: number | null
  data_limit_calls: number | null
  estimated_api_cost_per_15min_aa: number | null
  model_tier: ModelTier
}

const TIER_OPTIONS: { value: ModelTier; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Routine tasks, quick responses' },
  { value: 'advanced', label: 'Advanced', hint: 'Complex tasks, detailed analysis' },
  { value: 'premium',  label: 'Premium',  hint: 'Strategic work, deepest reasoning' },
]

interface BotRentalSettingsProps {
  botId: string
  currentListing: RentalListingSummary | null
  onUpdated: (listing: RentalListingSummary | null) => void
}

export function BotRentalSettings({ botId, currentListing, onUpdated }: BotRentalSettingsProps) {
  const [editing, setEditing] = useState(false)
  const [rate, setRate]  = useState(currentListing?.daily_rate_aa ?? 50)
  const [rate15, setRate15] = useState(currentListing?.rate_per_15min_aa ?? 5)
  const [desc, setDesc]  = useState(currentListing?.description ?? '')
  const [mb, setMb]     = useState<string>(currentListing?.data_limit_mb?.toString()    ?? '')
  const [calls, setCalls] = useState<string>(currentListing?.data_limit_calls?.toString() ?? '')
  const [cost15, setCost15] = useState<string>(currentListing?.estimated_api_cost_per_15min_aa?.toString() ?? '')
  const [tier, setTier] = useState<ModelTier>(currentListing?.model_tier ?? 'standard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Warn the owner when their per-15-min rental rate doesn't cover the cost
  // they declared it takes to run the bot. We show the warning live as they
  // type so they can adjust before saving.
  const costNum = cost15 === '' ? null : Number(cost15)
  const losingMoney = costNum != null && Number.isFinite(costNum) && rate15 > 0 && rate15 < costNum
  const slimMargin  = costNum != null && Number.isFinite(costNum) && !losingMoney && rate15 < costNum * 1.25

  async function save() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/listings/${botId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_rate_aa: rate,
          rate_per_15min_aa: rate15,
          description: desc || null,
          data_limit_mb: mb === '' ? null : Number(mb),
          data_limit_calls: calls === '' ? null : Number(calls),
          estimated_api_cost_per_15min_aa: cost15 === '' ? null : Number(cost15),
          model_tier: tier,
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
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <Tag className="w-3 h-3 text-emerald-500" />
        <span className="text-xs text-gray-600">
          For rent · {formatCredits(currentListing.rate_per_15min_aa)}/15min · {formatCredits(currentListing.daily_rate_aa)}/day
          <span className="ml-1 text-indigo-600 capitalize">· {currentListing.model_tier}</span>
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
        <span className="text-xs font-medium text-gray-700 inline-flex items-center gap-1">
          Rental listing
          <InfoTooltip size="sm">{TOOLTIPS.botRental}</InfoTooltip>
        </span>
        <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Per 15 min (AA)</label>
            <input
              type="number" min={1} max={1000} value={rate15}
              onChange={(e) => setRate15(Number(e.target.value))}
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Per day (AA)</label>
            <input
              type="number" min={1} max={10000} value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 -mt-1">
          Renters are billed from the 15-min rate, capped at the daily rate for longer bookings.
        </p>

        <div>
          <label className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">
            Model tier
            <InfoTooltip size="sm" width="w-72">{TOOLTIPS.modelTier}</InfoTooltip>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {TIER_OPTIONS.map((opt) => {
              const selected = tier === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTier(opt.value)}
                  className={`text-left rounded-lg border px-2 py-1.5 transition-colors ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`text-xs font-semibold ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </div>
                  <div className={`text-[10px] leading-tight ${selected ? 'text-indigo-500' : 'text-gray-400'}`}>
                    {opt.hint}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Renters see this on the listing. Higher tiers justify higher rental rates.
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Your operating cost / 15 min (AA, optional)
          </label>
          <input
            type="number" min={0} step="0.1" value={cost15}
            onChange={(e) => setCost15(e.target.value)}
            placeholder="e.g. 3"
            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            What 15 min of operation costs <em>you</em> (Anthropic API, compute, etc.). Used to warn you if
            your rate is too low and to show renters a transparency breakdown.
          </p>
        </div>

        {losingMoney && (
          <div className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Warning: your rental rate ({formatCredits(rate15)}) is below your estimated operating cost
              ({formatCredits(costNum!)}). You will lose money on rentals.
            </span>
          </div>
        )}
        {!losingMoney && slimMargin && (
          <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Slim margin: your rate is less than 25% above cost. Consider raising it to absorb spikes.
            </span>
          </div>
        )}

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
