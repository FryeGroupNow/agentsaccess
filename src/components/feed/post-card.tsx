'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FollowButton } from './follow-button'
import { ReputationBadge } from '@/components/ui/reputation-badge'
import { ReportButton } from '@/components/shared/report-button'
import { ThumbsUp, ThumbsDown, MessageSquare, Bot, User, MoreHorizontal, Trash2, Send, ChevronDown, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post } from '@/types'

interface PostCardProps {
  post: Post
  currentUserId?: string
  isFollowing?: boolean
  index?: number
  promoted?: boolean
  isReply?: boolean
  onDeleted?: (id: string) => void
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

export function PostCard({ post, currentUserId, isFollowing = false, index = 0, promoted = false, isReply = false, onDeleted }: PostCardProps) {
  const [myReaction, setMyReaction] = useState<'like' | 'dislike' | null>(post.my_reaction ?? null)
  const [humanLikes,    setHumanLikes]    = useState(post.human_like_count    ?? 0)
  const [humanDislikes, setHumanDislikes] = useState(post.human_dislike_count ?? 0)
  const [botLikes]      = useState(post.bot_like_count    ?? 0)
  const [botDislikes]   = useState(post.bot_dislike_count ?? 0)
  const [reacting, setReacting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editSaving, setEditSaving] = useState(false)
  const [displayContent, setDisplayContent] = useState(post.content)
  // Only show "edited" if updated_at is more than 5 seconds after created_at.
  // Supabase can set both to slightly different timestamps on insert (ms drift).
  const [wasEdited, setWasEdited] = useState(() => {
    if (!post.updated_at || !post.created_at) return false
    return new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 5000
  })
  const [editedAt, setEditedAt] = useState(post.updated_at)

  // Reply state
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replying, setReplying] = useState(false)
  const [replies, setReplies] = useState<Post[]>([])
  const [showReplies, setShowReplies] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [replyCount, setReplyCount] = useState(post.reply_count ?? 0)

  const author    = post.author
  const isOwnPost = currentUserId === post.author_id
  const totalLikes = humanLikes + botLikes
  const totalDislikes = humanDislikes + botDislikes
  const isAgent = author?.user_type === 'agent'
  // index was used for an alternating row-stripe treatment that read as
  // early-2000s-forum on the dark feed background. The redesign drops the
  // stripes in favour of a single glass card style, but we keep the param
  // so existing callers still compile.
  void index

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

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/feed/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleted(true)
      // Notify parent to remove this specific reply from its array
      if (onDeleted) onDeleted(post.id)
    }
    setDeleting(false)
    setConfirmDelete(false)
  }

  async function handleSaveEdit() {
    if (!editContent.trim() || editSaving) return
    setEditSaving(true)
    const res = await fetch(`/api/feed/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim() }),
    })
    if (res.ok) {
      setDisplayContent(editContent.trim())
      setWasEdited(true)
      setEditedAt(new Date().toISOString())
      setEditing(false)
    }
    setEditSaving(false)
  }

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const res = await fetch(`/api/feed/${post.id}?limit=50`)
      if (res.ok) {
        const body = await res.json()
        setReplies((body.replies ?? []) as Post[])
        setRepliesLoaded(true)
      }
    } catch { /* ignore */ }
    setLoadingReplies(false)
  }

  async function submitReply() {
    if (!replyContent.trim() || replying) return
    setReplying(true)
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim(), parent_id: post.id, tags: [] }),
      })
      if (res.ok) {
        const newReply = await res.json()
        setReplies((prev) => [...prev, newReply as Post])
        setReplyContent('')
        setShowReplyForm(false)
        setReplyCount((c) => c + 1)
        setShowReplies(true)
        setRepliesLoaded(true)
      }
    } catch { /* ignore */ }
    setReplying(false)
  }

  function toggleReplies() {
    if (!showReplies && !repliesLoaded) loadReplies()
    setShowReplies(!showReplies)
  }

  if (deleted) return null

  return (
    <article
      className={cn(
        'rounded-2xl border transition-all duration-200 mb-3 backdrop-blur',
        isReply
          ? 'bg-white border-gray-100 shadow-none'
          : promoted
            ? 'border-amber-300/40 bg-gradient-to-br from-amber-50/90 via-white to-white shadow-sm ring-1 ring-amber-200/50'
            : 'border-white/10 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.18)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_32px_-10px_rgba(79,70,229,0.25)] hover:-translate-y-0.5',
      )}
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

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(post.created_at)}</span>
              {currentUserId && !isOwnPost && author && (
                <FollowButton targetId={author.id} initialIsFollowing={isFollowing} size="xs" />
              )}
              {/* Edit pencil — standalone, one click, own posts only */}
              {isOwnPost && !editing && (
                <button
                  onClick={() => { setEditing(true); setEditContent(displayContent) }}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Edit post"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="text-gray-300 hover:text-gray-500 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 py-1 min-w-[140px]">
                    {isOwnPost && !confirmDelete && (
                      <button
                        onClick={() => { setConfirmDelete(true) }}
                        className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                    {isOwnPost && confirmDelete && (
                      <div className="px-3 py-1.5 space-y-1">
                        <p className="text-[10px] text-red-700 font-semibold">Delete this post?</p>
                        <div className="flex gap-1">
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                          >
                            {deleting ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="text-[10px] text-gray-500 px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!isOwnPost && (
                      <div className="px-2 py-1">
                        <ReportButton targetType="post" targetId={post.id} label />
                      </div>
                    )}
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/feed/${post.id}`); setShowMenu(false) }}
                      className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content — inline edit or display */}
          {editing ? (
            <div className="mb-2 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={5000}
                rows={3}
                className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                disabled={editSaving}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={!editContent.trim() || editSaving}>
                  {editSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={editSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-2">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                {displayContent}
              </p>
              {wasEdited && (
                <span className="text-[10px] text-gray-400 mt-1 inline-block" title={editedAt ? new Date(editedAt).toLocaleString() : undefined}>
                  (edited)
                </span>
              )}
            </div>
          )}

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

          {/* Engagement bar — borderless pills on a hairline divider */}
          <div className="flex items-center gap-1 sm:gap-1.5 pt-2.5 mt-1 border-t border-gray-50 flex-wrap">
            {/* Like — pill chip, no outer border */}
            <button
              onClick={() => handleReact('like')}
              disabled={!currentUserId || reacting}
              aria-label="Like this post"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                myReaction === 'like'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-700',
                !currentUserId && 'cursor-default opacity-80'
              )}
            >
              <ThumbsUp className={cn('w-3.5 h-3.5', myReaction === 'like' && 'fill-current')} />
              <span>{totalLikes}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={() => handleReact('dislike')}
              disabled={!currentUserId || reacting}
              aria-label="Dislike this post"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                myReaction === 'dislike'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-red-50 hover:text-red-600',
                !currentUserId && 'cursor-default opacity-80'
              )}
            >
              <ThumbsDown className={cn('w-3.5 h-3.5', myReaction === 'dislike' && 'fill-current')} />
              <span>{totalDislikes}</span>
            </button>

            {/* Human / bot breakdown — small text, no extra border */}
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-gray-100 text-[11px] font-semibold text-gray-500">
              <span className="flex items-center gap-1" title={`${humanLikes} human likes, ${humanDislikes} dislikes`}>
                <User className="w-3 h-3 text-indigo-400" />
                <span className="text-indigo-600">{humanLikes}↑</span>
                <span className="text-gray-300">·</span>
                <span className="text-red-500">{humanDislikes}↓</span>
              </span>
              <span className="flex items-center gap-1" title={`${botLikes} bot likes, ${botDislikes} dislikes`}>
                <Bot className="w-3 h-3 text-violet-400" />
                <span className="text-violet-600">{botLikes}↑</span>
                <span className="text-gray-300">·</span>
                <span className="text-red-500">{botDislikes}↓</span>
              </span>
            </div>

            {/* Reply pill */}
            {currentUserId && !isReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all ml-auto"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Reply
              </button>
            )}

            {/* Reply count toggle */}
            {replyCount > 0 && !isReply && (
              <button
                onClick={toggleReplies}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-50 transition-colors"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showReplies && 'rotate-180')} />
                {replyCount}
              </button>
            )}
          </div>

          {/* Inline reply form */}
          {showReplyForm && (
            <div className="mt-3 flex gap-2">
              <input
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply() } }}
                placeholder="Write a reply…"
                maxLength={5000}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={replying}
              />
              <Button size="sm" onClick={submitReply} disabled={!replyContent.trim() || replying} className="px-3">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Threaded replies */}
          {showReplies && !isReply && (
            <div className="mt-3 pl-4 border-l-2 border-indigo-100 space-y-0">
              {loadingReplies && <p className="text-xs text-gray-400 py-2">Loading replies…</p>}
              {replies.map((reply) => (
                <PostCard
                  key={reply.id}
                  post={reply}
                  currentUserId={currentUserId}
                  isReply
                  index={0}
                  onDeleted={(id) => {
                    setReplies((prev) => prev.filter((r) => r.id !== id))
                    setReplyCount((c) => Math.max(0, c - 1))
                  }}
                />
              ))}
              {repliesLoaded && replies.length === 0 && (
                <p className="text-xs text-gray-400 py-2">No replies yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
