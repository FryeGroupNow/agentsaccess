'use client'

import { useEffect, useState, useCallback } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Users, Zap, Clock, Mail } from 'lucide-react'
import { formatMinutes } from '@/components/rentals/duration-picker'
import { formatCredits } from '@/lib/utils'

interface QueueEntry {
  id: string
  bot_id: string
  renter_id: string
  desired_duration_minutes: number
  auto_start: boolean
  pre_loaded_instructions: string | null
  pre_charged_amount: number
  status: 'waiting' | 'claimed' | 'started' | 'left' | 'expired'
  claim_deadline: string | null
  created_at: string
  renter?: { username: string; display_name: string; avatar_url: string | null }
}

interface Props {
  botId: string
}

/**
 * Owner-facing rental queue panel. Shows who's waiting for this bot, their
 * desired duration, and whether they have auto-start enabled. Gives the
 * owner demand visibility so they can decide to raise rates.
 */
export function BotQueuePanel({ botId }: Props) {
  const [entries, setEntries] = useState<QueueEntry[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/rentals/queue/${botId}`)
    if (res.ok) {
      const data = await res.json()
      setEntries(data.entries ?? [])
    }
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="py-4"><div className="h-10 rounded-lg bg-gray-50 animate-pulse" /></div>
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No renters in queue right now.
      </p>
    )
  }

  return (
    <div className="py-1">
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
        <Users className="w-3.5 h-3.5 text-indigo-500" />
        <span className="font-semibold">{entries.length} in queue</span>
        {entries.length >= 5 && (
          <span className="text-amber-600 ml-1">· high demand — consider raising your rate</span>
        )}
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {entries.map((e, idx) => (
          <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
            <span className="text-xs font-semibold text-gray-400 w-5 text-right">#{idx + 1}</span>
            <Avatar
              name={e.renter?.display_name ?? '?'}
              src={e.renter?.avatar_url ?? null}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-gray-800 truncate">
                  @{e.renter?.username ?? 'user'}
                </span>
                {e.auto_start && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1 py-0.5">
                    <Zap className="w-2.5 h-2.5" />Auto
                  </span>
                )}
                {e.status === 'claimed' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1 py-0.5">
                    <Clock className="w-2.5 h-2.5" />Confirming
                  </span>
                )}
                {e.pre_loaded_instructions && (
                  <span
                    title={e.pre_loaded_instructions}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5"
                  >
                    <Mail className="w-2.5 h-2.5" />Has brief
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {formatMinutes(e.desired_duration_minutes)}
                {e.auto_start && e.pre_charged_amount > 0 && (
                  <> · held {formatCredits(e.pre_charged_amount)}</>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
