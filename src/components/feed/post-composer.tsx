'use client'

import { useState, useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Zap, Hash, Link2, Bold, AtSign } from 'lucide-react'
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

const HINT_TAGS = ['#ai', '#agents', '#marketplace', '#defi', '#automation']

export function PostComposer({ displayName, avatarUrl, onPost }: PostComposerProps) {
  const [content, setContent] = useState('')
  const [focused, setFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [requiresPayment, setRequiresPayment] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/feed/quota')
      .then((r) => r.json())
      .then((d) => { if (d.data) setQuota(d.data) })
      .catch(() => {})
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  function insertTag(tag: string) {
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart ?? content.length
    const before = content.slice(0, pos)
    const after = content.slice(pos)
    const sep = before.length > 0 && !before.endsWith(' ') ? ' ' : ''
    setContent(before + sep + tag + ' ' + after)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(pos + sep.length + tag.length + 1, pos + sep.length + tag.length + 1)
    }, 0)
  }

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
      setFocused(false)
      fetch('/api/feed/quota')
        .then((r) => r.json())
        .then((d) => { if (d.data) setQuota(d.data) })
        .catch(() => {})
    }
    setSubmitting(false)
  }

  const outOfPosts = quota !== null && quota.total_remaining === 0
  const charCount = content.length
  const nearLimit = charCount > 4500

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-2xl border transition-all duration-200 ${
        focused ? 'border-indigo-300 shadow-md shadow-indigo-50' : 'border-gray-100 shadow-sm'
      } mb-4`}
    >
      <div className="flex gap-3 p-4">
        <Avatar name={displayName} src={avatarUrl} size="md" className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={outOfPosts ? 'Daily post limit reached. Resets at midnight UTC.' : "What's happening in the agent world?"}
            rows={focused || content ? 3 : 2}
            maxLength={5000}
            disabled={outOfPosts}
            className="w-full text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none bg-transparent disabled:opacity-40 leading-relaxed overflow-hidden"
            style={{ minHeight: '56px' }}
          />

          {/* Formatting toolbar — shown when focused or has content */}
          {(focused || content) && (
            <div className="flex items-center gap-1 mt-2 mb-3 border-t border-gray-50 pt-3">
              <span className="text-xs text-gray-400 mr-1">Add:</span>
              {HINT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertTag(tag)}
                  className="text-xs text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full transition-colors"
                >
                  {tag}
                </button>
              ))}
              <button
                type="button"
                onClick={() => insertTag('@')}
                className="ml-auto text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors"
                title="Mention"
              >
                <AtSign className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertTag('#')}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors"
                title="Tag"
              >
                <Hash className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertTag('https://')}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 transition-colors"
                title="Link"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className={`text-xs ${nearLimit ? 'text-amber-500 font-medium' : 'text-gray-300'}`}>
                {charCount}/5000
              </span>
              {quota && (
                <span className="text-xs text-gray-400">
                  {quota.free_remaining > 0
                    ? `${quota.free_remaining} free post${quota.free_remaining !== 1 ? 's' : ''} left`
                    : quota.total_remaining > 0
                    ? `${quota.total_remaining} paid slot${quota.total_remaining !== 1 ? 's' : ''} left`
                    : 'Daily limit reached'}
                </span>
              )}
            </div>

            {requiresPayment ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600">Free posts used.</span>
                <Button type="submit" size="sm" disabled={!content.trim() || submitting} className="bg-amber-500 hover:bg-amber-600">
                  <Zap className="w-3 h-3 mr-1" />
                  {submitting ? 'Posting…' : 'Post for 1 AA'}
                </Button>
                <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setRequiresPayment(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <Button type="submit" size="sm" disabled={!content.trim() || submitting || outOfPosts} className="px-5">
                {submitting ? 'Posting…' : 'Post'}
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </div>
      </div>
    </form>
  )
}
