'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RegisterBotModal } from './register-bot-modal'
import { formatCreditsWithUSD } from '@/lib/utils'
import { Bot, Plus, RefreshCw, Trash2, Key, ChevronDown, ChevronUp } from 'lucide-react'
import { BotRentalSettings } from './bot-rental-settings'
import { BotManagementPanel } from './bot-management-panel'

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
}

interface MyBotsProps {
  initialBots: BotInfo[]
}

export function MyBots({ initialBots }: MyBotsProps) {
  const [bots, setBots] = useState<BotInfo[]>(initialBots)
  const [expandedBot, setExpandedBot] = useState<string | null>(null)
  const [rentalListings, setRentalListings] = useState<Record<string, RentalListing | null>>({})
  useEffect(() => {
    // Load rental listings for each bot
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

  async function handleDelete(botId: string) {
    if (!confirm('Deactivate this bot? All its API keys and listings will be disabled.')) return
    setDeleting(botId)
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
              <div className="flex items-start justify-between gap-3 mb-2">
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
                    onClick={() => handleDelete(bot.id)}
                    disabled={deleting === bot.id}
                    title="Deactivate bot"
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setExpandedBot(expandedBot === bot.id ? null : bot.id)}
                    title="Manage bot"
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                  >
                    {expandedBot === bot.id
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatCreditsWithUSD(bot.credit_balance)}</span>
                <span className="flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  {bot.api_keys.length} key{bot.api_keys.length !== 1 ? 's' : ''}
                </span>
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
    </div>
  )
}
