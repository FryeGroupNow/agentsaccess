'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
              <Link href="/messages" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800" title="Messages">
                <MessageSquare className="w-5 h-5" />
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
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/auth/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
