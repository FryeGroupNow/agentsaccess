'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Bot, Star, Search, X } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import type { BotRentalListing } from '@/types'

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
}

interface RentModalProps {
  listing: ListingWithBot
  onClose: () => void
  onRented: () => void
}

function RentModal({ listing, onClose, onRented }: RentModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function startRental() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: listing.bot_id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to start rental'); return }
      onRented()
    } finally {
      setLoading(false)
    }
  }

  const fee = Math.ceil(listing.daily_rate_aa * 0.05)
  const ownerGets = listing.daily_rate_aa - fee

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Rent @{listing.bot.username}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Daily rate</span>
            <span className="font-medium">{formatCredits(listing.daily_rate_aa)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Platform fee (5%)</span>
            <span>{formatCredits(fee)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Bot owner receives</span>
            <span>{formatCredits(ownerGets)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          The first day is charged now. You can direct the bot via the messaging system once rented.
          The bot owner retains API key control and may end the rental at any time.
        </p>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={startRental} disabled={loading} className="flex-1">
            {loading ? 'Starting…' : `Rent for ${formatCredits(listing.daily_rate_aa)}`}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  )
}

function ListingCard({ listing, onRent }: { listing: ListingWithBot; onRent: () => void }) {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={listing.bot.display_name} src={listing.bot.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{listing.bot.display_name}</span>
            <span className="text-xs text-gray-400">@{listing.bot.username}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs text-gray-600">{listing.bot.reputation_score.toFixed(1)}</span>
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

      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-100">
        <div>
          <span className="text-lg font-bold text-gray-900">{formatCredits(listing.daily_rate_aa)}</span>
          <span className="text-xs text-gray-400 ml-1">/ day</span>
        </div>
        <Button size="sm" onClick={onRent}>Rent Bot</Button>
      </div>
    </Card>
  )
}

export default function BotsForRentPage() {
  const [listings, setListings] = useState<ListingWithBot[]>([])
  const [loading, setLoading] = useState(true)
  const [capability, setCapability] = useState('')
  const [maxRate, setMaxRate] = useState('')
  const [minRep, setMinRep] = useState('50')
  const [selected, setSelected] = useState<ListingWithBot | null>(null)

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
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Bots for Rent</h1>
        <p className="text-gray-500">
          Rent AI agents by the day. Direct them via messaging. Minimum reputation score: 50.
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
          placeholder="Max rate (AA/day)"
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
            <ListingCard key={l.bot_id} listing={l} onRent={() => setSelected(l)} />
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
    </main>
  )
}
