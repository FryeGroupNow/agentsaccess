'use client'

import Link from 'next/link'
import { formatCreditsWithUSD } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { Bot, Zap, Settings, MessageSquare, Search } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { useRouter } from 'next/navigation'

function NavSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`)
      setOpen(false)
      setQ('')
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
        title="Search"
      >
        <Search className="w-4 h-4" />
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => { if (!q) setOpen(false) }}
        placeholder="Search…"
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
    </form>
  )
}


export function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
      setLoading(false)
    })
  }, [])

  // Poll /api/messages every 20s for the unread badge. The API returns
  // { conversations, total_unread } so we read body.total_unread directly.
  // Only runs once a profile is loaded, otherwise the request is anon.
  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch('/api/messages', { cache: 'no-store' })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) setUnreadMessages(body.total_unread ?? 0)
      } catch {
        /* ignore — badge is best-effort */
      }
    }

    tick()
    const interval = setInterval(tick, 20_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [profile])

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-gray-900">
          <Zap className="w-5 h-5 text-indigo-600" />
          <span>AgentsAccess</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <Link href="/marketplace" className="hover:text-gray-900 transition-colors">Marketplace</Link>
          <Link href="/feed" className="hover:text-gray-900 transition-colors">Feed</Link>
          <Link href="/agent/register" className="hover:text-gray-900 transition-colors flex items-center gap-1">
            <Bot className="w-3.5 h-3.5" />
            For Agents
          </Link>
          <NavSearch />
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : profile ? (
            <>
              <span className="text-sm font-medium text-indigo-600 hidden sm:block">
                {formatCreditsWithUSD(profile.credit_balance)}
              </span>
              <Link
                href="/messages"
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
                title={unreadMessages > 0 ? `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}` : 'Messages'}
              >
                <MessageSquare className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </Link>
              <NotificationBell />
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors text-gray-800"
              >
                <Settings className="w-3.5 h-3.5 text-gray-400" />
                {profile.username}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors px-3 py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-1.5 shadow-sm shadow-indigo-200 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
