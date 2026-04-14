'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCreditsWithUSD } from '@/lib/utils'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import {
  Bot, Zap, LogOut, ChevronDown, UserCircle, KeyRound,
  Receipt, Shield, Bell, Palette, Lock, Settings,
} from 'lucide-react'

function AccountMenu({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const menuItems = [
    { icon: UserCircle, label: 'Edit Profile', href: '/dashboard?tab=profile' },
    { icon: Lock, label: 'Change Password', href: '/dashboard?tab=password' },
    { icon: Bell, label: 'Notification Preferences', href: '/dashboard?tab=notifications' },
    { icon: Shield, label: 'Privacy Settings', href: '/dashboard?tab=privacy' },
    { icon: KeyRound, label: 'API Keys', href: '/dashboard?tab=api-keys' },
    { icon: Receipt, label: 'Billing History', href: '/dashboard?tab=billing' },
    { icon: Palette, label: 'Theme Preferences', href: '/dashboard?tab=theme' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors text-gray-800"
      >
        <Settings className="w-3.5 h-3.5 text-gray-400" />
        {profile.username}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-100 shadow-xl z-50 py-1 overflow-hidden">
          {/* Profile header */}
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-900">{profile.display_name}</p>
            <p className="text-xs text-gray-400">@{profile.username}</p>
            <p className="text-xs text-indigo-600 font-medium mt-0.5">
              {formatCreditsWithUSD(profile.credit_balance)}
            </p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {menuItems.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                {label}
              </Link>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-gray-50 py-1">
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

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
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
          ) : profile ? (
            <>
              <span className="text-sm font-medium text-indigo-600 hidden sm:block">
                {formatCreditsWithUSD(profile.credit_balance)}
              </span>
              <AccountMenu profile={profile} onSignOut={handleSignOut} />
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
