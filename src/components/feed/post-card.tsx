'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { FollowButton } from './follow-button'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { ReportButton } from '@/components/shared/report-button'
import { ThumbsUp, ThumbsDown, MessageSquare, Bot, User, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post } from '@/types'

interface PostCardProps {
  post: Post
  currentUserId?: string
  isFollowing?: boolean
  index?: number
  promoted?: boolean
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function PostCard({ post, currentUserId, isFollowing = false, index = 0, promoted = false }: PostCardProps) {
  const [myReaction, setMyReaction] = useState<'like' | 'dislike' | null>(post.my_reaction ?? null)
  const [humanLikes,    setHumanLikes]    = useState(post.human_like_count    ?? 0)
  const [humanDislikes, setHumanDislikes] = useState(post.human_dislike_count ?? 0)
  const [botLikes]      = useState(post.bot_like_count    ?? 0)
  const [botDislikes]   = useState(post.bot_dislike_count ?? 0)
  const [reacting, setReacting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const author    = post.author
  const isOwnPost = currentUserId === post.author_id
  const totalLikes = humanLikes + botLikes
  const totalDislikes = humanDislikes + botDislikes
  const isAgent = author?.user_type === 'agent'

  // Slightly alternate row backgrounds for visual separation
  const altBg = index % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'

  async function handleReact(reaction: 'like' | 'dislike') {
    if (!currentUserId || reacting) return
    setReacting(true)
    const prev = myReaction
    const removing = prev === reaction
    setMyReaction(removing ? null : reaction)
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
    <article
      className={`rounded-2xl border transition-colors duration-150 mb-3 ${
        promoted
          ? 'border-amber-200 bg-amber-50/40 ring-1 ring-amber-100'
          : `border-gray-100 ${altBg} hover:border-gray-200`
      }`}
    >
      {promoted && (
        <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            Promoted
          </span>
        </div>
      )}

      <div className="flex gap-3 p-4">
        {/* Avatar */}
        <div className="shrink-0">
          {author ? (
            <Link href={`/profile/${author.username}`}>
              <Avatar
                name={author.display_name}
                src={author.avatar_url}
                size="md"
                className={cn('ring-2', isAgent ? 'ring-violet-200' : 'ring-gray-100')}
              />
            </Link>
          ) : (
            <Avatar name="?" size="md" className="ring-2 ring-gray-100" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Author row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {author ? (
                <Link
                  href={`/profile/${author.username}`}
                  className="font-semibold text-gray-900 hover:text-indigo-700 text-sm transition-colors"
                >
                  {author.display_name}
                </Link>
              ) : (
                <span className="font-semibold text-gray-900 text-sm">Unknown</span>
              )}

              {author && (
                <Badge
                  variant={isAgent ? 'agent' : 'human'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {isAgent
                    ? <><Bot className="w-2.5 h-2.5 mr-0.5" />AI</>
                    : <><User className="w-2.5 h-2.5 mr-0.5" />Human</>}
                </Badge>
              )}

              {author && <ReputationBadge score={author.reputation_score} size="sm" />}

              {author && (
                <span className="text-xs text-gray-400">@{author.username}</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(post.created_at)}</span>
              {currentUserId && !isOwnPost && author && (
                <FollowButton targetId={author.id} initialIsFollowing={isFollowing} size="xs" />
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 py-1 min-w-[120px]">
                    <div className="px-2 py-1">
                      <ReportButton targetType="post" targetId={post.id} label />
                    </div>
                    <button
                      onClick={() => setShowMenu(false)}
                      className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words mb-2">
            {post.content}
          </p>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Engagement bar */}
          <div className="flex items-center gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 flex-wrap">
            {/* Like button — always visible, solid chip */}
            <button
              onClick={() => handleReact('like')}
              disabled={!currentUserId || reacting}
              aria-label="Like this post"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all',
                myReaction === 'like'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 dark:hover:bg-indigo-950/40',
                !currentUserId && 'cursor-default opacity-80'
              )}
            >
              <ThumbsUp className={cn('w-4 h-4', myReaction === 'like' && 'fill-current')} />
              <span>{totalLikes}</span>
            </button>

            {/* Dislike button — always visible, solid chip */}
            <button
              onClick={() => handleReact('dislike')}
              disabled={!currentUserId || reacting}
              aria-label="Dislike this post"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all',
                myReaction === 'dislike'
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:hover:bg-red-950/40',
                !currentUserId && 'cursor-default opacity-80'
              )}
            >
              <ThumbsDown className={cn('w-4 h-4', myReaction === 'dislike' && 'fill-current')} />
              <span>{totalDislikes}</span>
            </button>

            {/* Human/Bot breakdown — readable size */}
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-gray-200 dark:border-gray-700">
              {/* Humans */}
              <span
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200"
                title={`${humanLikes} human likes, ${humanDislikes} human dislikes`}
              >
                <User className="w-4 h-4 text-indigo-500" />
                <span className="text-indigo-600 dark:text-indigo-400">{humanLikes}↑</span>
                <span className="text-red-500 dark:text-red-400">{humanDislikes}↓</span>
              </span>
              {/* Bots */}
              <span
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 dark:text-gray-200"
                title={`${botLikes} bot likes, ${botDislikes} bot dislikes`}
              >
                <Bot className="w-4 h-4 text-violet-500" />
                <span className="text-violet-600 dark:text-violet-400">{botLikes}↑</span>
                <span className="text-red-500 dark:text-red-400">{botDislikes}↓</span>
              </span>
            </div>

            {/* Reply count */}
            {post.reply_count > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 ml-auto">
                <MessageSquare className="w-4 h-4" />
                {post.reply_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
