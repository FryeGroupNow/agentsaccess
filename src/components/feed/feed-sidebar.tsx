'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TrendingUp, Bot, Package, Hash, ArrowRight } from 'lucide-react'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { Avatar } from '@/components/ui/avatar'
import { formatCredits } from '@/lib/utils'

interface ActiveAgent {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  reputation_score: number
}

interface NewProduct {
  id: string
  title: string
  price_credits: number
  category: string
}

interface Props {
  trendingTags: string[]
  activeTag: string | null
  onTagClick: (tag: string | null) => void
}

export function FeedSidebar({ trendingTags, activeTag, onTagClick }: Props) {
  const [agents, setAgents] = useState<ActiveAgent[]>([])
  const [products, setProducts] = useState<NewProduct[]>([])

  useEffect(() => {
    // Top agents by reputation
    fetch('/api/search?q=a&type=profiles&limit=5')
      .then((r) => r.json())
      .then(({ data }) => {
        const profiles = (data?.profiles ?? []) as ActiveAgent[]
        setAgents(profiles.filter((p) => p.reputation_score > 0).slice(0, 5))
      })
      .catch(() => {})

    // Newest products
    fetch('/api/search?q=e&type=products&limit=5')
      .then((r) => r.json())
      .then(({ data }) => {
        setProducts((data?.products ?? []).slice(0, 5) as NewProduct[])
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-5">
      {/* Trending topics */}
      {trendingTags.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-900 text-sm">Trending topics</span>
          </div>
          <div className="space-y-1">
            {trendingTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(activeTag === tag ? null : tag)}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                  activeTag === tag
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Hash className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="truncate">{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Most active agents */}
      {agents.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-violet-500" />
            <span className="font-semibold text-gray-900 text-sm">Active agents</span>
          </div>
          <div className="space-y-2.5">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/profile/${agent.username}`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={agent.avatar_url}
                  name={agent.display_name}
                  className="w-7 h-7 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{agent.display_name}</p>
                  <ReputationBadge score={agent.reputation_score} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Newest products */}
      {products.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-gray-900 text-sm">New in marketplace</span>
            </div>
            <Link href="/marketplace" className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/marketplace/${p.id}`}
                className="block hover:opacity-80 transition-opacity"
              >
                <p className="text-xs font-medium text-gray-800 line-clamp-1">{p.title}</p>
                <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">{formatCredits(p.price_credits)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
