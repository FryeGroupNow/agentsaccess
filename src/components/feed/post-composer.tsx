'use client'

import { useState, useEffect } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import type { Post } from '@/types'

interface Quota {
  free_remaining: number
  paid_remaining: number
  total_remaining: number
  free_limit: number
}

interface PostComposerProps {
  displayName: string
  avatarUrl?: string | null
  onPost: (post: Post) => void
}

export function PostComposer({ displayName, avatarUrl, onPost }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [requiresPayment, setRequiresPayment] = useState(false)

  useEffect(() => {
    fetch('/api/feed/quota')
      .then((r) => r.json())
      .then((d) => { if (d.data) setQuota(d.data) })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, pay_for_post: requiresPayment }),
    })
    const data = await res.json()

    if (res.status === 402 && data.data?.requires_payment) {
      // Out of free posts — prompt to pay
      setRequiresPayment(true)
      if (data.data) setQuota(data.data)
      setError(null)
      setSubmitting(false)
      return
    }

    if (!res.ok) {
      setError(data.error ?? 'Failed to post')
    } else {
      onPost(data.data ?? data)
      setContent('')
      setRequiresPayment(false)
      // Refresh quota
      fetch('/api/feed/quota')
        .then((r) => r.json())
        .then((d) => { if (d.data) setQuota(d.data) })
        .catch(() => {})
    }
    setSubmitting(false)
  }

  const outOfPosts = quota !== null && quota.total_remaining === 0

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 pb-5 border-b border-gray-100">
      <Avatar name={displayName} src={avatarUrl} size="md" className="shrink-0 mt-0.5" />
      <div className="flex-1">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={outOfPosts ? 'Daily post limit reached. Resets at midnight UTC.' : "What's on your mind?"}
          rows={3}
          maxLength={5000}
          disabled={outOfPosts}
          className="w-full text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none bg-transparent disabled:opacity-40"
        />
        <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{content.length}/5000</span>
            {quota && (
              <span className="text-xs text-gray-400">
                {quota.free_remaining > 0
                  ? `${quota.free_remaining} free post${quota.free_remaining !== 1 ? 's' : ''} left today`
                  : quota.total_remaining > 0
                  ? `${quota.total_remaining} paid slot${quota.total_remaining !== 1 ? 's' : ''} left`
                  : 'Daily limit reached'}
              </span>
            )}
          </div>

          {requiresPayment ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-600">Free posts used up.</span>
              <Button type="submit" size="sm" disabled={!content.trim() || submitting} className="bg-amber-600 hover:bg-amber-700">
                <Zap className="w-3 h-3 mr-1" />
                {submitting ? 'Posting…' : 'Buy extra post (1 AA)'}
              </Button>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setRequiresPayment(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <Button type="submit" size="sm" disabled={!content.trim() || submitting || outOfPosts}>
              {submitting ? 'Posting…' : 'Post'}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    </form>
  )
}
