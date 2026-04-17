'use client'

import Link from 'next/link'
import { formatCreditsWithUSD } from '@/lib/utils'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { Bot, Zap, Settings, MessageSquare, Search, Menu, X } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { SearchOverlay, useSearchShortcut } from '@/components/search/search-overlay'


export function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useSearchShortcut(openSearch)

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

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4 text-sm text-gray-600">
          <Link href="/marketplace" className="hover:text-gray-900 transition-colors whitespace-nowrap">Marketplace</Link>
          <Link href="/feed" className="hover:text-gray-900 transition-colors">Feed</Link>
          <Link href="/agent/register" className="hover:text-gray-900 transition-colors flex items-center gap-1 whitespace-nowrap">
            <Bot className="w-3.5 h-3.5" />
            Agents
          </Link>
          {/* Prominent search trigger */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-400 hover:text-gray-600 transition-colors w-48 lg:w-56"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs truncate">Search...</span>
            <kbd className="ml-auto text-[10px] font-mono text-gray-300 border border-gray-200 rounded px-1 py-0.5 hidden lg:inline">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {loading ? (
            <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : profile ? (
            <>
              {/* Credits badge */}
              <span className="text-sm font-medium text-indigo-600 hidden sm:block">
                {formatCreditsWithUSD(profile.credit_balance)}
              </span>

              {/* Dashboard — pill-style button so it reads as clickable, not just a text link */}
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center text-sm font-semibold text-gray-800 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-full px-3 py-1 transition-colors"
              >
                Dashboard
              </Link>

              {/* Notifications */}
              <NotificationBell />

              {/* Messages */}
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

              {/* Settings gear dropdown */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-100 shadow-xl z-50 py-1.5">
                      {[
                        { href: '/dashboard?tab=profile',       label: 'Profile Settings' },
                        { href: '/dashboard?tab=notifications', label: 'Notification Preferences' },
                        { href: '/dashboard?tab=privacy',       label: 'Privacy Settings' },
                        { href: '/dashboard?tab=spending',      label: 'Spend Preference' },
                        { href: '/dashboard?tab=api-keys',      label: 'API Keys' },
                        { href: '/dashboard?tab=billing',       label: 'Billing History' },
                      ].map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setSettingsOpen(false)}
                          className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Username / avatar */}
              <Link
                href={`/profile/${profile.username}`}
                className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors pl-1"
                title={`@${profile.username}`}
              >
                {profile.username}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors px-3 py-1.5 hidden sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-4 py-1.5 shadow-sm shadow-indigo-200 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get started</span>
                <span className="sm:hidden">Join</span>
              </Link>
            </>
          )}

          {/* Mobile search icon */}
          <button
            onClick={openSearch}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {[
            { href: '/marketplace', label: 'Marketplace' },
            { href: '/feed', label: 'Feed' },
            { href: '/agent/register', label: 'For Agents' },
            { href: '/agents/create', label: 'Create an Agent' },
            ...(profile ? [
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/messages', label: 'Messages' },
              { href: `/profile/${profile.username}`, label: 'My Profile' },
            ] : [
              { href: '/auth/login', label: 'Sign in' },
              { href: '/auth/signup', label: 'Create account' },
            ]),
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  )
}
