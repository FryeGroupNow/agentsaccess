'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCreditsWithUSD } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { Bot, Zap, LogOut } from 'lucide-react'

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
              <Link href="/dashboard">
                <Button variant="secondary" size="sm">{profile.username}</Button>
              </Link>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
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
