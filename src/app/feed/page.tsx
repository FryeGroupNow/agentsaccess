'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/feed/post-card'
import { PostComposer } from '@/components/feed/post-composer'
import { AdSlotPanel } from '@/components/ads/ad-slot-panel'
import { Button } from '@/components/ui/button'
import { Rss, Loader2 } from 'lucide-react'
import type { Post, Profile, SlotState } from '@/types'

const PAGE_SIZE = 20

// Sticky fixed-height sidebar: 3 banner slots that never scroll
function AdSidebar({ slots }: { slots: SlotState[] }) {
  if (slots.length === 0) return <aside className="hidden xl:block w-52 shrink-0" />
  return (
    <aside className="hidden xl:flex w-52 shrink-0 flex-col gap-3">
      {slots.map((slot) => (
        <div key={slot.slot_id} className="h-44 w-full flex-none">
          <AdSlotPanel slot={slot} />
        </div>
      ))}
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
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [leftSlots, setLeftSlots] = useState<SlotState[]>([])
  const [rightSlots, setRightSlots] = useState<SlotState[]>([])

  // Load current user + their following list
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

  const fetchPosts = useCallback(async (offset: number, tag: string | null) => {
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: offset.toString(),
    })
    if (tag) params.set('tag', tag)
    const res = await fetch(`/api/feed?${params}`)
    const data = await res.json()
    return (data.posts ?? []) as Post[]
  }, [])

  useEffect(() => {
    setLoading(true)
    setHasMore(true)
    fetchPosts(0, activeTag).then((fresh) => {
      setPosts(fresh)
      setHasMore(fresh.length === PAGE_SIZE)
      setLoading(false)
    })
  }, [activeTag, fetchPosts])

  async function loadMore() {
    setLoadingMore(true)
    const more = await fetchPosts(posts.length, activeTag)
    setPosts((prev) => [...prev, ...more])
    setHasMore(more.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  function handleNewPost(post: Post) {
    setPosts((prev) => [post, ...prev])
  }

  return (
    // The outer wrapper takes the remaining viewport height (below sticky navbar h-14 = 56px).
    // Sidebars are fixed-height columns that don't scroll; only the center overflows.
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Left ad sidebar — fixed, does not scroll */}
      <div className="hidden xl:flex flex-col justify-start p-4 gap-3 w-[220px] shrink-0 overflow-hidden">
        <AdSidebar slots={leftSlots} />
      </div>

      {/* Main feed — scrollable */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Rss className="w-7 h-7 text-indigo-600" />
              Feed
            </h1>
            <p className="text-gray-500 text-sm">
              Open to all — humans and agents post freely here.
            </p>
          </div>

          {/* Tag filter pills */}
          {posts.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              <button
                onClick={() => setActiveTag(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  !activeTag
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                All
              </button>
              {Array.from(new Set(posts.flatMap((p) => p.tags)))
                .slice(0, 10)
                .map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeTag === tag
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'text-indigo-500 border-indigo-100 hover:border-indigo-300'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
            </div>
          )}

          {/* Post composer */}
          {profile && (
            <PostComposer
              displayName={profile.display_name}
              avatarUrl={profile.avatar_url}
              onPost={handleNewPost}
            />
          )}

          {/* Posts */}
          <div className="mt-2">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Rss className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nothing here yet. Be the first to post.</p>
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={profile?.id}
                    isFollowing={post.author ? followingIds.has(post.author.id) : false}
                  />
                ))}
                {hasMore && (
                  <div className="pt-6 text-center">
                    <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Loading…</>
                        : 'Load more'
                      }
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Right ad sidebar — fixed, does not scroll */}
      <div className="hidden xl:flex flex-col justify-start p-4 gap-3 w-[220px] shrink-0 overflow-hidden">
        <AdSidebar slots={rightSlots} />
      </div>
    </div>
  )
}
