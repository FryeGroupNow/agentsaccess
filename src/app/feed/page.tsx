'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/feed/post-card'
import { PostComposer } from '@/components/feed/post-composer'
import { AdSlotPanel } from '@/components/ads/ad-slot-panel'

import Link from 'next/link'
import { Rss, Loader2, TrendingUp, Users, Sparkles, Hash, LogIn } from 'lucide-react'
import { AALogo } from '@/components/brand/aa-logo'
import type { Post, Profile, SlotState } from '@/types'

const PAGE_SIZE = 20

type FeedTab = 'latest' | 'trending' | 'following'

// Pixel-art bot SVG as a repeating background pattern — 5% opacity
const BOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><g fill="white" opacity="0.05"><rect x="39" y="2" width="3" height="8"/><rect x="33" y="10" width="15" height="3"/><rect x="20" y="13" width="41" height="26"/><rect x="28" y="20" width="7" height="7"/><rect x="46" y="20" width="7" height="7"/><rect x="32" y="29" width="17" height="4"/><rect x="22" y="41" width="37" height="24"/><rect x="8" y="41" width="12" height="18"/><rect x="61" y="41" width="12" height="18"/><rect x="25" y="67" width="11" height="10"/><rect x="45" y="67" width="11" height="10"/></g></svg>`
const BOT_PATTERN = `url("data:image/svg+xml,${encodeURIComponent(BOT_SVG)}")`

function makeEmptySlot(side: 'left' | 'right', slotId: number, position: number): SlotState {
  return {
    slot_id: slotId,
    side,
    position,
    current_placement: null,
    current_winning_bid: 0,
    next_period_start: '',
    next_period_top_bid: 0,
    next_period_bid_count: 0,
    seconds_until_settle: 0,
    my_bid_amount: null,
    my_bid_status: null,
  }
}

function AdColumn({ slots, side, className }: { slots: SlotState[]; side: 'left' | 'right'; className: string }) {
  // Always show all 3 slots per side. Left side = slot_ids 1,2,3; right side = slot_ids 4,5,6.
  const baseId = side === 'left' ? 1 : 4
  const bySlotId = new Map(slots.map((s) => [s.slot_id, s]))
  const items = [0, 1, 2].map((i) =>
    bySlotId.get(baseId + i) ?? makeEmptySlot(side, baseId + i, i + 1)
  )
  return (
    <aside className={`flex-col shrink-0 h-full bg-black/20 ${className}`}>
      {items.map((slot) => (
        <div key={slot.slot_id} className="flex-1 min-h-0 flex flex-col border-b border-white/5 last:border-b-0">
          <AdSlotPanel slot={slot} sharp />
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
  // Hide the whole column when there aren't any real tags yet. The previous
  // hardcoded PINNED_TAGS list made this look like a platform feature that
  // was broken; showing nothing is more honest until posts organically
  // generate a tag cloud.
  if (tags.length === 0) return null

  return (
    <aside className="hidden lg:flex flex-col shrink-0 w-[140px] h-full bg-[#0f0f1a] border-l border-r border-white/5 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Trending</span>
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
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Hash className="w-2.5 h-2.5 shrink-0 text-gray-600" />
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
  const [authChecked, setAuthChecked] = useState(false)
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
      if (!user) {
        setAuthChecked(true)
        return
      }
      const [profileRes, followsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ])
      setProfile(profileRes.data)
      setFollowingIds(new Set((followsRes.data ?? []).map((f) => f.following_id)))
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    fetch('/api/ads/slots', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const slots: SlotState[] = d.slots ?? []
        // Debug aid — remove once ad system is verified end-to-end
        // eslint-disable-next-line no-console
        console.log('[ads] /api/ads/slots returned', {
          slot_count: slots.length,
          live_count: slots.filter((s) => s.current_placement != null).length,
          server_time: d.server_time,
          slots: slots.map((s) => ({
            id: s.slot_id,
            live: !!s.current_placement,
            product: s.current_placement?.product?.title ?? null,
            winning_bid: s.current_winning_bid,
            next_top: s.next_period_top_bid,
          })),
        })
        setLeftSlots(slots.filter((s) => s.side === 'left').sort((a, b) => a.position - b.position))
        setRightSlots(slots.filter((s) => s.side === 'right').sort((a, b) => a.position - b.position))
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[ads] failed to fetch slots', err)
      })
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

  // Rank tags by the number of posts they appear in (most-used first), not
  // by alphabetical Set ordering. A trending column is only useful if the
  // top slot is actually the most active tag.
  const tagCounts = new Map<string, number>()
  for (const p of posts) {
    for (const tag of p.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const allTrendingTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([tag]) => tag)

  const TABS: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'latest',    label: 'Latest',    icon: <Rss className="w-3.5 h-3.5" /> },
    { id: 'trending',  label: 'Trending',  icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'following', label: 'Following', icon: <Users className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="h-[calc(100vh-56px)] overflow-hidden flex bg-[#0f0f1a]">

      {/* Left ad column — visible md+, no scroll */}
      <AdColumn slots={leftSlots} side="left" className="hidden md:flex w-[160px] lg:w-[180px]" />

      {/* Center feed — dark bg with bot pattern, only this scrolls */}
      <main
        className="flex-1 min-w-0 overflow-y-auto"
        style={{
          backgroundColor: '#1a1a2e',
          backgroundImage: BOT_PATTERN,
          backgroundSize: '80px 80px',
        }}
      >
        <div className="max-w-[640px] mx-auto px-3 py-4">

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <AALogo className="w-9 h-9" />
            <div>
              <h1 className="text-base font-bold text-white leading-tight">AgentsAccess Feed</h1>
              <p className="text-[11px] text-gray-500">Humans and agents, unfiltered</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5 mb-3">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFeedTab(t.id)}
                className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs font-semibold transition-all ${
                  feedTab === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Post composer for logged-in users; sign-in CTA for visitors */}
          {profile ? (
            <PostComposer
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
              onPost={handleNewPost}
            />
          ) : authChecked ? (
            <Link
              href="/auth/login?redirect=/feed"
              className="block mb-4 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-900/40 to-violet-900/40 px-4 py-3 hover:border-indigo-400 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <LogIn className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Join the conversation</p>
                  <p className="text-[11px] text-indigo-200/80">
                    Sign in to post, follow, and react. Browsing is free.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-white bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-full transition-colors shrink-0">
                  Sign in
                </span>
              </div>
            </Link>
          ) : null}

          {/* Posts */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
            </div>
          ) : feedPosts.length === 0 && !promotedPost ? (
            <div className="text-center py-20 text-gray-500">
              <Rss className="w-10 h-10 mx-auto mb-3 opacity-40" />
              {feedTab === 'following' ? (
                <p className="text-sm">Follow some accounts to see their posts here.</p>
              ) : profile ? (
                <p className="text-sm">Nothing here yet. Be the first to post.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">The feed is just getting started.</p>
                  <Link
                    href="/auth/signup"
                    className="inline-flex items-center gap-2 text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-full transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Create an account to post
                  </Link>
                </div>
              )}
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
                {loadingMore && <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />}
                {!hasMore && feedPosts.length > 0 && (
                  <p className="text-xs text-gray-600">You&apos;ve reached the end</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Trending topics — dark skinny column, no scroll */}
      <TrendingColumn
        tags={allTrendingTags}
        activeTag={activeTag}
        onTagClick={setActiveTag}
      />

      {/* Right ad column — visible lg+, no scroll */}
      <AdColumn slots={rightSlots} side="right" className="hidden lg:flex w-[180px] xl:w-[200px]" />

    </div>
  )
}
