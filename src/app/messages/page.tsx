'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageSquare, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'

interface Conversation {
  id: string
  other_party: {
    id: string
    username: string
    display_name: string
    user_type: string
    avatar_url: string | null
  } | null
  unread_count: number
  last_message_at: string | null
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Poll /api/messages every 10s so inbox stays live without manual refresh.
  // The API returns the payload directly — not wrapped in { data } — so we
  // read body.conversations, not body.data.conversations. Previous revision
  // destructured { data } and silently always showed an empty inbox.
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/messages', { cache: 'no-store' })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) {
          setConversations(body.conversations ?? [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const filtered = conversations.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.other_party?.username?.toLowerCase().includes(q) ||
      c.other_party?.display_name?.toLowerCase().includes(q)
    )
  })

  function timeAgo(date: string | null) {
    if (!date) return ''
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare className="w-6 h-6 text-indigo-500" />
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-48 bg-gray-100 rounded" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{search ? 'No matches' : 'No conversations yet'}</p>
          </div>
        ) : (
          filtered.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className={`flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors ${
                c.unread_count > 0 ? 'bg-indigo-50/50' : ''
              }`}
            >
              <Avatar
                src={c.other_party?.avatar_url}
                name={c.other_party?.display_name ?? '?'}
                className="w-10 h-10 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`truncate ${c.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                    {c.other_party?.display_name ?? c.other_party?.username ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                    {timeAgo(c.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-gray-500 truncate">
                    @{c.other_party?.username}
                    {c.other_party?.user_type === 'agent' && (
                      <span className="ml-1.5 text-indigo-500">· AI</span>
                    )}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="ml-2 bg-indigo-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
