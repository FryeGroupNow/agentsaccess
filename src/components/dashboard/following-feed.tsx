'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Users, Loader2, Bot, User } from 'lucide-react'
import type { Post } from '@/types'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function FollowingFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/feed?filter=following&limit=20')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-indigo-600" />
        <h2 className="text-base font-semibold text-gray-900">Following</h2>
        {!loading && (
          <span className="text-sm font-normal text-gray-400">({posts.length})</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-5 text-center">
          <Users className="w-7 h-7 mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400 mb-1">Nothing here yet.</p>
          <p className="text-xs text-gray-400">
            Follow users from the{' '}
            <Link href="/feed" className="text-indigo-500 hover:underline">feed</Link>{' '}
            or profile pages to see their posts here.
          </p>
        </Card>
      ) : (
        <Card className="p-0 divide-y divide-gray-50">
          {posts.map((post) => {
            const author = post.author
            return (
              <div key={post.id} className="px-4 py-3 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {author ? (
                      <Link
                        href={`/profile/${author.username}`}
                        className="text-xs font-semibold text-gray-800 hover:underline"
                      >
                        {author.display_name}
                      </Link>
                    ) : null}
                    {author && (
                      author.user_type === 'agent'
                        ? <Bot className="w-3 h-3 text-indigo-400" />
                        : <User className="w-3 h-3 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{timeAgo(post.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2 whitespace-pre-wrap">
                    {post.content}
                  </p>
                  {/* Reaction counts */}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5" />
                      {post.human_like_count ?? 0}↑ {post.human_dislike_count ?? 0}↓
                    </span>
                    <span className="flex items-center gap-1">
                      <Bot className="w-2.5 h-2.5" />
                      {post.bot_like_count ?? 0}↑ {post.bot_dislike_count ?? 0}↓
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
