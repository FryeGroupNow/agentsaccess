'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FollowButton } from './follow-button'
import { ThumbsUp, ThumbsDown, MessageSquare, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post } from '@/types'
import { ReputationBadge } from '@/components/ui/reputation-badge'

interface PostCardProps {
  post: Post
  currentUserId?: string
  isFollowing?: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function PostCard({ post, currentUserId, isFollowing = false }: PostCardProps) {
  const [myReaction, setMyReaction] = useState<'like' | 'dislike' | null>(post.my_reaction ?? null)

  // Local copies of counts so we can optimistically update
  const [humanLikes,    setHumanLikes]    = useState(post.human_like_count    ?? 0)
  const [humanDislikes, setHumanDislikes] = useState(post.human_dislike_count ?? 0)
  const [botLikes]      = useState(post.bot_like_count      ?? 0)
  const [botDislikes]   = useState(post.bot_dislike_count   ?? 0)
  const [reacting, setReacting] = useState(false)

  const author    = post.author
  const isOwnPost = currentUserId === post.author_id

  // Determine which counter to update based on who the current user is
  // We don't know the current user's type here, so we optimistically update
  // both and the server trigger reconciles on next load.
  async function handleReact(reaction: 'like' | 'dislike') {
    if (!currentUserId || reacting) return
    setReacting(true)

    const prev = myReaction
    const removing = prev === reaction

    // Optimistic update
    setMyReaction(removing ? null : reaction)

    if (author?.user_type === 'agent') {
      // Reaction to a bot post — track in bot bucket... actually we track
      // the reactor's type, not the author's. Since we don't know the
      // current user's type in the client, optimistically update human counts
      // (server trigger will correct on next fetch).
    }
    // Simplified optimistic: just toggle without bucket discrimination
    if (prev === 'like') setHumanLikes((c) => Math.max(0, c - 1))
    if (prev === 'dislike') setHumanDislikes((c) => Math.max(0, c - 1))
    if (!removing) {
      if (reaction === 'like') setHumanLikes((c) => c + 1)
      else setHumanDislikes((c) => c + 1)
    }

    if (removing) {
      await fetch(`/api/feed/${post.id}/react`, { method: 'DELETE' })
    } else {
      await fetch(`/api/feed/${post.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      })
    }
    setReacting(false)
  }

  return (
    <article className="py-5 border-b border-gray-100 last:border-0">
      <div className="flex gap-3">
        {author ? (
          <Link href={`/profile/${author.username}`} className="shrink-0">
            <Avatar name={author.display_name} size="md" />
          </Link>
        ) : (
          <Avatar name="?" size="md" />
        )}

        <div className="flex-1 min-w-0">
          {/* Author row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {author ? (
              <Link
                href={`/profile/${author.username}`}
                className="font-semibold text-gray-900 hover:underline text-sm"
              >
                {author.display_name}
              </Link>
            ) : (
              <span className="font-semibold text-gray-900 text-sm">Unknown</span>
            )}
            {author && (
              <Badge variant={author.user_type === 'agent' ? 'agent' : 'human'} className="text-xs">
                {author.user_type === 'agent' ? (
                  <><Bot className="w-2.5 h-2.5 mr-0.5" />agent</>
                ) : (
                  <><User className="w-2.5 h-2.5 mr-0.5" />human</>
                )}
              </Badge>
            )}
            {author && (
              <span className="text-xs text-gray-400">@{author.username}</span>
            )}
            {author && (
              <ReputationBadge score={author.reputation_score} size="sm" />
            )}
            {/* Follow button — shown when logged in and not own post */}
            {currentUserId && !isOwnPost && author && (
              <FollowButton
                targetId={author.id}
                initialIsFollowing={isFollowing}
                size="xs"
              />
            )}
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(post.created_at)}</span>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Reactions + reply count */}
          <div className="flex items-center gap-4 mt-3">
            {/* Like / dislike buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleReact('like')}
                disabled={!currentUserId || reacting}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors',
                  myReaction === 'like'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50',
                  !currentUserId && 'cursor-default'
                )}
              >
                <ThumbsUp className={cn('w-3.5 h-3.5', myReaction === 'like' && 'fill-current')} />
              </button>
              <button
                onClick={() => handleReact('dislike')}
                disabled={!currentUserId || reacting}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors',
                  myReaction === 'dislike'
                    ? 'bg-red-50 text-red-500'
                    : 'text-gray-400 hover:text-red-400 hover:bg-red-50',
                  !currentUserId && 'cursor-default'
                )}
              >
                <ThumbsDown className={cn('w-3.5 h-3.5', myReaction === 'dislike' && 'fill-current')} />
              </button>
            </div>

            {/* Human reaction counts */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <User className="w-3 h-3 text-gray-400" />
              <span className="text-indigo-600 font-medium">{humanLikes}↑</span>
              <span className="text-red-400">{humanDislikes}↓</span>
            </div>

            {/* Bot reaction counts */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Bot className="w-3 h-3 text-gray-400" />
              <span className="text-indigo-600 font-medium">{botLikes}↑</span>
              <span className="text-red-400">{botDislikes}↓</span>
            </div>

            {/* Reply count */}
            <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
              <MessageSquare className="w-3.5 h-3.5" />
              {post.reply_count > 0 && post.reply_count}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
