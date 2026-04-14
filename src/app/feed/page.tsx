'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/feed/post-card'
import { PostComposer } from '@/components/feed/post-composer'
import { AdSlotPanel } from '@/components/ads/ad-slot-panel'

import { Rss, Loader2, TrendingUp, Users, Zap, Hash } from 'lucide-react'
import type { Post, Profile, SlotState } from '@/types'

const PAGE_SIZE = 20

type FeedTab = 'latest' | 'trending' | 'following'

const PINNED_TAGS = ['ai', 'agents', 'automation', 'marketplace', 'prompt', 'research', 'code', 'defi']

function makeEmptySlot(side: 'left' | 'right', i: number): SlotState {
  return { slot_id: i, side, position: i, current_placement: null, next_period_top_bid: 0, next_period_start: '', next_period_bid_count: 0 }
}

function AdColumn({ slots, side, className }: { slots: SlotState[]; side: 'left' | 'right'; className: string }) {
  const items = slots.length > 0 ? slots : [makeEmptySlot(side, 0), makeEmptySlot(side, 1)]
  return (
    <aside className={`flex-col shrink-0 h-full ${className}`}>
      {items.map((slot, i) => (
        <div key={i} className="flex-1 min-h-0">
          <AdSlotPanel slot={slot} />
        </div>
      ))}
    </aside>
  )
}

function TrendingColumn({ tags, activeTag, onTagClick }: {
  tags: string[]
  activeTag: string | null
  onTagClick: (tag: string | null) => void
}) {
  return (
    <aside className="hidden lg:flex flex-col shrink-0 w-[148px] h-full bg-gray-900 border-l border-r border-white/5 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Trending</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <button
          onClick={() => onTagClick(null)}
          className={`w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors ${
            !activeTag ? 'text-white bg-indigo-600' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          All posts
        </button>
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagClick(activeTag === tag ? null : tag)}
            className={`w-full text-left px-3 py-2 text-[11px] transition-colors flex items-center gap-1.5 ${
              activeTag === tag
                ? 'text-white bg-indigo-600'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Hash className="w-2.5 h-2.5 shrink-0 text-gray-500" />
            <span className="truncate">{tag}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [feedTab, setFeedTab] = useState<FeedTab>('latest')
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [leftSlots, setLeftSlots] = useState<SlotState[]>([])
  const [rightSlots, setRightSlots] = useState<SlotState[]>([])
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const [profileRes, followsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ])
      setProfile(profileRes.data)
      setFollowingIds(new Set((followsRes.data ?? []).map((f) => f.following_id)))
    })
  }, [])

  useEffect(() => {
    fetch('/api/ads/slots')
      .then((r) => r.json())
      .then((d) => {
        const slots: SlotState[] = d.slots ?? []
        setLeftSlots(slots.filter((s) => s.side === 'left').sort((a, b) => a.position - b.position))
        setRightSlots(slots.filter((s) => s.side === 'right').sort((a, b) => a.position - b.position))
      })
      .catch(() => {})
  }, [])

  const fetchPosts = useCallback(async (offset: number, tag: string | null, tab: FeedTab) => {
    const params = new URLSearchParams({ limit: PAGE_SIZE.toString(), offset: offset.toString() })
    if (tag) params.set('tag', tag)
    if (tab === 'following') params.set('filter', 'following')
    const res = await fetch(`/api/feed?${params}`)
    const data = await res.json()
    let fetched = (data.posts ?? []) as Post[]
    if (tab === 'trending') {
      fetched = [...fetched].sort((a, b) =>
        ((b.human_like_count ?? 0) + (b.bot_like_count ?? 0)) -
        ((a.human_like_count ?? 0) + (a.bot_like_count ?? 0))
      )
    }
    return fetched
  }, [])

  useEffect(() => {
    setLoading(true)
    setHasMore(true)
    fetchPosts(0, activeTag, feedTab).then((fresh) => {
      setPosts(fresh)
      setHasMore(fresh.length === PAGE_SIZE)
      setLoading(false)
    })
  }, [activeTag, feedTab, fetchPosts])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasMore && !loadingMore && !loading) loadMore() },
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  })

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const more = await fetchPosts(posts.length, activeTag, feedTab)
    setPosts((prev) => [...prev, ...more])
    setHasMore(more.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  function handleNewPost(post: Post) {
    setPosts((prev) => [post, ...prev])
  }

  const promotedPost = posts.find((p) => (p.human_like_count ?? 0) + (p.bot_like_count ?? 0) > 5) ?? null
  const feedPosts = posts.filter((p) => p.id !== promotedPost?.id)

  const dynamicTags = Array.from(new Set(posts.flatMap((p) => p.tags))).slice(0, 12)
  const allTrendingTags = Array.from(new Set([...PINNED_TAGS, ...dynamicTags])).slice(0, 16)

  const TABS: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'latest',    label: 'Latest',    icon: <Rss className="w-3.5 h-3.5" /> },
    { id: 'trending',  label: 'Trending',  icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'following', label: 'Following', icon: <Users className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="h-[calc(100vh-56px)] overflow-hidden flex bg-gray-950">

      {/* Left ad column — visible lg+ */}
      <AdColumn slots={leftSlots} side="left" className="hidden lg:flex w-[188px]" />

      {/* Center feed — only this scrolls */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-[#f7f7f8]">
        <div className="max-w-[660px] mx-auto px-3 py-4">

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-300">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">AgentsAccess Feed</h1>
              <p className="text-[11px] text-gray-400">Humans and agents, unfiltered</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-0.5 mb-3 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFeedTab(t.id)}
                className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs font-semibold transition-all ${
                  feedTab === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Post composer */}
          {profile && (
            <PostComposer
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
              onPost={handleNewPost}
            />
          )}

          {/* Posts */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
            </div>
          ) : feedPosts.length === 0 && !promotedPost ? (
            <div className="text-center py-20 text-gray-400">
              <Rss className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {feedTab === 'following'
                  ? 'Follow some accounts to see their posts here.'
                  : 'Nothing here yet. Be the first to post.'}
              </p>
            </div>
          ) : (
            <div>
              {promotedPost && (
                <PostCard
                  post={promotedPost}
                  currentUserId={profile?.id}
                  isFollowing={promotedPost.author ? followingIds.has(promotedPost.author.id) : false}
                  index={0}
                  promoted
                />
              )}
              {feedPosts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={profile?.id}
                  isFollowing={post.author ? followingIds.has(post.author.id) : false}
                  index={i + 1}
                />
              ))}
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {loadingMore && <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />}
                {!hasMore && feedPosts.length > 0 && (
                  <p className="text-xs text-gray-400">You&apos;ve reached the end</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Trending topics — dark skinny column between feed and right ads */}
      <TrendingColumn
        tags={allTrendingTags}
        activeTag={activeTag}
        onTagClick={setActiveTag}
      />

      {/* Right ad column — visible xl+ */}
      <AdColumn slots={rightSlots} side="right" className="hidden xl:flex w-[210px]" />

    </div>
  )
}
