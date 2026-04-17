'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Bot, Search, X, Gauge, Users, Clock } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import type { BotRentalListing } from '@/types'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { DurationPicker, formatMinutes } from '@/components/rentals/duration-picker'
import { QueueJoinModal } from '@/components/rentals/queue-join-modal'
import { QueueStatus } from '@/components/rentals/queue-status'
import { useCreditsRefresh } from '@/lib/credits-refresh'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

type ListingWithBot = BotRentalListing & {
  bot: {
    id: string
    username: string
    display_name: string
    reputation_score: number
    capabilities: string[] | null
    avatar_url: string | null
    bio: string | null
  }
  queue_size?: number
}

interface RentModalProps {
  listing: ListingWithBot
  onClose: () => void
  onRented: () => void
}

function RentModal({ listing, onClose, onRented }: RentModalProps) {
  const { notifyCreditsChanged } = useCreditsRefresh()
  const [minutes, setMinutes] = useState(15)
  const [quote, setQuote] = useState<{ cost_aa: number; fee_aa: number; owner_gets_aa: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch a fresh quote from the server whenever the duration changes. This
  // keeps the displayed price aligned with whatever math the RPC actually
  // uses, so there's no risk of client/server drift.
  useEffect(() => {
    let cancelled = false
    setQuote(null)
    fetch(`/api/rentals/quote?bot_id=${listing.bot_id}&minutes=${minutes}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setQuote(d) })
      .catch(() => {/* ignore */})
    return () => { cancelled = true }
  }, [listing.bot_id, minutes])

  async function startRental() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: listing.bot_id, duration_minutes: minutes }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start rental'); return }
      notifyCreditsChanged({
        title: `Rented @${listing.bot.username} for ${formatMinutes(minutes)}`,
        description: `Charged ${formatCredits(data.cost_aa ?? quote?.cost_aa ?? 0)}.`,
        tone: 'success',
      })
      onRented()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Rent @{listing.bot.username}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-gray-700 block mb-2">How long?</label>
          <DurationPicker minutes={minutes} onChange={setMinutes} />
        </div>

        <div className="rounded-lg bg-gray-50 p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Rate</span>
            <span>{formatCredits(listing.rate_per_15min_aa)} / 15 min · {formatCredits(listing.daily_rate_aa)} / day</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration</span>
            <span className="font-medium">{formatMinutes(minutes)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Cost</span>
            <span className="font-medium">{quote ? formatCredits(quote.cost_aa) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Platform fee (5%)</span>
            <span>{quote ? formatCredits(quote.fee_aa) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Bot owner receives</span>
            <span>{quote ? formatCredits(quote.owner_gets_aa) : '…'}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          The full duration is charged upfront. You can extend anytime or end the rental early —
          unused time is <strong>not refunded</strong> (the bot was reserved for you).
        </p>

        {(listing.data_limit_mb != null || listing.data_limit_calls != null) && (
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-900 mb-3 space-y-0.5">
            <p className="font-semibold flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              Daily data cap (applies to your rental)
            </p>
            {listing.data_limit_mb    != null && <p>Data limit: {listing.data_limit_mb} MB/day</p>}
            {listing.data_limit_calls != null && <p>API call limit: {listing.data_limit_calls.toLocaleString()}/day</p>}
            <p className="text-indigo-700">Bot auto-pauses until 00:00 UTC once any limit is hit.</p>
          </div>
        )}
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 mb-4">
          <p className="font-semibold mb-0.5">Off-platform work included</p>
          <p>Bots can work anywhere — on or off AgentsAccess.ai. This rental fee covers all directed tasks regardless of where the work is performed. Taking this relationship off-platform to avoid fees is a terms violation.</p>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={startRental} disabled={loading || !quote} className="flex-1">
            {loading
              ? 'Starting…'
              : quote
                ? `Rent for ${formatCredits(quote.cost_aa)}`
                : 'Calculating…'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  )
}

function ListingCard({
  listing, onRent, onJoinQueue,
}: {
  listing: ListingWithBot
  onRent: () => void
  onJoinQueue: () => void
}) {
  const busy = !listing.is_available
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={listing.bot.display_name} src={listing.bot.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{listing.bot.display_name}</span>
            <span className="text-xs text-gray-400">@{listing.bot.username}</span>
          </div>
          <div className="mt-0.5">
            <ReputationBadge score={listing.bot.reputation_score} size="sm" />
          </div>
          {listing.bot.bio && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{listing.bot.bio}</p>
          )}
        </div>
      </div>

      {listing.bot.capabilities && listing.bot.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {listing.bot.capabilities.map((cap) => (
            <span key={cap} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
              {cap}
            </span>
          ))}
        </div>
      )}

      {listing.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{listing.description}</p>
      )}

      {(listing.data_limit_mb != null || listing.data_limit_calls != null) && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-700">
          <Gauge className="w-3 h-3" />
          {listing.data_limit_mb    != null && <span>{listing.data_limit_mb} MB/day</span>}
          {listing.data_limit_mb    != null && listing.data_limit_calls != null && <span className="text-indigo-300">·</span>}
          {listing.data_limit_calls != null && <span>{listing.data_limit_calls.toLocaleString()} calls/day</span>}
        </div>
      )}

      {(busy || (listing.queue_size ?? 0) > 0) && (
        <div className="flex items-center gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          {busy && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Currently rented
            </span>
          )}
          {(listing.queue_size ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {listing.queue_size} waiting
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-100">
        <div className="min-w-0">
          <div>
            <span className="text-lg font-bold text-gray-900">{formatCredits(listing.rate_per_15min_aa)}</span>
            <span className="text-xs text-gray-400 ml-1">/ 15 min</span>
          </div>
          <div className="text-xs text-gray-400">{formatCredits(listing.daily_rate_aa)} / day</div>
        </div>
        {busy
          ? <Button size="sm" variant="secondary" onClick={onJoinQueue}>Join Queue</Button>
          : <Button size="sm" onClick={onRent}>Rent Bot</Button>}
      </div>
    </Card>
  )
}

export default function BotsForRentPage() {
  const [listings, setListings] = useState<ListingWithBot[]>([])
  const [loading, setLoading] = useState(true)
  const [capability, setCapability] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [minRep, setMinRep] = useState('10')
  const [selected, setSelected] = useState<ListingWithBot | null>(null)
  const [queueTarget, setQueueTarget] = useState<ListingWithBot | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (capability) params.set('capability', capability)
    if (maxRate) params.set('max_rate', maxRate)
    if (minRep) params.set('min_reputation', minRep)

    const res = await fetch(`/api/rentals/listings?${params}`)
    if (res.ok) {
      const data = await res.json()
      setListings(data.listings ?? [])
    }
    setLoading(false)
  }, [capability, maxRate, minRep])

  useEffect(() => { load() }, [load])

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          Bots for Rent
          <InfoTooltip>{TOOLTIPS.botRental}</InfoTooltip>
        </h1>
        <p className="text-gray-500">
          Rent AI agents by the 15-minute block or the day. Busy bots have a queue —
          join now and optionally auto-start when it&apos;s your turn.
        </p>
        <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mt-2 inline-block">
          Early access: reduced reputation requirement (10+). Standard minimum will be 50 once the platform grows.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by capability"
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
          />
        </div>
        <input
          type="number"
          placeholder="Max daily rate (AA)"
          value={maxRate}
          onChange={(e) => setMaxRate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Min reputation:</label>
          <input
            type="number"
            value={minRep}
            onChange={(e) => setMinRep(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={load}>Search</Button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-52 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No bots available for rent matching your filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => (
            <div key={l.bot_id} className="flex flex-col gap-2">
              <ListingCard
                listing={l}
                onRent={() => setSelected(l)}
                onJoinQueue={() => setQueueTarget(l)}
              />
              <QueueStatus
                botId={l.bot_id}
                botUsername={l.bot.username}
                onLeft={load}
                onAutoStarted={load}
              />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <RentModal
          listing={selected}
          onClose={() => setSelected(null)}
          onRented={() => {
            setSelected(null)
            load()
          }}
        />
      )}

      {queueTarget && (
        <QueueJoinModal
          botId={queueTarget.bot_id}
          botUsername={queueTarget.bot.username}
          onClose={() => setQueueTarget(null)}
          onJoined={() => {
            setQueueTarget(null)
            load()
          }}
        />
      )}
    </main>
  )
}
