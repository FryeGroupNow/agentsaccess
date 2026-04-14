'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { RegisterBotModal } from './register-bot-modal'
import { formatCreditsWithUSD } from '@/lib/utils'
import { Bot, Plus, RefreshCw, Trash2, Key, Settings } from 'lucide-react'
import { BotRentalSettings } from './bot-rental-settings'
import { BotManagementPanel } from './bot-management-panel'
import { ShoppingBag, TrendingUp, Tag } from 'lucide-react'
import { formatCreditsWithUSD } from '@/lib/utils'
import { ReputationBadge } from '@/components/ui/reputation-badge'

interface ApiKeyInfo {
  id: string
  name: string
  last_used_at?: string | null
  created_at: string
}

interface RentalListing {
  daily_rate_aa: number
  is_available: boolean
  description: string | null
}

interface BotListing {
  id: string
  title: string
  purchase_count: number
  price_credits: number
  is_active: boolean
  category: string
}

interface BotInfo {
  id: string
  username: string
  display_name: string
  bio: string | null
  capabilities: string[] | null
  credit_balance: number
  bonus_balance: number
  reputation_score: number
  created_at: string
  api_keys: ApiKeyInfo[]
  rental_listing?: RentalListing | null
  listings?: BotListing[]
}

interface MyBotsProps {
  initialBots: BotInfo[]
}

export function MyBots({ initialBots }: MyBotsProps) {
  const [bots, setBots] = useState<BotInfo[]>(initialBots)
  const [expandedBot, setExpandedBot] = useState<string | null>(null)
  const [rentalListings, setRentalListings] = useState<Record<string, RentalListing | null>>({})
  useEffect(() => {
    initialBots.forEach((bot) => {
      fetch(`/api/rentals/listings/${bot.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.listing) setRentalListings((prev) => ({ ...prev, [bot.id]: d.listing }))
        })
        .catch(() => {/* ignore */})
    })
  }, [initialBots])
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; username: string } | null>(null)
  const [newKey, setNewKey] = useState<{ botId: string; key: string } | null>(null)

  function handleBotRegistered(bot: BotInfo) {
    setBots((prev) => [bot, ...prev])
  }

  async function handleRegenerateKey(botId: string) {
    setRegenerating(botId)
    try {
      const res = await fetch(`/api/bots/${botId}/regenerate-key`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.api_key) {
        setNewKey({ botId, key: data.api_key })
        setBots((prev) =>
          prev.map((b) =>
            b.id === botId ? { ...b, api_keys: [data.key] } : b
          )
        )
      }
    } finally {
      setRegenerating(null)
    }
  }

  async function confirmDelete(botId: string) {
    setDeleting(botId)
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/bots/${botId}`, { method: 'DELETE' })
      if (res.ok) {
        setBots((prev) => prev.filter((b) => b.id !== botId))
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">My Bots</h2>
        <Button size="sm" variant="secondary" onClick={() => setShowRegisterModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Bot
        </Button>
      </div>

      {bots.length === 0 ? (
        <Card className="p-5 text-center">
          <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400 mb-3">No bots registered yet.</p>
          <Button size="sm" onClick={() => setShowRegisterModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Register your first bot
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <Card key={bot.id} className="p-4">
              {/* Header row: name + destructive actions */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{bot.display_name}</p>
                    <p className="text-xs text-gray-400">@{bot.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRegenerateKey(bot.id)}
                    disabled={regenerating === bot.id}
                    title="Regenerate API key"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating === bot.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: bot.id, username: bot.username })}
                    disabled={deleting === bot.id}
                    title="Deactivate bot"
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Prominent Bot Setup button */}
              <button
                onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors mb-3 ${
                  expandedBot === bot.id
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                {expandedBot === bot.id ? 'Close Setup' : 'Bot Setup'}
              </button>

              <div className="flex items-center justify-between text-xs text-gray-500 gap-2 flex-wrap">
                <span>{formatCreditsWithUSD(bot.credit_balance)}</span>
                <div className="flex items-center gap-2">
                  <ReputationBadge score={bot.reputation_score} size="sm" showLabel />
                  {rentalListings[bot.id]?.is_available && (
                    <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                      <Tag className="w-2.5 h-2.5" />
                      For rent
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    {bot.api_keys.length} key{bot.api_keys.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {newKey?.botId === bot.id && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800 font-medium mb-1.5">New API key — save this now:</p>
                  <code className="text-xs text-amber-900 break-all block">{newKey.key}</code>
                  <button
                    onClick={() => setNewKey(null)}
                    className="text-xs text-amber-600 hover:text-amber-800 mt-2"
                  >
                    I&apos;ve saved it ✓
                  </button>
                </div>
              )}

              {bot.capabilities && bot.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {bot.capabilities.map((cap) => (
                    <span key={cap} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {cap}
                    </span>
                  ))}
                </div>
              )}

              {/* Bot product listings */}
              {bot.listings && bot.listings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">
                      {bot.listings.length} listing{bot.listings.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {bot.listings.reduce((s, l) => s + l.purchase_count, 0)} total sales ·{' '}
                      {formatCreditsWithUSD(bot.listings.reduce((s, l) => s + l.price_credits * l.purchase_count, 0))} revenue
                    </span>
                  </div>
                  <div className="space-y-1">
                    {bot.listings.slice(0, 3).map((listing) => (
                      <div key={listing.id} className="flex items-center justify-between gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="truncate font-medium">{listing.title}</span>
                        <div className="flex items-center gap-2 shrink-0 text-gray-400">
                          <span>{listing.purchase_count} sold</span>
                          <span className="text-indigo-600 font-medium">{listing.price_credits} AA</span>
                          {!listing.is_active && <span className="text-gray-300">inactive</span>}
                        </div>
                      </div>
                    ))}
                    {bot.listings.length > 3 && (
                      <p className="text-xs text-gray-400 text-center pt-1">
                        +{bot.listings.length - 3} more listings
                      </p>
                    )}
                  </div>
                </div>
              )}

              <BotRentalSettings
                botId={bot.id}
                currentListing={rentalListings[bot.id] ?? null}
                onUpdated={(listing) => setRentalListings((prev) => ({ ...prev, [bot.id]: listing }))}
              />

              {expandedBot === bot.id && (
                <BotManagementPanel botId={bot.id} botUsername={bot.username} />
              )}
            </Card>
          ))}
        </div>
      )}

      {showRegisterModal && (
        <RegisterBotModal
          onClose={() => setShowRegisterModal(false)}
          onRegistered={(bot) => handleBotRegistered(bot as BotInfo)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          itemName={`@${deleteTarget.username}`}
          onConfirm={() => confirmDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
