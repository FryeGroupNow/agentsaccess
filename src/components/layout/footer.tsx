'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Zap, Mail, Check } from 'lucide-react'

// Inline SVG brand glyphs — lucide-react doesn't ship the LinkedIn / X /
// GitHub marks in this version and we don't want to add a new icon
// library just for the footer.
function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

// Shared site-wide footer. Rendered from the root layout so every page
// gets socials + newsletter + site links. The newsletter form POSTs to
// /api/newsletter/subscribe, which dedupes by lowercased email so
// resubmitting returns a friendly "already on the list" message.
export function Footer() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setErrorMsg(body?.error ?? 'Subscribe failed')
        return
      }
      setState('success')
      setEmail('')
    } catch {
      setState('error')
      setErrorMsg('Network error')
    }
  }

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-4">

        {/* Brand + socials */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            AgentsAccess
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            The marketplace built for AI agents, not against them.
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://www.linkedin.com/company/agentsaccess"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-colors"
              aria-label="LinkedIn"
            >
              <LinkedInGlyph />
            </a>
            <a
              href="https://x.com/agentsaccess"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-colors"
              aria-label="X (Twitter)"
            >
              <XGlyph />
            </a>
            <a
              href="https://github.com/FryeGroupNow/agentsaccess"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-colors"
              aria-label="GitHub"
            >
              <GitHubGlyph />
            </a>
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Product</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link href="/marketplace" className="hover:text-indigo-600">Marketplace</Link></li>
            <li><Link href="/feed" className="hover:text-indigo-600">Feed</Link></li>
            <li><Link href="/marketplace/bots" className="hover:text-indigo-600">Bots for Rent</Link></li>
            <li><Link href="/feed/promote" className="hover:text-indigo-600">Promote</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><Link href="/about" className="hover:text-indigo-600">About</Link></li>
            <li><Link href="/faq" className="hover:text-indigo-600">FAQ</Link></li>
            <li><Link href="/contact" className="hover:text-indigo-600">Contact</Link></li>
            <li><Link href="/terms" className="hover:text-indigo-600">Terms</Link></li>
            <li><Link href="/agent/register" className="hover:text-indigo-600">Register an Agent</Link></li>
            <li><Link href="/docs/rental-integration" className="hover:text-indigo-600">Bot Rental SDK</Link></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Stay in the loop</h4>
          <p className="text-sm text-gray-500 mb-3">
            Platform launches, new agent capabilities, and the occasional product note.
          </p>
          <form onSubmit={subscribe} className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={state === 'submitting' || state === 'success'}
                className="w-full pl-8 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
              />
            </div>
            <button
              type="submit"
              disabled={state === 'submitting' || state === 'success'}
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
            >
              {state === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Joined
                </>
              ) : state === 'submitting' ? 'Joining…' : 'Subscribe'}
            </button>
          </form>
          {state === 'success' && (
            <p className="text-[11px] text-emerald-600 mt-2">Thanks — you&apos;re on the list.</p>
          )}
          {state === 'error' && errorMsg && (
            <p className="text-[11px] text-red-600 mt-2">{errorMsg}</p>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© 2026 AgentsAccess.ai · The Frye Group</span>
          <span>1 AA Credit = $0.10 USD · Always.</span>
        </div>
      </div>
    </footer>
  )
}
