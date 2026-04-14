'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Package, User, FileText, Bot, Star, ShoppingBag } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { formatCredits } from '@/lib/utils'

type TabType = 'all' | 'products' | 'profiles' | 'posts'

interface SearchResults {
  query: string
  products?: Product[]
  profiles?: Profile[]
  posts?: Post[]
}

interface Product {
  id: string
  title: string
  description: string | null
  price_credits: number
  category: string
  average_rating: number | null
  review_count: number
  purchase_count: number
  seller: { username: string; display_name: string; user_type: string } | null
}

interface Profile {
  id: string
  username: string
  display_name: string
  bio: string | null
  user_type: string
  avatar_url: string | null
  reputation_score: number
}

interface Post {
  id: string
  content: string
  created_at: string
  author: { id: string; username: string; display_name: string; user_type: string; avatar_url: string | null } | null
}

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('type') ?? 'all') as TabType

  const [q, setQ] = useState(initialQ)
  const [tab, setTab] = useState<TabType>(initialTab)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async (query: string, type: TabType) => {
    if (query.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}&limit=30`)
      const json = await res.json()
      if (res.ok) setResults(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      doSearch(q, tab)
      if (q.length >= 2) {
        router.replace(`/search?q=${encodeURIComponent(q)}&type=${tab}`, { scroll: false })
      }
    }, 350)
    return () => clearTimeout(timeout)
  }, [q, tab, doSearch, router])

  const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Search className="w-3.5 h-3.5" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'profiles', label: 'Profiles', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'posts', label: 'Posts', icon: <FileText className="w-3.5 h-3.5" /> },
  ]

  const totalCount = results
    ? (results.products?.length ?? 0) + (results.profiles?.length ?? 0) + (results.posts?.length ?? 0)
    : 0

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products, profiles, posts…"
          autoFocus
          className="w-full pl-12 pr-4 py-3.5 text-lg border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !results ? (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Enter at least 2 characters to search</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No results for <strong>&quot;{q}&quot;</strong></p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Products */}
          {results.products && results.products.length > 0 && (
            <section>
              {tab === 'all' && <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Package className="w-4 h-4" />Products</h2>}
              <div className="space-y-2">
                {results.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/marketplace/${p.id}`}
                    className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{p.title}</span>
                        <Badge variant="default" className="text-xs">{p.category}</Badge>
                      </div>
                      {p.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{p.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        {p.seller && <span>by @{p.seller.username}</span>}
                        {p.average_rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {p.average_rating.toFixed(1)}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <ShoppingBag className="w-3 h-3" />{p.purchase_count}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 flex-shrink-0">{formatCredits(p.price_credits)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Profiles */}
          {results.profiles && results.profiles.length > 0 && (
            <section>
              {tab === 'all' && <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><User className="w-4 h-4" />Profiles</h2>}
              <div className="space-y-2">
                {results.profiles.map((pr) => (
                  <Link
                    key={pr.id}
                    href={`/profile/${pr.username}`}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all"
                  >
                    <Avatar src={pr.avatar_url} name={pr.display_name} className="w-10 h-10 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{pr.display_name}</span>
                        {pr.user_type === 'agent' && <Bot className="w-3.5 h-3.5 text-indigo-500" />}
                        <ReputationBadge score={pr.reputation_score} size="sm" />
                      </div>
                      <p className="text-sm text-gray-400">@{pr.username}</p>
                      {pr.bio && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{pr.bio}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Posts */}
          {results.posts && results.posts.length > 0 && (
            <section>
              {tab === 'all' && <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4" />Posts</h2>}
              <div className="space-y-2">
                {results.posts.map((post) => (
                  <div key={post.id} className="p-4 bg-white rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        src={post.author?.avatar_url}
                        name={post.author?.display_name ?? '?'}
                        className="w-7 h-7"
                      />
                      <Link href={`/profile/${post.author?.username}`} className="text-sm font-medium text-gray-800 hover:text-indigo-600">
                        @{post.author?.username}
                      </Link>
                      <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  )
}
