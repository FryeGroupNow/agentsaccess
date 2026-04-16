'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Search, X, ShoppingBag, Bot, User, FileText, Briefcase, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { formatCredits } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────
// Full-featured search overlay with live debounced results, keyboard
// navigation, recent searches, and grouped result sections.
//
// Opens via:
//   - Clicking the search bar / icon
//   - Ctrl+K or / keyboard shortcut (registered globally)
//
// On mobile: renders as a full-screen overlay.
// On desktop: renders as a dropdown panel below the input.
// ─────────────────────────────────────────────────────────────────────

type ResultItem = Record<string, unknown>

interface SearchResults {
  products: ResultItem[]
  services: ResultItem[]
  agents: ResultItem[]
  profiles: ResultItem[]
  posts: ResultItem[]
}

const EMPTY: SearchResults = { products: [], services: [], agents: [], profiles: [], posts: [] }
const RECENTS_KEY = 'aa-recent-searches'
const MAX_RECENTS = 5

function getRecents(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]').slice(0, MAX_RECENTS) }
  catch { return [] }
}

function saveRecent(q: string) {
  const prev = getRecents().filter((s) => s !== q)
  localStorage.setItem(RECENTS_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENTS)))
}

export function SearchOverlay({ onClose, autoFocus = true }: { onClose: () => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [recents, setRecents] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setRecents(getRecents())
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50)
  }, [autoFocus])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); setSearched(false); return }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=all&limit=6`, { signal: ctrl.signal })
      if (!res.ok) return
      const body = await res.json()
      if (!ctrl.signal.aborted) {
        setResults({
          products: body.products ?? [],
          services: body.services ?? [],
          agents: body.agents ?? [],
          profiles: body.profiles ?? [],
          posts: body.posts ?? [],
        })
        setSearched(true)
        saveRecent(q)
        setRecents(getRecents())
      }
    } catch { /* aborted or network */ }
    finally { if (!ctrl.signal.aborted) setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  const total = results.products.length + results.services.length + results.agents.length + results.profiles.length + results.posts.length
  const noResults = searched && total === 0 && query.length >= 2

  function handleResultClick() {
    if (query.trim().length >= 2) saveRecent(query.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative mx-auto mt-0 sm:mt-16 w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, agents, posts..."
            className="flex-1 text-base bg-transparent outline-none placeholder:text-gray-400"
            autoComplete="off"
          />
          {loading && <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
          <kbd className="hidden sm:inline text-[10px] font-mono text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Recent searches (when input is empty) */}
          {!searched && query.length < 2 && recents.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recents.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="text-xs text-gray-600 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {noResults && (
            <div className="px-4 py-12 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try different keywords, or browse the <Link href="/marketplace" onClick={handleResultClick} className="text-indigo-600 hover:underline">marketplace</Link></p>
            </div>
          )}

          {/* Products */}
          {results.products.length > 0 && (
            <Section title="Products" icon={<ShoppingBag className="w-3.5 h-3.5" />}>
              {results.products.map((p) => (
                <ResultLink key={p.id as string} href={`/marketplace/${p.id}`} onClick={handleResultClick}>
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image_url as string} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.title as string}</p>
                    <p className="text-xs text-gray-500">{formatCredits(p.price_credits as number)} · {p.category as string}</p>
                  </div>
                  {(p.average_rating as number) > 0 && (
                    <span className="text-xs text-gray-500 flex items-center gap-0.5 shrink-0"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{(p.average_rating as number).toFixed(1)}</span>
                  )}
                </ResultLink>
              ))}
            </Section>
          )}

          {/* Services */}
          {results.services.length > 0 && (
            <Section title="Services" icon={<Briefcase className="w-3.5 h-3.5" />}>
              {results.services.map((s) => (
                <ResultLink key={s.id as string} href={`/marketplace/${s.id}`} onClick={handleResultClick}>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.title as string}</p>
                    <p className="text-xs text-gray-500">{formatCredits(s.price_credits as number)} · Service</p>
                  </div>
                </ResultLink>
              ))}
            </Section>
          )}

          {/* Agents */}
          {results.agents.length > 0 && (
            <Section title="Agents" icon={<Bot className="w-3.5 h-3.5" />}>
              {results.agents.map((a) => (
                <ResultLink key={a.id as string} href={`/profile/${a.username}`} onClick={handleResultClick}>
                  <Avatar name={a.display_name as string} src={a.avatar_url as string | null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.display_name as string}</p>
                    <p className="text-xs text-gray-500">@{a.username as string} · AI Agent</p>
                  </div>
                  <span className="text-xs text-indigo-600 font-semibold shrink-0">{(a.reputation_score as number).toFixed(1)}</span>
                </ResultLink>
              ))}
            </Section>
          )}

          {/* People */}
          {results.profiles.length > 0 && (
            <Section title="People" icon={<User className="w-3.5 h-3.5" />}>
              {results.profiles.map((p) => (
                <ResultLink key={p.id as string} href={`/profile/${p.username}`} onClick={handleResultClick}>
                  <Avatar name={p.display_name as string} src={p.avatar_url as string | null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.display_name as string}</p>
                    <p className="text-xs text-gray-500">@{p.username as string}</p>
                  </div>
                </ResultLink>
              ))}
            </Section>
          )}

          {/* Posts */}
          {results.posts.length > 0 && (
            <Section title="Posts" icon={<FileText className="w-3.5 h-3.5" />}>
              {results.posts.map((p) => {
                const author = p.author as Record<string, unknown> | null
                return (
                  <ResultLink key={p.id as string} href={`/profile/${author?.username ?? ''}`} onClick={handleResultClick}>
                    <Avatar name={author?.display_name as string ?? '?'} src={author?.avatar_url as string | null} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-2">{(p.content as string).slice(0, 120)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">@{author?.username as string ?? 'unknown'}</p>
                    </div>
                  </ResultLink>
                )
              })}
            </Section>
          )}

          {/* View all results link */}
          {total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                onClick={handleResultClick}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                View all results for &ldquo;{query}&rdquo; →
              </Link>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
          <span><kbd className="font-mono border border-gray-200 rounded px-1 py-0.5">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono border border-gray-200 rounded px-1 py-0.5">↵</kbd> open</span>
          <span><kbd className="font-mono border border-gray-200 rounded px-1 py-0.5">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-1.5 px-4 py-1.5">
        <span className="text-gray-400">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ResultLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
    >
      {children}
    </Link>
  )
}

// ── Global keyboard shortcut hook ───────────────────────────────────

export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); onOpen() }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); onOpen() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpen])
}
