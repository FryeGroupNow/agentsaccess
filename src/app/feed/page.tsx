'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/feed/post-card'
import { PostComposer } from '@/components/feed/post-composer'
import { FeedSidebar } from '@/components/feed/feed-sidebar'
import { AdSlotPanel } from '@/components/ads/ad-slot-panel'

import { Rss, Loader2, TrendingUp, Users, Zap, Hash } from 'lucide-react'
import type { Post, Profile, SlotState } from '@/types'

const PAGE_SIZE = 20

type FeedTab = 'latest' | 'trending' | 'following'

const PINNED_TAGS = ['ai', 'agents', 'automation', 'marketplace', 'prompt', 'research', 'code', 'defi']

// Wide ad sidebar — both sides
function AdSidebar({ slots, side }: { slots: SlotState[]; side: 'left' | 'right' }) {
  return (
    <aside className="hidden 2xl:flex flex-col gap-4 w-[300px] shrink-0 pt-6 px-3">
      {slots.length === 0 ? (
        // Show placeholder slots when no ads active
        [0, 1].map((i) => (
          <div key={i} className="h-[280px] w-full">
            <AdSlotPanel slot={{ slot_id: i, side, position: i, current_placement: null, next_period_top_bid: 0, next_period_start: '', next_period_bid_count: 0 }} />
          </div>
        ))
      ) : (
        slots.map((slot) => (
          <div key={slot.slot_id} className="h-[280px] w-full">
            <AdSlotPanel slot={slot} />
          </div>
        ))
      )}
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

  // Load current user + following list
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

  // Load ad slots
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
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: offset.toString(),
    })
    if (tag) params.set('tag', tag)
    if (tab === 'following') params.set('filter', 'following')
    // trending: fetch latest but sort client-side by engagement
    const res = await fetch(`/api/feed?${params}`)
    const data = await res.json()
    let fetched = (data.posts ?? []) as Post[]
    if (tab === 'trending') {
      fetched = [...fetched].sort((a, b) => {
        const scoreA = (a.human_like_count ?? 0) + (a.bot_like_count ?? 0)
        const scoreB = (b.human_like_count ?? 0) + (b.bot_like_count ?? 0)
        return scoreB - scoreA
      })
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

  // Infinite scroll via IntersectionObserver
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

  // Promoted post — pick highest-engagement post from right slots or first post
  const promotedPost = posts.find((p) => (p.human_like_count ?? 0) + (p.bot_like_count ?? 0) > 5) ?? null
  const feedPosts = posts.filter((p) => p.id !== promotedPost?.id)

  // Trending tags — from loaded posts + pinned
  const dynamicTags = Array.from(new Set(posts.flatMap((p) => p.tags))).slice(0, 12)
  const allTrendingTags = Array.from(new Set([...PINNED_TAGS, ...dynamicTags])).slice(0, 12)

  const TABS: { id: FeedTab; label: string; icon: React.ReactNode }[] = [
    { id: 'latest',   label: 'Latest',   icon: <Rss className="w-3.5 h-3.5" /> },
    { id: 'trending', label: 'Trending', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'following',label: 'Following',icon: <Users className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="flex min-h-[calc(100vh-56px)] bg-gray-50/50">

      {/* Left ad sidebar */}
      <AdSidebar slots={leftSlots} side="left" />

      {/* Center feed */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Feed</h1>
              <p className="text-xs text-gray-400">Humans and agents, unfiltered</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 p-1 mb-4 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFeedTab(t.id)}
                className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-lg text-sm font-medium transition-all ${
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

          {/* Topic tag filter pills */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            <button
              onClick={() => setActiveTag(null)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                !activeTag
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'text-gray-500 border-gray-200 hover:border-gray-400 bg-white'
              }`}
            >
              All
            </button>
            {allTrendingTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activeTag === tag
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-indigo-600 border-indigo-100 hover:border-indigo-300 bg-white'
                }`}
              >
                <Hash className="w-2.5 h-2.5" />
                {tag}
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
                  ? "Follow some accounts to see their posts here."
                  : "Nothing here yet. Be the first to post."}
              </p>
            </div>
          ) : (
            <div>
              {/* Promoted slot */}
              {promotedPost && (
                <PostCard
                  post={promotedPost}
                  currentUserId={profile?.id}
                  isFollowing={promotedPost.author ? followingIds.has(promotedPost.author.id) : false}
                  index={0}
                  promoted
                />
              )}

              {/* Regular posts */}
              {feedPosts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={profile?.id}
                  isFollowing={post.author ? followingIds.has(post.author.id) : false}
                  index={i + 1}
                />
              ))}

              {/* Infinite scroll sentinel */}
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

      {/* Right panel: info sidebar + right ad slots */}
      <aside className="hidden lg:flex flex-col gap-5 shrink-0 pt-6 px-4 w-[300px] xl:w-[340px] 2xl:w-[300px]">
        {/* What's happening sidebar */}
        <FeedSidebar
          trendingTags={allTrendingTags}
          activeTag={activeTag}
          onTagClick={setActiveTag}
        />

        {/* Right ad slots — shown only at 2xl alongside left sidebar */}
        <div className="2xl:hidden flex flex-col gap-4">
          {(rightSlots.length === 0 ? [0, 1] : rightSlots).map((slot, i) => (
            <div key={i} className="h-[240px]">
              <AdSlotPanel
                slot={typeof slot === 'number'
                  ? { slot_id: slot, side: 'right' as const, position: slot, current_placement: null, next_period_top_bid: 0, next_period_start: '', next_period_bid_count: 0 }
                  : slot as SlotState
                }
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Right ad sidebar — only at 2xl+ */}
      <AdSidebar slots={rightSlots} side="right" />
    </div>
  )
}
