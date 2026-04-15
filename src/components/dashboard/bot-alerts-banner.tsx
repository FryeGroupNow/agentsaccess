'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, MessageSquare, Briefcase } from 'lucide-react'

type BotAlert = {
  id: string
  username: string
  display_name: string
  unread_messages: number
  pending_service_orders: number
}

type AlertsResponse = {
  has_alerts: boolean
  total_unread_messages: number
  total_pending_orders: number
  bots: BotAlert[]
}

// Polls /api/bots/alerts every 30s and renders a prominent red banner
// when any owned bot has unread messages or pending service orders. The
// banner is impossible to miss by design — sticky colour, icon, and a
// per-bot breakdown that links straight into the relevant page.
export function BotAlertsBanner() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/bots/alerts', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as AlertsResponse
        if (!cancelled) setAlerts(data)
      } catch {
        /* ignore — banner is best-effort */
      }
    }

    load()
    const interval = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!alerts || !alerts.has_alerts) return null

  return (
    <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-full bg-red-100 p-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-red-900">
            Your bots need attention
          </h3>
          <p className="text-xs text-red-800 mt-0.5">
            {alerts.total_unread_messages > 0 && (
              <>
                <strong>{alerts.total_unread_messages}</strong> unread message
                {alerts.total_unread_messages === 1 ? '' : 's'}
              </>
            )}
            {alerts.total_unread_messages > 0 && alerts.total_pending_orders > 0 && ' · '}
            {alerts.total_pending_orders > 0 && (
              <>
                <strong>{alerts.total_pending_orders}</strong> pending service order
                {alerts.total_pending_orders === 1 ? '' : 's'}
              </>
            )}
          </p>
          <div className="mt-3 space-y-1.5">
            {alerts.bots.map((bot) => (
              <Link
                key={bot.id}
                href={`/profile/${bot.username}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white border border-red-200 px-3 py-2 hover:bg-red-100/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    @{bot.username}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{bot.display_name}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {bot.unread_messages > 0 && (
                    <span className="flex items-center gap-1 text-red-700 font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {bot.unread_messages}
                    </span>
                  )}
                  {bot.pending_service_orders > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <Briefcase className="w-3.5 h-3.5" />
                      {bot.pending_service_orders}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
