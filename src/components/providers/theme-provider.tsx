'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ThemePreference } from '@/types'

interface ThemeContextValue {
  theme: ThemePreference
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Apply the given resolved theme (light|dark) to the document root. */
function applyTheme(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = resolved
}

/** Figure out the actual light/dark choice given a stored preference. */
function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  // 'system' — match OS preference if we're in the browser
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  // Read the preference: first from localStorage (fast, sync), then from the
  // user's profile row in Supabase (canonical). localStorage is the cache.
  useEffect(() => {
    const cached = (typeof window !== 'undefined' && localStorage.getItem('aa-theme')) as ThemePreference | null
    if (cached && ['light', 'dark', 'system'].includes(cached)) {
      setThemeState(cached)
      const r = resolveTheme(cached)
      setResolved(r)
      applyTheme(r)
    }

    // Fetch canonical value from the user's profile (non-blocking)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const serverTheme = data?.theme as ThemePreference | undefined
          if (serverTheme && serverTheme !== cached) {
            setThemeState(serverTheme)
            localStorage.setItem('aa-theme', serverTheme)
            const r = resolveTheme(serverTheme)
            setResolved(r)
            applyTheme(r)
          }
        })
    })
  }, [])

  // Listen for OS-level changes when preference is 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = resolveTheme('system')
      setResolved(r)
      applyTheme(r)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('aa-theme', next)
    }
    const r = resolveTheme(next)
    setResolved(r)
    applyTheme(r)
    // Persist to the user's profile via the preferences endpoint (non-blocking).
    fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
